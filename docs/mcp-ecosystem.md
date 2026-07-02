# MCP Ecosystem: Listing snapmcp on Every Major Registry

Last updated: 2026-07-01

This document covers the exact submission steps for the four major MCP
discovery platforms. snapmcp is an all-in-one MCP server for visual captures:
terminal, code, browser, markdown, diff, HTML, PDF, and GIF captures via
Playwright. GitHub: github.com/reeinharddd/snapmcp.

## Quick Reference

| Registry | URL | Method | Review | Time to List |
|----------|-----|--------|--------|-------------|
| Official MCP Registry | registry.modelcontextprotocol.io | `mcp-publisher` CLI + npm publish | Automated + trust check | 30 min |
| punkpeye/awesome-mcp-servers | github.com/punkpeye/awesome-mcp-servers | GitHub PR | Fast-track for automated PRs | 1-24 hrs |
| mcp.so | mcp.so/submit | Web form | None | Instant |
| smithery.ai | smithery.ai/new | Web form or CLI | Automated scan | Minutes |
| glama.ai | glama.ai/mcp/servers | Web form | Manual review | Days |

---

## 1. Official MCP Registry (modelcontextprotocol.io)

The official metadata repository hosted by the Linux Foundation's Agentic AI
Foundation. Backed by Anthropic, GitHub, PulseMCP, and Microsoft. Only stores
metadata, not artifacts. Your server package must be published to npm (or
PyPI/Docker) first.

### URL to Submit

https://registry.modelcontextprotocol.io

### Prerequisites

- Node.js project (snapmcp already uses TypeScript)
- npm account
- GitHub account

### Files/Configs Needed

**1. Add `mcpName` to package.json:**

```json
{
  "name": "snapmcp",
  "mcpName": "io.github.reeinharddd/snapmcp",
  "repository": {
    "type": "git",
    "url": "https://github.com/reeinharddd/snapmcp.git"
  },
  "description": "All-in-one MCP server for visual captures (terminal, code, browser, markdown, diff, HTML, PDF, GIF via Playwright)"
}
```

The `mcpName` must start with `io.github.reeinharddd/` when using GitHub
authentication.

**2. Create `server.json` (via `mcp-publisher init`):**

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.reeinharddd/snapmcp",
  "description": "All-in-one MCP server for visual captures. 13 tools for terminal, code, browser, markdown, diff, HTML, PDF, and GIF captures via Playwright.",
  "repository": {
    "url": "https://github.com/reeinharddd/snapmcp",
    "source": "github"
  },
  "version": "1.0.0",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "snapmcp",
      "version": "1.0.0",
      "transport": {
        "type": "stdio"
      },
      "environmentVariables": [
        {
          "name": "PLAYWRIGHT_BROWSERS_PATH",
          "description": "Path to Playwright browsers (optional)",
          "isRequired": false,
          "format": "string",
          "isSecret": false
        }
      ]
    }
  ]
}
```

### Process

1. Publish package to npm: `npm publish --access public`
2. Install `mcp-publisher`: `brew install mcp-publisher` or download from
   GitHub releases
3. Authenticate: `mcp-publisher login github`
4. Init server.json: `mcp-publisher init` (in project root)
5. Edit server.json with snapmcp's details
6. Publish: `mcp-publisher publish`

### CI/Automation Available

Yes. GitHub Actions workflow is supported:

```yaml
# .github/workflows/publish-mcp-registry.yml
name: Publish to MCP Registry

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      - name: Publish to MCP Registry
        run: |
          curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_linux_amd64.tar.gz" | tar xz mcp-publisher
          ./mcp-publisher login github --token ${{ secrets.GH_TOKEN }}
          ./mcp-publisher publish
```

### Verification

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.reeinharddd/snapmcp"
```

---

## 2. punkpeye/awesome-mcp-servers (GitHub Awesome List)

The canonical GitHub awesome list for MCP servers. 90k+ stars, 12k+ forks.
This is a community-curated README, not a registry. Inclusion drives discovery
from developers browsing GitHub and LLMs crawling awesome lists.

### URL to Submit

https://github.com/punkpeye/awesome-mcp-servers

### Method

Pull request against the README.md file.

### Files/Configs Needed

None. You just need to edit the README in your fork.

### Process

