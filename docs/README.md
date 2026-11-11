# snapmcp documentation

snapmcp is a visual documentation MCP server with exactly 13 tools. It renders terminal output, source code, HTTP(S) pages, Markdown, HTML, and diffs into PNG/JPEG, PDF, GIF, Markdown, and HTML artifacts.

[Getting Started](getting-started.md) · [Tools](tools.md) · [Agent Guide](agents.md) · [Configuration](configuration.md) · [CLI](cli.md) · [Guides](guides/index.md) · [GitHub](https://github.com/reeinharddd/snapmcp)

## Why snapmcp?

Use a browser-automation MCP server to interact with pages. Use snapmcp when the deliverable is an image, PDF, GIF, or captioned document intended for a person to read.

- Terminal captures use a heuristically detected palette from common terminal configurations. There is no ANSI parser.
- Code captures use Shiki with 300+ bundled languages and 27 built-in themes.
- Browser captures use Playwright Chromium by default. A system browser can be selected explicitly with `SNAPMCP_CHROME_EXECUTABLE`.
- File reads are deny-all until `SNAPMCP_ALLOWED_PATHS` is configured.
- Every output stays inside `SNAPMCP_DIR`.
- Capture/document results are saved file paths, not image bytes; the hint tool returns text.
- Synthetic captures run with JavaScript disabled, external network resources blocked, and a restrictive CSP; Markdown and HTML add content-specific escaping and sanitization.

## The 13 tools

| Tool | Purpose |
|---|---|
| `capture_terminal` | Terminal and CLI output |
| `capture_code` | Shiki-highlighted source code and inclusive line ranges |
| `capture_browser` | Full-page or viewport HTTP(S) screenshot |
| `capture_file` | Allowlisted file with extension-based language mapping and an inclusive line range |
| `capture_markdown` | GitHub-flavored Markdown document image |
| `capture_html` | Sanitized HTML/CSS document image |
| `capture_diff` | Unified diff image |
| `capture_pdf` | Complete URL document printed to PDF |
| `capture_batch` | Up to 10 independent captures |
| `capture_sequence` | Up to 60 ordered step images and optional GIF |
| `capture_gif` | GIF from 2 to 60 PNG captures |
| `capture_document` | Up to 30 captioned captures in Markdown, HTML, or PDF |
| `snapmcp-hint` | Natural-language tool discovery and concise guidance |

There is no additional capture tool.

## Discovery

Agents can discover capabilities through:

- MCP `tools/list`;
- `snapmcp-hint` with a natural-language `query`;
- the MCP resource `snapmcp://capabilities`;
- `snapmcp capabilities --json`;
- `snapmcp search "<intent>" --json`;
- the repository-level [`llms.txt`](../llms.txt);
- MCP server instructions.

## Quick install

```bash
npm install -g snapmcp
snapmcp init
```

Node.js 20 or newer is primary; Bun 1.2 or newer is optional. npm and npx work without Bun. `snapmcp init` explicitly installs Playwright Chromium; package postinstall does not download it.

## Project documentation

- [Agent Guide](agents.md): selection, discovery, token efficiency, and examples
- [Tool Reference](tools.md): exact schemas for all 13 tools
- [Configuration](configuration.md): environment variables and browser behavior
- [CLI Reference](cli.md): setup, diagnostics, discovery, and verification
- [Security Policy](../SECURITY.md): enforced controls and known limits
- [Architecture](../ARCHITECTURE.md): capability catalog, request flow, and security model
- [Changelog](../CHANGELOG.md): release history
