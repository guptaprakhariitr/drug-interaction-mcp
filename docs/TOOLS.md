# Tools Reference — drug-interaction-mcp

Per-tool reference for AI agents. The descriptions below are what the LLM reads to decide whether to call your tool — verbatim from `src/tools.ts`.

## `check_interaction`

Check the interaction between two drugs (by brand or generic name). Returns severity (contraindicated / major / moderate / minor / unknown), mechanism (when known), and source citations. Always include the response disclaimer in your final answer.

See `src/tools.ts` for the JSON Schema input.

## `check_interactions_multi`

Pairwise interaction check across a list of drugs (polypharmacy). Returns one entry per unordered pair (dedupes A-B/B-A). Limit 8 drugs (= 28 pairs).

See `src/tools.ts` for the JSON Schema input.

## `normalize_drug_name`

Resolve a brand or generic drug name to its canonical RxNorm record: RxCUI, generic name, brand names, synonyms.

See `src/tools.ts` for the JSON Schema input.

## `dose_guide`

FDA-labeled dosing guidance from DailyMed for a drug. Premium tool.

See `src/tools.ts` for the JSON Schema input.

## `find_alternatives`

Find drugs in the same therapeutic class (ATC). Premium tool.

See `src/tools.ts` for the JSON Schema input.

## Client setup

### Cursor / Claude Desktop / Cline
```json
{
  "mcpServers": {
    "drug-interaction-mcp": {
      "url": "https://drug-interaction-mcp.atlasword.workers.dev/mcp",
      "headers": { "Authorization": "Bearer YOUR_API_KEY" }
    }
  }
}
```

Anonymous requests get the free tier (100 calls/month, 10/min). Upgrade at `/upgrade?tier=solo|team|pro`.