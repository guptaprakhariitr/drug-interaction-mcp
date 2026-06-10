# Registry Submission Checklist — drug-interaction-mcp

Pre-filled values for every MCP registry. Each submission takes 1–3 minutes in a browser.

## ✅ Already automatic

### Glama — `glama.ai`
Auto-crawls GitHub by repo topic `mcp-server`. Already tagged. Indexes within 24 hours.
- https://glama.ai/mcp/servers?q=drug-interaction-mcp

### Official MCP Registry
- The `server.json` at this repo's root is the registry manifest.
- Submit via: `mcp-publisher publish server.json` (after `make publisher` and `mcp-publisher login github` in the registry repo).
- Downstream registries (PulseMCP, mcp.so) ingest from here weekly.

## 🌐 Manual browser submission

### PulseMCP — single URL field
- https://www.pulsemcp.com/submit
- **Paste:** `https://github.com/guptaprakhariitr/drug-interaction-mcp`

### mcp.so — multi-field form
- https://mcp.so/submit
- **Name:** `drug-interaction-mcp`
- **Display name:** `Drug Interaction Checker`
- **Description:** `Drug-drug interaction checker for clinical LLMs. RxNorm + openFDA + DailyMed. Returns severity, mechanism, citations.`
- **GitHub URL:** `https://github.com/guptaprakhariitr/drug-interaction-mcp`
- **Endpoint URL:** `https://drug-interaction-mcp.prakhar-cognizance.workers.dev/mcp`
- **Tags:** rxnorm, drug-interaction, clinical-llm, ddi, dailymed, pharmacology
- **License:** MIT
- **Transport:** HTTP (remote)

### mcp.directory
- https://mcp.directory/submit
- Same values as mcp.so. Include a demo GIF if you can.

### Smithery (paid — $30/mo)
- https://smithery.ai/new
- Worth it if you have ≥6 paid subscribers.

### Cursor Marketplace
- Submit from Cursor → Settings → Marketplace → Submit. Curated; 1–2 weeks for approval.

## Social

### Show HN
- Title: `Show HN: drug-interaction-mcp — Drug Interaction Checker as an MCP for Claude / Cursor`
- URL: `https://github.com/guptaprakhariitr/drug-interaction-mcp`

### Twitter / X thread template
> Just shipped drug-interaction-mcp — Model Context Protocol server: drug-drug interaction checker for clinical llms.
>
> Endpoint: https://drug-interaction-mcp.prakhar-cognizance.workers.dev/mcp
> GitHub: https://github.com/guptaprakhariitr/drug-interaction-mcp
>
> Free tier available. Paid from $9/mo.
