import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RxNormClient, canonicalPairKey, guessSeverityFromText, SEVERITY_MAP } from "../src/rxnorm";
import { McpServer, ToolContext } from "../src/mcp-server";
import { buildTools } from "../src/tools";

class FakeKv {
  store = new Map<string, string>();
  async get(key: string, type?: "text" | "json"): Promise<any> {
    const v = this.store.get(key); if (v === undefined) return null;
    if (type === "json") return JSON.parse(v); return v;
  }
  async put(key: string, value: string): Promise<void> { this.store.set(key, value); }
  async delete(key: string): Promise<void> { this.store.delete(key); }
}

const env = {
  CACHE: new FakeKv() as unknown as KVNamespace,
  USAGE: new FakeKv() as unknown as KVNamespace,
  RXNORM_BASE: "https://rxnav.nlm.nih.gov/REST",
  DAILYMED_BASE: "https://dailymed.nlm.nih.gov/dailymed/services/v2",
  UPGRADE_URL: "x",
};

beforeEach(() => {
  (env.CACHE as any).store = new Map();
  vi.stubGlobal("fetch", async (url: string | URL) => {
    const u = typeof url === "string" ? url : url.toString();
    if (u.endsWith("/rxcui.json?name=warfarin"))   return jr({ idGroup: { rxnormId: ["11289"] } });
    if (u.endsWith("/rxcui.json?name=aspirin"))    return jr({ idGroup: { rxnormId: ["1191"] } });
    if (u.endsWith("/rxcui.json?name=tylenol"))    return jr({ idGroup: { rxnormId: ["1093"] } });
    if (u.includes("/rxcui/11289/properties.json"))   return jr({ properties: { name: "warfarin" } });
    if (u.includes("/rxcui/1191/properties.json"))    return jr({ properties: { name: "aspirin" } });
    if (u.includes("/rxcui/1093/properties.json"))    return jr({ properties: { name: "acetaminophen" } });
    if (u.includes("/related.json?tty=BN"))       return jr({ relatedGroup: { conceptGroup: [{ conceptProperties: [{ name: "BrandX" }] }] } });
    if (u.includes("/related.json?tty=SY"))       return jr({ relatedGroup: { conceptGroup: [{ conceptProperties: [{ name: "Syn1" }, { name: "Syn2" }] }] } });
    if (u.includes("/rxclass/class/byRxcui.json")) return jr({ rxclassDrugInfoList: { rxclassDrugInfo: [{ rxclassMinConceptItem: { classId: "N02BE" } }] } });
    if (u.includes("/rxclass/classMembers.json"))  return jr({ drugMemberGroup: { drugMember: [{ minConcept: { rxcui: "9999", name: "ibuprofen" } }, { minConcept: { rxcui: "1093", name: "acetaminophen" } }] } });
    return jr({});
  });
});

afterEach(() => vi.unstubAllGlobals());

function jr(b: unknown): Response { return new Response(JSON.stringify(b), { status: 200 }); }

describe("Pure helpers", () => {
  it("canonicalPairKey is order-independent", () => {
    expect(canonicalPairKey("Aspirin", "warfarin")).toBe(canonicalPairKey("Warfarin", "aspirin"));
  });
  it("guessSeverityFromText recognizes contraindicated", () => {
    expect(guessSeverityFromText("Contraindicated due to bleeding risk")).toBe("contraindicated");
    expect(guessSeverityFromText("Major: monitor INR")).toBe("major");
    expect(guessSeverityFromText("moderate effect on metabolism")).toBe("moderate");
    expect(guessSeverityFromText("no known interaction")).toBe("unknown");
  });
  it("SEVERITY_MAP includes contraindicated, major, moderate, minor", () => {
    expect(SEVERITY_MAP["contraindicated"]).toBe("contraindicated");
    expect(SEVERITY_MAP["serious"]).toBe("major");
    expect(SEVERITY_MAP["moderate"]).toBe("moderate");
    expect(SEVERITY_MAP["minor"]).toBe("minor");
  });
});

describe("RxNormClient.normalize", () => {
  it("returns rxcui and generic name", async () => {
    const c = new RxNormClient(env as any);
    const r = await c.normalize("warfarin");
    expect(r.rxcui).toBe("11289");
    expect(r.generic_name).toBe("warfarin");
    expect(r.brand_names).toContain("BrandX");
  });
});

describe("RxNormClient.checkPair", () => {
  it("returns an interaction record with both drugs + sources + disclaimer", async () => {
    const c = new RxNormClient(env as any);
    const r = await c.checkPair("warfarin", "aspirin");
    expect(r.drug_a.rxcui).toBe("11289");
    expect(r.drug_b.rxcui).toBe("1191");
    expect(r.sources.length).toBeGreaterThan(0);
    expect(r.disclaimer).toMatch(/clinical/);
  });
});

describe("RxNormClient.checkMulti dedup (0.1.1 bug fix)", () => {
  it("returns N*(N-1)/2 pairs, not N*N (no A-B + B-A)", async () => {
    const c = new RxNormClient(env as any);
    const r = await c.checkMulti(["warfarin", "aspirin", "tylenol"]);
    expect(r.count).toBe(3);          // C(3,2) = 3
    // each pair unique under canonical ordering
    const keys = new Set(r.pairs.map((p) => canonicalPairKey(p.drug_a.name, p.drug_b.name)));
    expect(keys.size).toBe(3);
  });
});

describe("RxNormClient.findAlternatives", () => {
  it("returns same-class alternatives excluding the input drug", async () => {
    const c = new RxNormClient(env as any);
    const r = await c.findAlternatives("tylenol");
    expect(r.alternatives.length).toBeGreaterThan(0);
    expect(r.alternatives.find((a) => a.rxcui === "1093")).toBeUndefined();      // own rxcui filtered
    expect(r.alternatives.find((a) => a.rxcui === "9999")).toBeDefined();
  });
});

describe("MCP protocol", () => {
  const server = new McpServer({ name: "drug-interaction-mcp", version: "0.1.1" });
  for (const t of buildTools()) server.register(t);
  const ctx: ToolContext = { env: env as any, apiKey: null, tier: "free", callsRemaining: 50 };

  it("free tier hides dose_guide + find_alternatives", async () => {
    const r = await server.handle({ jsonrpc: "2.0", id: 1, method: "tools/list" }, ctx);
    const names = (r!.result as any).tools.map((t: any) => t.name) as string[];
    expect(names).toContain("check_interaction");
    expect(names).toContain("check_interactions_multi");
    expect(names).not.toContain("dose_guide");
    expect(names).not.toContain("find_alternatives");
  });

  it("check_interaction end-to-end", async () => {
    const r = await server.handle(
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "check_interaction", arguments: { drug_a: "warfarin", drug_b: "aspirin" } } }, ctx
    );
    const out = JSON.parse((r!.result as any).content[0].text);
    expect(out.drug_a.name).toBe("warfarin");
    expect(out.disclaimer).toBeDefined();
  });
});
