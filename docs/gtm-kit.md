# SnapMCP 2.3.0 — Go-to-Market Kit

Preparado desde el análisis de mercado (firecrawl). Copia/pega estas descripciones en los registries.

---

## Positioning (pitch central)

> **snapmcp — The visual documentation MCP server.**
> When Playwright's structured snapshots aren't enough: real terminal colors,
> syntax-highlighted code, visual diffs, PDFs and GIFs — one MCP server, 13 tools,
> zero heavy dependencies, SSRF protection on by default.

## Registry submissions

### 1. registry.modelcontextprotocol.io (oficial)
- Name: `snapmcp`
- Description: `All-in-one visual capture MCP server: terminal (real colors), code (Shiki), browser screenshots, markdown, diffs, PDFs, GIFs. 13 tools, zero heavy deps, SSRF protection by default.`
- Tags: `screenshot, visual, terminal, code, documentation, pdf`
- URL: https://github.com/reeinharddd/snapmcp
- Form: https://registry.modelcontextprotocol.io (submit via GitHub PR to modelcontextprotocol/servers, `registry/` dir)

### 2. glama.ai/mcp/servers
- Name: `snapmcp`
- One-liner: `13 visual capture tools for AI agents: terminal colors, code syntax, browser, diffs, PDFs, GIFs`
- Link: https://glama.ai/mcp/servers (@reeinharddd/snapmcp)

### 3. mcp.so
- Name: `snapmcp`
- Tags: `screenshot`, `terminal`, `code`, `pdf`, `gif`, `documentation`
- GitHub link: https://github.com/reeinharddd/snapmcp

### 4. pulse.mcp.so
- Same metadata as mcp.so

### 5. mcpservers.org
- Same metadata; category: `Visual Capture` / `Documentation`

## GitHub README improvements (order of impact)

1. Demo GIFs at the top: terminal capture (with real colors — unique selling point), code capture, PDF generation
2. Quick-start < 2 min: `npx snapmcp` → add to Claude Code → capture
3. Comparison table: snapmcp vs Playwright MCP vs Puppeteer MCP (when to use each)
4. Badges: npm downloads, license, last commit, test status

## PR to awesome-mcp-servers (after README is polished)

- Repo: github.com/punkpeye/awesome-mcp-servers (maintained community list)
- Add under a new/適切 category: "Visual Capture & Documentation"
- Entry: `[snapmcp](https://github.com/reeinharddd/snapmcp) - All-in-one visual capture: terminal colors, code, browser, diffs, PDFs, GIFs. 13 tools, SSRF protection on by default.`

## Content plan (30 days)

1. Blog post: "Why I built an all-in-one visual MCP server (and when NOT to use Playwright)" — Dev.to + Hashnode
2. Demo thread on X/Twitter with GIF results + #MCP #AI #Agents
3. Reddit: r/mcp, r/ClaudeCode, r/AI_Agents — share use case "generating technical docs with terminal+code screenshots"
4. Discord: Cursor + Anthropic communities — help with setup, share captures

## Success metrics (6 months)

- 500+ GitHub stars
- 5K+ npm downloads/month
- Top-50 MCP server in at least one registry
- 3+ third-party blog posts/videos mentioning snapmcp
- If no traction after 6 months of aggressive GTM: consider pivot or sunset