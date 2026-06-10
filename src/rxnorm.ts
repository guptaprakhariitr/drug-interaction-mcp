// RxNorm + DailyMed client.
// RxNorm docs: https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html
// Note: NLM discontinued the live "interaction" RxNav endpoint in Jan 2024.
// For interaction data we use the maintained openFDA labels (drug-drug
// interaction sections) + an internal curated table (private repo) keyed on
// RxCUI pairs.

import { KvCache } from "./cache";

export interface RxNormEnv {
  CACHE: KVNamespace;
  RXNORM_BASE: string;
  DAILYMED_BASE: string;
}

export interface DrugNorm {
  query: string;
  rxcui?: string;
  generic_name?: string;
  brand_names: string[];
  synonyms: string[];
}

export type Severity = "contraindicated" | "major" | "moderate" | "minor" | "unknown";

export interface Interaction {
  drug_a: { rxcui?: string; name: string };
  drug_b: { rxcui?: string; name: string };
  severity: Severity;
  mechanism?: string;
  description?: string;
  sources: Array<{ name: string; url?: string }>;
  disclaimer: string;
}

// NLM's vocabulary → our canonical 4-level severity.
export const SEVERITY_MAP: Record<string, Severity> = {
  "contraindicated": "contraindicated",
  "high": "major",
  "high severity": "major",
  "serious": "major",
  "moderate": "moderate",
  "low": "minor",
  "minor": "minor",
};

const DISCLAIMER = "For clinical decision support only. Final prescribing responsibility rests with the licensed clinician.";

export class RxNormClient {
  private cache: KvCache;
  constructor(private env: RxNormEnv) { this.cache = new KvCache(env.CACHE, "rx"); }

  /** Resolve any drug name (brand or generic) to its canonical RxCUI + names. */
  async normalize(name: string): Promise<DrugNorm> {
    const key = `norm:${name.toLowerCase()}`;
    return this.cache.memoize(key, 60 * 60 * 24, async () => {
      // NLM's RxNorm `rxcui` endpoint requires the `search=2` parameter for
      // approximate matching of normalized drug names; without it the API
      // returns HTTP 400 "Path or Query Parameter error" on common brand names.
      // NLM's RxNorm rejects unknown `tty` values with HTTP 400, so each
      // related-concept fetch is wrapped in try/catch — one bad lookup
      // shouldn't fail the whole normalize call.
      const a: any = await this.get(`/rxcui.json?name=${encodeURIComponent(name)}&search=2`);
      const rxcui = a?.idGroup?.rxnormId?.[0];
      let generic = name;
      let brands: string[] = [];
      const synonyms: string[] = [];
      if (rxcui) {
        try {
          const props: any = await this.get(`/rxcui/${rxcui}/properties.json`);
          generic = props?.properties?.name ?? generic;
          // The properties payload includes `synonym` directly — no separate
          // /related?tty=SY call needed (that endpoint 400s on common drugs).
          if (props?.properties?.synonym) synonyms.push(props.properties.synonym);
        } catch (e) { console.error("rxnorm properties fetch failed:", e); }
        try {
          const rel: any = await this.get(`/rxcui/${rxcui}/related.json?tty=BN`);
          brands = (rel?.relatedGroup?.conceptGroup?.[0]?.conceptProperties ?? []).map((c: any) => c.name);
        } catch (e) { console.error("rxnorm BN fetch failed:", e); }
      }
      return { query: name, rxcui, generic_name: generic, brand_names: brands, synonyms };
    });
  }

  /** Check interaction between two drugs by name or RxCUI. */
  async checkPair(a: string, b: string): Promise<Interaction> {
    const [na, nb] = await Promise.all([this.normalize(a), this.normalize(b)]);
    const sources: Array<{ name: string; url?: string }> = [];

    // Best-effort lookup against DailyMed: do labels of either drug mention
    // the other in drug-interactions section?
    let mechanism: string | undefined;
    let severity: Severity = "unknown";
    let description: string | undefined;

    const labelMention = await this.dailyMedMentions(na.generic_name ?? a, nb.generic_name ?? b);
    if (labelMention) {
      mechanism = labelMention.section;
      description = labelMention.excerpt;
      severity = guessSeverityFromText(labelMention.excerpt);
      sources.push({ name: "DailyMed", url: labelMention.url });
    }

    if (na.rxcui) sources.push({ name: "RxNorm", url: `https://rxnav.nlm.nih.gov/REST/rxcui/${na.rxcui}/properties.json` });
    if (nb.rxcui) sources.push({ name: "RxNorm", url: `https://rxnav.nlm.nih.gov/REST/rxcui/${nb.rxcui}/properties.json` });

    return {
      drug_a: { rxcui: na.rxcui, name: na.generic_name ?? a },
      drug_b: { rxcui: nb.rxcui, name: nb.generic_name ?? b },
      severity, mechanism, description, sources,
      disclaimer: DISCLAIMER,
    };
  }

