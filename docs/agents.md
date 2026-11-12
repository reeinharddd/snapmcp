# Agent and Code-Mode Guide

snapmcp is for agents that need to produce visual documentation artifacts. It has exactly 13 MCP tools. The 12 capture/document tools return saved file paths instead of image bytes; `snapmcp-hint` returns text guidance. Inputs are bounded and security boundaries are explicit.

## Select the narrowest tool

| Intent | Tool | Notes |
|---|---|---|
| CLI or terminal output | `capture_terminal` | Use `$ ` for user prompts and `# ` for root prompts |
| Source already in context | `capture_code` | Shiki supports 300+ bundled languages and 27 themes |
| File on disk | `capture_file` | Requires `SNAPMCP_ALLOWED_PATHS`; supports an inclusive line range |
| Website or web app | `capture_browser` | HTTP(S) only; full-page or viewport |
| Markdown | `capture_markdown` | Raw HTML is escaped |
| HTML/CSS | `capture_html` | Active and external content is sanitized or blocked |
| Unified diff | `capture_diff` | Additions and deletions are highlighted |
| URL as PDF | `capture_pdf` | Chromium prints the complete document |
| Several independent images | `capture_batch` | Maximum 10 items |
| Ordered tutorial or workflow | `capture_sequence` | Individual step images plus an optional GIF |
| Explicit animation | `capture_gif` | 2 to 60 PNG frames |
| Captioned report or guide | `capture_document` | Maximum 30 captures; Markdown, HTML, or PDF |
| Unsure which tool to use | `snapmcp-hint` | Send a natural-language `query` |

Do not use snapmcp for browser interaction. A browser-automation MCP server is the right tool for clicking, filling forms, or reading accessibility trees.

## Discovery workflow

Use the smallest discovery surface that answers the question:

1. Read MCP `tools/list` when the client already provides schemas.
2. Call `snapmcp-hint` with a natural-language `query` when the tool choice is unclear.
3. Read the MCP resource `snapmcp://capabilities` when the complete machine-readable manifest is needed.
4. Run `snapmcp capabilities --json` in a shell or code-mode workflow.
5. Run `snapmcp search "<intent>" --json` for ranked matches to a specific intent.
6. Read [`llms.txt`](../llms.txt) for static, link-oriented guidance.

Example intent searches:

```json
{
  "name": "snapmcp-hint",
  "arguments": {
    "query": "website screenshot"
  }
}
```

```bash
snapmcp search "animated before and after" --json
```

## Token-efficient behavior

- Tool results contain saved paths and short summaries, not image bytes.
- Prefer one focused capture tool for one artifact.
- Use `capture_batch` for independent images instead of unrelated parallel calls.
- Use `capture_sequence` when order matters; it saves individual images rather than making a side-by-side composite.
- Use `capture_gif` only when animation is the requested deliverable.
- Use `capture_document` only when the final artifact must contain captioned captures.
- Use `snapmcp-hint` before loading the complete tools reference.
- Do not add speculative parameters. Use only the fields documented for the selected tool and capture type.

## Composite schemas are flat

Composite tools use discriminated unions. The discriminator and type-specific fields are siblings; there is no nested `params` object.

```json
{
  "captures": [
    {
      "type": "terminal",
      "title": "install",
      "lines": ["$ npm install", "added 42 packages"]
    },
    {
      "type": "code",
      "language": "typescript",
      "code": "export const ready = true;",
      "title": "ready.ts"
    }
  ]
}
```

Supported primitive discriminators are `terminal`, `code`, `file`, `browser`, `markdown`, `html`, and `diff`.

- `capture_batch` accepts `captures`.
- `capture_sequence` accepts `steps`; each step can also have `stepNumber` and `label`.
- `capture_gif` accepts `captures`.
- `capture_document` accepts `captures`; each capture can also have `caption`.

## Code-mode example

Load the stable manifest once when a code-mode agent needs to route several requests:

```bash
snapmcp capabilities --json > /tmp/opencode/snapmcp-capabilities.json
```

Then search locally or through the CLI before calling a capture tool:

```bash
snapmcp search "printable report with captures" --json
```

For an MCP client, call `snapmcp-hint` instead of parsing the full manifest:

```json
{
  "name": "snapmcp-hint",
  "arguments": {
    "query": "printable report with captures"
  }
}
```

## OpenCode example

Register snapmcp as a local stdio server under `mcp.servers`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "snapmcp": {
        "type": "local",
        "command": ["npx", "-y", "snapmcp"],
        "environment": {
          "SNAPMCP_DIR": "./captures",
          "SNAPMCP_THEME": "nord"
        }
      }
    }
  }
}
```

`snapmcp init` writes the current OpenCode V2 shape under `mcp.servers` for JSON and JSONC configuration files while preserving comments and unrelated settings. It recognizes an existing deprecated `mcp.snapmcp` entry and leaves it unchanged to avoid creating a duplicate.

Run `npx -y snapmcp init` once to install Playwright Chromium. The package postinstall step does not download Chromium.

A useful OpenCode request is:

> Use snapmcp-hint to choose the narrowest capture tool, then save a terminal capture and an inclusive code range under ./captures. Return the saved paths.

## Safety boundaries

- URL tools accept HTTP(S) only.
- SSRF protection is default-on and blocks private/local IPv4 and IPv6 literals, IPv4-mapped IPv6, localhost variants, and DNS-resolved private addresses. Requests are revalidated.
- URL captures run through a local validating proxy that resolves and validates every target itself and connects to the validated IP literal, so there is no DNS-rebinding window between check and connection. Use network isolation for hostile targets anyway.
- File reads are deny-all until `SNAPMCP_ALLOWED_PATHS` is configured.
- All outputs, including composite outputs, stay inside `SNAPMCP_DIR`; traversal and symlink escapes are rejected.
- Synthetic captures, including terminal, code, diff, Markdown, HTML, and generated document PDFs, render in an isolated browser context with JavaScript disabled, external network resources blocked, and a restrictive CSP. Markdown raw HTML is escaped and raw HTML input is DOM-sanitized. This is defense in depth, not a perfect sanitizer guarantee.
- Limits: terminal 1,000 lines; code, Markdown, and HTML 200 KB each; diff 500 KB; file 5 MB by default; batch 10; sequence 60; GIF 2 to 60; document 30 captures with up to 25 MB per embedded image and 75 MB total.
- `loop: true` makes a GIF repeat forever; `loop: false` plays it once.
- `capture_sequence` creates ordered individual images and an optional GIF. It does not create a side-by-side composite.
- `capture_pdf` prints the complete URL document. `capture_document` with `format: "pdf"` embeds generated captures in a print-quality PDF.
- Browser profile support is experimental and never selected automatically. URL captures run in the explicitly selected persistent profile context, so profile cookies and session state can be sent to the target site; synthetic captures remain isolated.

See [SECURITY.md](../SECURITY.md) for the enforced behavior and its limits.