1. Fork the repository
2. Create a branch: `git checkout -b add-snapmcp`
3. Edit `README.md`:
   - Find the correct category section for snapmcp
   - snapmcp's tools cover: Browser Automation, Developer Tools, Screenshot
     captures. The best fit is **Browser Automation** (alphabetically
     ordered).
   - Add one line per the existing format:
     ```markdown
     - [snapmcp](https://github.com/reeinharddd/snapmcp) - All-in-one MCP server for visual captures. 13 tools: terminal, code, browser, markdown, diff, HTML, PDF, GIF captures via Playwright.
     ```
   - Maintain alphabetical order within the category
4. Commit: `git commit -m "Add snapmcp MCP server"`
5. Push: `git push origin add-snapmcp`
6. Open a PR against the main branch
7. **Add `🤖🤖🤖` to the end of the PR title** for fast-track automated
   merging

### Review Process

- Automated PRs tagged with `🤖🤖🤖` are fast-tracked
- Reviewers check for: dead links, wrong category, hyped descriptions
- Keep the description factual, test every URL before pushing
- 1-2 maintainers review, typically fast

### CI/Automation Available

The repo has GitHub Actions for label management. No automated publish
workflow needed on your side since this is a PR-based submission.

---

## 3. mcp.so

The largest public MCP marketplace. 20,000+ servers indexed as of mid-2026.
Highest SEO visibility for "MCP servers" searches. No review process.

### URL to Submit

https://mcp.so/submit

### Method

Web form (self-registration).

### Files/Configs Needed

No files needed. Prepare the following metadata to paste into the form:

- **Type**: MCP Server
- **Name**: snapmcp
- **URL**: https://github.com/reeinharddd/snapmcp
- **Server Config** (JSON snippet for Claude Desktop / Cursor):

```json
{
  "mcpServers": {
    "snapmcp": {
      "command": "npx",
      "args": ["-y", "snapmcp"]
    }
  }
}
```

### What to Prepare Before Submitting

- Server name: snapmcp
- One-sentence description: All-in-one MCP server for visual captures
  (terminal, code, browser, markdown, diff, HTML, PDF, GIF via Playwright)
- Tool count: 13
- Transport type: stdio
- GitHub URL: https://github.com/reeinharddd/snapmcp
- Homepage URL: https://github.com/reeinharddd/snapmcp (or your npm page)
- Optional icon: use the GitHub social preview or add a custom square icon
- Config snippet (see above) -- mcp.so renders it inline, this is your
  primary selling point

### Process

1. Go to https://mcp.so/submit
2. Fill in the form:
   - Type: MCP Server
   - Name: snapmcp
   - URL: https://github.com/reeinharddd/snapmcp
   - Server Config: paste the JSON config snippet
3. Click Submit

### Review

None. Self-service, instant listing.

### CI/Automation

Not available. Manual web form only.

---

## 4. smithery.ai

Smithery operates as a publisher platform with a CLI (`@smithery/cli`) and
managed auth layer. It handles distribution, analytics, and configuration UI.
Supports both hosted (remote URL) and local (stdio/MCPB bundle) servers.

### URL to Submit

https://smithery.ai/new

### Method

Web form (preferred) or CLI.

### Requirements for snapmcp

Since snapmcp is a stdio-based server (runs via npx), it uses the **Local
(MCPB Bundle)** path. Alternatively, you can deploy it as a hosted server
with a Streamable HTTP endpoint.

### Option A: Publish via URL (Recommended if you host snapmcp)

1. Go to https://smithery.ai/new
2. Enter snapmcp's public HTTPS URL (e.g., `https://snapmcp.example.com/mcp`)
   - Only works if snapmcp has a Streamable HTTP transport
3. Smithery scans the server to extract tools/prompts/resources automatically
4. Complete the publishing flow

### Option B: Publish via MCPB Bundle (for stdio/npx distribution)

1. Prepare a `.mcpb` bundle of snapmcp
2. Publish via CLI:

```bash
smithery mcp publish ./snapmcp.mcpb -n reeinrhd/snapmcp
```

Or via API:

```bash
curl -X POST https://smithery.ai/api/servers/publish \
  -F "bundle=@snapmcp.mcpb" \
  -H "Authorization: Bearer $SMITHERY_TOKEN"
```

### Option C: Publish via CLI with URL (no hosting needed)

If snapmcp has a public HTTP endpoint:

```bash
smithery mcp publish "https://your-server.com/mcp" -n @reeinharddd/snapmcp
```

With a config schema:

```bash
smithery mcp publish "https://your-server.com/mcp" \
  -n @reeinharddd/snapmcp \
  --config-schema '{"type":"object","properties":{"playwrightBrowsersPath":{"type":"string"}}}'
```

### Files/Configs Needed

**Static Server Card** (if Smithery's scan can't reach your server):