  /**
   * Pairwise check of N drugs. Returns one row per *unordered* pair.
   * Bug fix 0.1.1: dedup by canonical pair ordering to avoid A-B and B-A duplicates.
   */
  async checkMulti(drugs: string[]): Promise<{ count: number; pairs: Interaction[] }> {
    const seen = new Set<string>();
    const promises: Promise<Interaction>[] = [];
    for (let i = 0; i < drugs.length; i++) {
      for (let j = i + 1; j < drugs.length; j++) {
        const key = canonicalPairKey(drugs[i], drugs[j]);
        if (seen.has(key)) continue;
        seen.add(key);
        promises.push(this.checkPair(drugs[i], drugs[j]));
      }
    }
    const pairs = await Promise.all(promises);
    return { count: pairs.length, pairs };
  }

  /** Best-effort dose guide pulled from DailyMed dosage_and_administration section. */
  async doseGuide(name: string): Promise<{ drug: string; sections: Array<{ label: string; text: string }>; sources: Array<{ name: string; url?: string }> }> {
    const norm = await this.normalize(name);
    const setid = await this.cache.memoize(`dailymed-setid:${name.toLowerCase()}`, 60 * 60 * 24 * 7, async () => {
      const r = await fetch(`${this.env.DAILYMED_BASE}/spls.json?drug_name=${encodeURIComponent(norm.generic_name ?? name)}&pagesize=1`);
      if (!r.ok) return null;
      const j: any = await r.json();
      return j?.data?.[0]?.setid ?? null;
    });
    if (!setid) {
      return { drug: norm.generic_name ?? name, sections: [], sources: [] };
    }
    // We *would* fetch the structured SPL XML here and extract dosage sections.
    // For the open shim, we return a stub indicating where the real parser plugs in.
    return {
      drug: norm.generic_name ?? name,
      sections: [
        { label: "Dosage and Administration", text: "[full text extraction lives in private repo]" },
      ],
      sources: [{ name: "DailyMed", url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setid}` }],
    };
  }

  /** Find drugs in the same therapeutic class. */
  async findAlternatives(name: string): Promise<{ drug: string; alternatives: Array<{ rxcui: string; name: string }> }> {
    const norm = await this.normalize(name);
    if (!norm.rxcui) return { drug: name, alternatives: [] };
    // Use RxClass to find class members. Free, no key.
    const j: any = await this.get(`/rxclass/class/byRxcui.json?rxcui=${norm.rxcui}&relaSource=ATC`);
    const classes = (j?.rxclassDrugInfoList?.rxclassDrugInfo ?? []).map((d: any) => d.rxclassMinConceptItem?.classId).filter(Boolean);
    if (classes.length === 0) return { drug: norm.generic_name ?? name, alternatives: [] };
    const members: any = await this.get(`/rxclass/classMembers.json?classId=${classes[0]}&relaSource=ATC`);
    const alternatives = (members?.drugMemberGroup?.drugMember ?? [])
      .map((m: any) => ({ rxcui: m.minConcept?.rxcui, name: m.minConcept?.name }))
      .filter((m: any) => m.rxcui && m.rxcui !== norm.rxcui);
    return { drug: norm.generic_name ?? name, alternatives };
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private async dailyMedMentions(_a: string, _b: string): Promise<{ section: string; excerpt: string; url: string } | null> {
    // Stubbed in the open shim — DailyMed structured-product-labeling XML
    // parsing is in the private repo.
    return null;
  }

  private async get(path: string): Promise<any> {
    const r = await fetch(`${this.env.RXNORM_BASE}${path}`);
    if (!r.ok) {
      if (r.status === 404) return {};
      const txt = await r.text();
      throw new Error(`RxNorm ${r.status}: ${txt.slice(0, 200)}`);
    }
    return r.json();
  }
}

// ── Exported helpers ───────────────────────────────────────────────────────

export function canonicalPairKey(a: string, b: string): string {
  const [x, y] = [a.toLowerCase(), b.toLowerCase()].sort();
  return `${x}|${y}`;
}

export function guessSeverityFromText(text: string): Severity {
  const lower = text.toLowerCase();
  if (/contraindicated/.test(lower)) return "contraindicated";
  if (/major|serious|life-threatening|severe/.test(lower)) return "major";
  if (/moderate/.test(lower)) return "moderate";
  if (/minor|mild/.test(lower)) return "minor";
  return "unknown";
}
