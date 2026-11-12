# snapmcp 2.3.11 Go-to-Market Kit

Use these descriptions for registry listings, directories, launch posts, and other discovery surfaces. Keep the security and runtime claims consistent with the current documentation.

## Positioning

> snapmcp is the visual documentation MCP server for AI agents. It creates terminal screenshots, Shiki-highlighted code images, HTTP(S) page captures and PDFs, Markdown, HTML, PowerPoint and Word documents, visual diffs, GIFs, ordered step sequences, and captioned reports through exactly 13 tools. Capture results are saved file paths, not image bytes, and every tool also returns a structured payload; the hint tool returns text.

## Registry description

> Visual documentation MCP server with 13 tools for terminal output, code highlighting, browser screenshots, Markdown, HTML, diffs, PDFs, GIFs, sequences, and editable PowerPoint or Word documents. Returns saved file paths with structured payloads, bounded inputs, deny-all file reads, output confinement, and default-on SSRF checks with DNS pinning.

## Short description

> Create terminal, code, browser, diff, PDF, GIF, and captioned document artifacts with one 13-tool MCP server.

## Product bullets

- Exactly 13 tools, with no redundant capture feature.
- Shiki highlighting for 300+ bundled languages and 27 built-in themes.
- Inclusive `startLine` and `endLine` ranges for code and file captures.
- Ordered `capture_sequence` step images with an optional GIF.
- Print-quality document PDFs with generated captures embedded, plus editable PPTX and DOCX output with real text.
- Every tool declares a JSON Schema output and returns a structured payload with the saved path, format, size, and image dimensions.
- Discovery through `tools/list`, `snapmcp-hint`, `snapmcp://capabilities`, CLI JSON commands, `llms.txt`, and server instructions.
- Saved-path results and bounded inputs for smaller agent context.
- Node.js 20 primary; npm and npx work without Bun.

## Security copy

State the boundary accurately:

> URL tools accept HTTP(S) only. SSRF checks are default-on and block private/local IPv4 and IPv6 literals, IPv4-mapped IPv6, localhost variants, and DNS-resolved private addresses, with request revalidation. Capture traffic goes through a local validating proxy that resolves and validates every target itself and connects to the validated IP literal, so the address that was checked is the address that is used; the proxy trusts the system resolver, so use network isolation for hostile targets. File reads are deny-all until `SNAPMCP_ALLOWED_PATHS` is configured. All outputs stay inside `SNAPMCP_DIR`. Synthetic captures render in an isolated browser context with JavaScript disabled, external network resources blocked, and a restrictive CSP; Markdown raw HTML is escaped and raw HTML input is DOM-sanitized as defense in depth.

Do not claim:

- that snapmcp is a complete isolation boundary for hostile websites;
- perfect HTML sanitization;
- automatic authenticated profile reuse;
- npm provenance, a committed npm lockfile, or an `npm audit` gate unless the packaging pipeline independently guarantees them.

## Selection guidance

| User intent | Tool |
|---|---|
| Terminal or CLI output | `capture_terminal` |
| Source code in context | `capture_code` |
| Allowed source file | `capture_file` |
| Website or app screenshot | `capture_browser` |
| Markdown, HTML, or diff | `capture_markdown`, `capture_html`, `capture_diff` |
| URL as PDF | `capture_pdf` |
| Independent images | `capture_batch` |
| Ordered walkthrough | `capture_sequence` |
| Animation | `capture_gif` |
| Captioned report or guide | `capture_document` |
| Tool selection help | `snapmcp-hint` |

## Short launch copy

snapmcp gives coding agents a focused way to produce the visual artifacts documentation needs. It has exactly 13 tools for terminal output, highlighted code, browser pages, diffs, PDFs, GIFs, ordered steps, captioned documents, and discovery. Capture results are saved file paths, so the agent does not need to push image bytes through the model context.

Install with npm, initialize Chromium explicitly, and let `snapmcp-hint` guide tool selection.

## Canonical links

- Repository: https://github.com/reeinharddd/snapmcp
- Agent guide: https://github.com/reeinharddd/snapmcp/blob/main/docs/agents.md
- Tool reference: https://github.com/reeinharddd/snapmcp/blob/main/docs/tools.md
- Agent manifest: https://github.com/reeinharddd/snapmcp/blob/main/llms.txt
- Security policy: https://github.com/reeinharddd/snapmcp/blob/main/SECURITY.md

## Directory listings

| Directory | Listing | How it updates |
|---|---|---|
| npm | https://www.npmjs.com/package/snapmcp | Published by the release workflow with provenance |
| MCP Registry | https://registry.modelcontextprotocol.io/v0.1/servers/io.github.reeinharddd%2Fsnapmcp | Published by the release workflow from `server.json` |
| LobeHub Marketplace | https://lobehub.com/mcp/reeinharddd-snapmcp | `lhm plugin update --dir .`, using `lhm.plugin.json` |
| Glama | https://glama.ai/mcp/servers/reeinharddd/snapmcp | Re-crawled from the repository |
| ToolBench | https://toolbench.arcade.dev | Re-scored by the Arcade scoring workers |
| mcp.market | https://mcp.market/server/reeinharddd-snapmcp | Re-scanned from the MCP Registry |
| mcpservers.org | https://mcpservers.org | Manual review after submission |
| Docker MCP Catalog | https://github.com/docker/mcp-registry | Pull request against the catalog |

`lhm.plugin.json` is the marketplace manifest and the source of truth for the
LobeHub listing. It is generated from the running server, so it must be
regenerated whenever a tool, a description, or a schema changes:

```bash
bun run build
npx -y @lobehub/market-cli plugin init --stdio "node dist/index.js" --dir .
npx -y @lobehub/market-cli plugin update --dir .
```

A regression test compares the committed manifest against the `tools/list`
response of the built server, so a stale manifest fails the build.
