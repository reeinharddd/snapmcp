# MCP Discovery and Registry Metadata

This document describes the local discovery surfaces and metadata shape for snapmcp 2.3.7. It does not publish or modify any remote registry.

## Server identity

| Field | Value |
|---|---|
| Name | `io.github.reeinharddd/snapmcp` |
| Display name | snapmcp |
| Version | `2.3.7` |
| Transport | stdio |
| Primary runtime | Node.js 20 or newer |
| Optional runtime | Bun 1.2 or newer |
| Package | `snapmcp` on npm |
| Repository | https://github.com/reeinharddd/snapmcp |
| License | MIT |

## Exact tool catalog

The public catalog contains exactly 13 tools:

1. `capture_terminal`
2. `capture_code`
3. `capture_browser`
4. `capture_file`
5. `capture_markdown`
6. `capture_html`
7. `capture_diff`
8. `capture_pdf`
9. `capture_batch`
10. `capture_sequence`
11. `capture_gif`
12. `capture_document`
13. `snapmcp-hint`

Do not describe an additional capture tool. Composite workflows use `capture_batch`, `capture_sequence`, `capture_gif`, or `capture_document`.

## Discovery surfaces

| Surface | Purpose |
|---|---|
| MCP `tools/list` | Canonical protocol-level tool and schema catalog |
| `snapmcp-hint` with `query` | Natural-language intent search |
| `snapmcp://capabilities` | Machine-readable MCP resource |
| `snapmcp capabilities --json` | Machine-readable CLI manifest |
| `snapmcp search "<intent>" --json` | Ranked CLI intent search |
| `llms.txt` | Static, link-oriented agent guidance |
| Server instructions | Concise in-protocol selection guidance |

## Metadata files

### `server.json`

`server.json` uses the MCP server schema at:

`https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json`

It records the server identity, npm package, transport, environment variables, and the 13 tool names and descriptions. The package and server versions are both `2.3.7`.

### `glama.json`

`glama.json` records the same server identity, exact tool list, runtime requirements, discovery commands, environment-variable defaults, and concise security boundaries. It is metadata only and does not publish the server.

## Factual product copy

Use this as the baseline description:

> snapmcp is a visual documentation MCP server with exactly 13 tools for terminal output, Shiki-highlighted code, HTTP(S) screenshots and PDFs, Markdown, HTML, diffs, GIFs, ordered sequences, and captioned documents. Capture tools return saved file paths, and the hint tool returns text. Inputs are bounded, output is confined to `SNAPMCP_DIR`, file reads are denied by default, and SSRF checks are enabled by default.

Add the relevant details instead of repeating keywords:

- **Use cases:** README images, CLI tutorials, PR evidence, visual QA, API or onboarding guides.
- **Outputs:** PNG/JPEG, PDF, GIF, Markdown, HTML, PowerPoint, and Word artifacts saved under `SNAPMCP_DIR`, each returned with a structured payload.
- **Selection:** Use `snapmcp-hint` or the capability resource when the appropriate tool is unclear.
- **Security boundary:** HTTP(S)-only URL tools, default-on SSRF checks, deny-all file reads, output confinement, and isolated synthetic content.
- **Honest limits:** the validating proxy trusts the system resolver, and synthetic-content sanitization is defense in depth rather than a perfect-safety guarantee.

## Local verification

```bash
node -e "JSON.parse(require('fs').readFileSync('server.json', 'utf8'))"
node -e "JSON.parse(require('fs').readFileSync('glama.json', 'utf8'))"
node -e "const s=JSON.parse(require('fs').readFileSync('server.json','utf8')); console.log(s.tools.list.length, s.tools.list.map(t=>t.name).join('\n'))"
```

For schema validation, use a JSON Schema validator that supports draft-07 and the schema URL recorded in `server.json`. Validation is local and does not require a registry publication.

## Related

- [Agent Guide](agents.md)
- [Tool Reference](tools.md)
- [Security Policy](../SECURITY.md)
- [Architecture](../ARCHITECTURE.md)
