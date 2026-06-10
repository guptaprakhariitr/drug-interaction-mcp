# drug-interaction-mcp — SCAFFOLD

> Drug-drug interaction checker for clinical LLMs. Wraps RxNorm + openFDA + DailyMed. High-stakes use case → high willingness-to-pay (clinical LLM startups).

**Status:** scaffolded. Idea #20 in [`../../../ai-as-customer-ideas.md`](../../../ai-as-customer-ideas.md).

---

## Planned tools

| Tool | Source | What it returns |
|---|---|---|
| `check_interaction(drug_a, drug_b)` | RxNorm + DailyMed | Severity (contraindicated / major / moderate / minor), mechanism, references. |
| `check_interactions_multi(drug_list[])` | RxNorm | Pairwise matrix for a polypharmacy regimen. |
| `dose_guide(drug, condition?, age_band?)` | DailyMed labels | Indication-specific dose ranges. Premium. |
| `normalize_drug_name(name_or_brand)` | RxNorm | Map brand to generic (RxCUI). |
| `find_alternatives(drug, condition?)` | RxNorm class hierarchy | Same-class alternatives. Premium. |

## Audience

Clinical LLM startups (Hippocratic, OpenEvidence, Glass, etc.). High-stakes use case → they pay $99+/mo without blinking when it works.

## Pricing (higher than peers)

| Tier | Price | Notes |
|---|---|---|
| Free | $0 | 50 calls/mo (clinical, conservative) |
| Solo | $29 | 1,000 |
| Team | $99 | 10,000 + dose_guide + find_alternatives |
| Pro  | $299 | 100,000 + alerts + custom interaction-table import |

## Risk notes

- **This is high-stakes.** Bad data could harm patients. Clinical buyers will absolutely audit your sources.
- Cite every interaction back to its source (DailyMed label section, RxNorm relationship). Make sources part of the response payload, not an afterthought.
- Add disclaimer in every response: "For clinical decision support; final responsibility rests with the prescriber."
- Possibly: insurance / SOC2 path eventually. For initial launch, just be honest about sources + freshness.

## Open / closed split

- **Open**: RxNorm wrapper, drug normalization, basic interaction lookup.
- **Closed**: interaction-severity scoring, alternative-finding logic, the precomputed interaction matrix (the data is from CMS but the *index* and *severity scoring* is the moat).

## See also

- [`../fda-approvals-mcp/`](../fda-approvals-mcp/) — same audience.
- [`../README.md`](../README.md) — Category 1 pipeline.


---

## Sister MCPs

All from the same operator, all live on `<product>.prakhar-cognizance.workers.dev`, all free-tier friendly:

| Group | Products |
|---|---|
| **Research** | [sec-edgar](https://github.com/guptaprakhariitr/sec-edgar-mcp) · [arxiv](https://github.com/guptaprakhariitr/arxiv-mcp) · [world-bank-economic](https://github.com/guptaprakhariitr/world-bank-economic-mcp) · [uspto-patents](https://github.com/guptaprakhariitr/uspto-patents-mcp) · [fda-approvals](https://github.com/guptaprakhariitr/fda-approvals-mcp) |
| **Verification + Utility** | [verification](https://github.com/guptaprakhariitr/verification-mcp) ⭐ · [unit-converter](https://github.com/guptaprakhariitr/unit-converter-mcp) |
| **India** | [indic-normalize](https://github.com/guptaprakhariitr/indic-normalize-mcp) · [indian-regulatory](https://github.com/guptaprakhariitr/indian-regulatory-mcp) |
| **Real-time** | [hn-trending](https://github.com/guptaprakhariitr/hn-trending-mcp) · [wikipedia-recent-changes](https://github.com/guptaprakhariitr/wikipedia-recent-changes-mcp) · [gdelt-events](https://github.com/guptaprakhariitr/gdelt-events-mcp) · [crypto-prices](https://github.com/guptaprakhariitr/crypto-prices-mcp) |
| **Healthcare** | [drug-interaction](https://github.com/guptaprakhariitr/drug-interaction-mcp) |
| **Logistics** | [multi-carrier-tracking](https://github.com/guptaprakhariitr/multi-carrier-tracking-mcp) |

Full catalog: https://github.com/guptaprakhariitr · ⭐ = empty-quadrant / highest-conviction pick.