Served at `/.well-known/mcp/server-card.json`:

```json
{
  "serverInfo": {
    "name": "snapmcp",
    "version": "1.0.0"
  },
  "authentication": {
    "required": false
  },
  "tools": [
    {
      "name": "capture_terminal",
      "description": "Generate a styled terminal screenshot from text lines",
      "inputSchema": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "lines": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["title", "lines"]
      }
    },
    {
      "name": "capture_code",
      "description": "Generate a syntax-highlighted code screenshot using Shiki",
      "inputSchema": {
        "type": "object",
        "properties": {
          "code": { "type": "string" },
          "language": { "type": "string" }
        },
        "required": ["code"]
      }
    },
    {
      "name": "capture_browser",
      "description": "Take a screenshot of a URL using headless Chromium",
      "inputSchema": {
        "type": "object",
        "properties": {
          "url": { "type": "string", "format": "uri" },
          "fullPage": { "type": "boolean" }
        },
        "required": ["url"]
      }
    }
  ],
  "resources": [],
  "prompts": []
}
```

### Account Setup

1. Create a publisher account at smithery.ai
2. Create a namespace (e.g., `reeinharddd`)
3. Create an API key for CI automation

### Security / WAF Notes

Smithery scans servers with User-Agent `SmitheryBot/1.0
(+https://smithery.ai)` from Cloudflare Workers IPs. If snapmcp has a hosted
endpoint behind Cloudflare:

- Whitelist `SmitheryBot/1.0` in your WAF
- Return **401** (not 403) for unauthenticated requests to trigger OAuth
  discovery
- Or skip scanning entirely by serving the static server card (see above)

### CI/Automation Available

Yes, via the Smithery API. The `@smithery/cli` CLI supports:

```bash
smithery mcp publish "https://your-server.com/mcp" -n @reeinharddd/snapmcp
```

---

## 5. glama.ai/mcp (Bonus)

Glama runs a dedicated MCP server catalog at glama.ai/mcp with 50,000+
servers indexed. Submissions are form-based and manually reviewed.

### URL to Submit

https://glama.ai/mcp/servers (click "Add Server")

### Method

Web form with manual review.

### What to Prepare

- Server name: snapmcp
- Description: All-in-one MCP server for visual captures (terminal, code,
  browser, markdown, diff, HTML, PDF, GIF via Playwright)
- Repository URL: https://github.com/reeinharddd/snapmcp
- Installation snippet: `npx -y snapmcp`
- Transport: stdio
- Tool count: 13
- Category: Browser Automation

### Review

Manual review. glama prefers production-quality servers with clear docs and
working examples. Make sure the README has a solid install guide.

---

## Universal Submission Checklist

Prepare this metadata once, submit it everywhere:

- [ ] **Name**: snapmcp
- [ ] **Description**: All-in-one MCP server for visual captures (terminal,
      code, browser, markdown, diff, HTML, PDF, GIF via Playwright). 13
      tools.
- [ ] **Tool list**: capture_terminal, capture_code, capture_file,
      capture_browser, capture_markdown, capture_diff, capture_html,
      capture_pdf, capture_gif, capture_sequence, capture_batch,
      capture_to_document, snapmcp-hint
- [ ] **Transport type**: stdio (via npx)
- [ ] **Auth method**: None (public, no API key required)
- [ ] **Config snippet**: see mcp.so section above
- [ ] **Homepage**: https://github.com/reeinharddd/snapmcp
- [ ] **Repository**: https://github.com/reeinharddd/snapmcp
- [ ] **License**: MIT (confirm)
- [ ] **Contact**: GitHub issues at repo URL

## Pre-Submission Verification

Before submitting to any registry, verify the MCP handshake works:

```bash
# For a hosted/HTTP endpoint (if applicable):
curl -X POST https://your-hosted-snapmcp.com/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"registry-probe","version":"1.0.0"}}}'

# For local stdio, use MCP Inspector:
npx @modelcontextprotocol/inspector npx -y snapmcp
```

Expected response includes `protocolVersion`, `serverInfo.name`, and
capability flags.

## Recommended Order of Operations

1. **Pre-check**: Verify the initialize handshake via MCP Inspector
2. **Official Registry**: Publish to npm first, then use `mcp-publisher`
3. **awesome-mcp-servers**: Open a PR (tag with robot emoji for fast-track)
4. **mcp.so**: Fill the quick web form
5. **smithery.ai**: Set up publisher account and submit
6. **glama.ai**: Final submission (manual review takes longest)
7. **Monitor**: Check all listings after 48 hours
