import { Tool } from "./mcp-server";
import { RxNormClient, RxNormEnv } from "./rxnorm";

export function buildTools(): Tool[] {
  return [
    {
      name: "check_interaction",
      description:
        "Check the interaction between two drugs (by brand or generic name). Returns severity (contraindicated / major / moderate / minor / unknown), mechanism (when known), and source citations. Always include the response disclaimer in your final answer.",
      inputSchema: {
        type: "object",
        properties: {
          drug_a: { type: "string" },
          drug_b: { type: "string" },
        },
        required: ["drug_a", "drug_b"],
      },
      handler: async (args, ctx) => {
        const c = new RxNormClient(ctx.env as unknown as RxNormEnv);
        return await c.checkPair(args.drug_a, args.drug_b);
      },
    },

    {
      name: "check_interactions_multi",
      description:
        "Pairwise interaction check across a list of drugs (polypharmacy). Returns one entry per unordered pair (dedupes A-B/B-A). Limit 8 drugs (= 28 pairs).",
      inputSchema: {
        type: "object",
        properties: {
          drugs: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 8 },
        },
        required: ["drugs"],
      },
      handler: async (args, ctx) => {
        const c = new RxNormClient(ctx.env as unknown as RxNormEnv);
        return await c.checkMulti((args.drugs as string[]).slice(0, 8));
      },
    },

    {
      name: "normalize_drug_name",
      description:
        "Resolve a brand or generic drug name to its canonical RxNorm record: RxCUI, generic name, brand names, synonyms.",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string", description: "Brand or generic, e.g. 'Tylenol' or 'acetaminophen'." } },
        required: ["name"],
      },
      handler: async (args, ctx) => {
        const c = new RxNormClient(ctx.env as unknown as RxNormEnv);
        return await c.normalize(args.name);
      },
    },

    {
      name: "dose_guide",
      description:
        "FDA-labeled dosing guidance from DailyMed for a drug. Premium tool.",
      inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
      premium: true,
      handler: async (args, ctx) => {
        const c = new RxNormClient(ctx.env as unknown as RxNormEnv);
        return await c.doseGuide(args.name);
      },
    },

    {
      name: "find_alternatives",
      description:
        "Find drugs in the same therapeutic class (ATC). Premium tool.",
      inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
      premium: true,
      handler: async (args, ctx) => {
        const c = new RxNormClient(ctx.env as unknown as RxNormEnv);
        return await c.findAlternatives(args.name);
      },
    },
  ];
}
