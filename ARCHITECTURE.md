# snapmcp Architecture

**Version**: 2.3.9
**Runtime**: Node.js 20 or newer (primary); Bun 1.2 or newer (optional)
**Transport**: MCP over stdio
**License**: MIT

## Purpose

snapmcp is a visual documentation MCP server. It turns terminal text, source code, allowed files, HTTP(S) pages, Markdown, HTML, and diffs into PNG/JPEG, PDF, GIF, Markdown, or HTML artifacts. It also provides ordered-step and document workflows without adding separate capture tools.

The public surface contains exactly 13 tools:

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

## Design principles

- **Human-readable artifacts first.** snapmcp complements browser-automation servers; it does not click, fill forms, or navigate interactively.
- **One focused capture model.** The seven primitive capture types are reused by batch, sequence, GIF, and document workflows.
- **Small agent context.** Capture/document results contain saved file paths, not image bytes; the hint tool returns text. Inputs are bounded.
- **Discoverable by intent.** The same capability catalog is exposed through MCP and CLI discovery surfaces.
- **Local-first setup.** Node and npm/npx are the primary path. Bun is optional. Browser installation is an explicit setup step.
- **Security defaults with honest limits.** SSRF checks and deny-all file reads are enabled by default, while the browser's DNS and sanitizer limitations remain visible.

## Module map

```text
src/
├── index.ts          # Server bootstrap, 13 tool registrations, resource, lifecycle
├── capabilities.ts   # Capability catalog, search ranking, manifest, server instructions
├── config.ts         # Environment configuration and theme selection
├── renderer.ts       # Chromium rendering and primitive capture functions
├── security.ts       # URL, input, file-read, and output-path validation
├── terminal.ts       # Heuristic terminal-theme detection
├── browser.ts        # System-browser detection and profile discovery
├── highlighter.ts    # Shiki highlighting
├── document.ts       # Markdown, HTML, and PDF document assembly
├── gif.ts            # GIF encoding from PNG frames
├── logger.ts         # Structured audit logging
├── brand.ts          # Shared design tokens
├── setup-shared.ts   # Setup and diagnostic helpers
├── register.ts       # Optional client configuration helpers
├── playwright-cli.ts # Explicit Playwright Chromium installation
├── cli.ts            # Server, setup, doctor, test, capabilities, and search commands
└── tools/            # One registration module for each public tool
```

## Capability catalog and discovery

`src/capabilities.ts` is the code-level catalog of the 13 tools. Each entry records a stable name, a short summary, a selection hint, output types, and limits.

The catalog is exposed through several views:

| Surface | Role |
|---|---|
| MCP `tools/list` | Canonical protocol-level tool and schema discovery |
| `snapmcp-hint` with `query` | Deterministic natural-language intent search returning a small ranked set |
| `snapmcp://capabilities` | JSON resource containing the complete manifest, security defaults, and token policy |
| `snapmcp capabilities --json` | Compact manifest for shell and code-mode workflows |
| `snapmcp search "<intent>" --json` | Ranked capability matches for a specific intent |
| `llms.txt` | Static, link-oriented agent guidance |
| Server instructions | Concise in-protocol selection and safety guidance |

The CLI and MCP resource views are generated from the same in-process catalog so their names, limits, and security summaries do not drift independently.

## Request lifecycle

```text
MCP client
   |
   | JSON-RPC over stdio
   v
+MCP server
   | 1. Validate the tool-specific schema
   | 2. Validate URL, file, input, and output paths as applicable
   | 3. Render primitive captures through Chromium
   | 4. Assemble composite outputs where requested
   | 5. Write only inside SNAPMCP_DIR
   | 6. Return saved file paths
   v
+Agent receives paths, not image bytes
```

Primitive URL, file, and synthetic-content validation occurs at the capture boundary. Composite tools dispatch through those same primitive capture functions, so URL and file policies apply to nested entries as well as direct tool calls.

## Primitive and composite capture flow

The primitive capture types are:

- terminal text;
- source code;
- an allowlisted file;
- a browser URL;
- Markdown;
- HTML;
- a unified diff.

`capture_batch` processes up to 10 independent items and returns individual image paths. `capture_sequence` processes up to 60 ordered steps, saves each step as an individual image, and can optionally compile those steps into a GIF. It does not create a side-by-side composite. `capture_gif` accepts 2 to 60 captures and produces a GIF. `capture_document` accepts up to 30 captioned captures and embeds generated captures in Markdown, self-contained HTML, or a print-quality PDF.

Composite capture definitions are flat discriminated unions. Each entry has a `type` discriminator and the fields for that type at the same level; there is no nested `params` object.

Example:

```json
{
  "captures": [
    {
      "type": "terminal",
      "title": "build",
      "lines": ["$ npm run build", "Build complete"]
    },
    {
      "type": "code",
      "language": "typescript",
      "code": "export const ready = true;"
    }
  ]
}
```

## Rendering architecture

### Chromium

Browser-backed rendering uses Playwright Chromium by default. A system Chrome/Chromium binary can be selected explicitly with `SNAPMCP_CHROME_EXECUTABLE`, or a Playwright channel can be selected with `SNAPMCP_CHROME_CHANNEL`.

`SNAPMCP_CHROME_PROFILE` launches Chromium with a persistent user-data directory. A detected profile key or display name selects the detected Chrome user-data directory and adds `--profile-directory=<key>`; an absolute path is used as the user-data directory directly. Profile mode requires a system Chrome installation. URL captures create pages in that persistent context, so explicitly selected profile cookies and session state can be sent to the target site; synthetic captures remain isolated.

Package installation does not download Chromium. `snapmcp init` explicitly installs Playwright Chromium; users may also install it with `npx playwright install chromium`.

### Rendering modes

- Terminal, code, and diff captures are synthetic, framed HTML rendered by Chromium.
- Markdown is converted to a document template. Raw HTML in Markdown is escaped.
- Raw HTML is wrapped and sanitized before rendering.
- Browser captures navigate to an HTTP(S) URL.
- URL PDFs use Chromium's print/PDF output. There is no meaningful promise that a `fullPage`-style option selects between print and full-page rendering.
- Document PDFs embed the generated capture images into a print-quality PDF.

### Highlighting and terminal colors

Shiki provides highlighting for 300+ bundled languages and 27 built-in themes. The exact language identifier should be supplied when known; `text` is the fallback.

Terminal colors are selected heuristically from common terminal configuration files and environment fallbacks. snapmcp does not parse ANSI escape sequences. Terminal prompt lines beginning with `$ ` are user prompts; lines beginning with `# ` are root prompts.

### GIF encoding

GIF frames are PNG captures. `loop: true` means infinite looping; `loop: false` means play once. Sequence workflows preserve ordered step images and may add a GIF alongside them.

## Security architecture

### URL boundary

Only HTTP(S) URLs are accepted by URL tools. With default-on SSRF protection, validation rejects private and local IPv4 and IPv6 literals, IPv4-mapped IPv6 addresses, localhost variants, and DNS names resolving to local or private addresses. Browser requests are revalidated as they occur.

Chromium reaches capture targets through a local validating proxy that resolves and validates every target and connects to the validated IP literal, so the validated address is the connected address. The proxy resolves through the system resolver, so hostile-target isolation still belongs in the deployment boundary.

### File-read boundary

File reads are deny-all unless `SNAPMCP_ALLOWED_PATHS` is set. The allowlist accepts files or directories, resolves real paths, and applies a separator-aware boundary check. Composite `file` entries use the same policy.

### Output boundary

`SNAPMCP_DIR` is the root for every generated artifact. Output paths are resolved against that root, checked for traversal, and checked for symlink escapes. Composite tools do not bypass this boundary.

### Synthetic-content boundary

Synthetic captures, including terminal, code, diff, Markdown, HTML, and generated document PDFs, render in an isolated browser context with JavaScript disabled, external network resources blocked, and a restrictive Content Security Policy. Markdown raw HTML is escaped, and raw HTML input is DOM-sanitized so scripts, frames, and embedded external content are removed or blocked.

Sanitization is defense in depth, not a proof of perfect safety. The Chromium sandbox and deployment-level isolation remain important for hostile content.

### Validation switches

`SNAPMCP_SECURITY_CHECKS=false` disables the broader validation layer, including the file-read allowlist and additional byte/file-size checks. `SNAPMCP_SSRF_PROTECTION=false` disables SSRF checks specifically. Output confinement and HTTP(S)-only URL validation remain in force. The defaults are appropriate for normal local use; neither switch is recommended for shared services.

## Token and result policy

Capture/document tools return saved paths and short textual summaries instead of embedding image bytes in MCP responses; `snapmcp-hint` returns text guidance. Input limits, the 10-item batch limit, the 60-step sequence limit, and focused hint search keep tool descriptions and result payloads suitable for agent context.

For a large workflow, prefer one `capture_batch` call over many unrelated calls, and use `snapmcp-hint` or the capability resource before loading the full tool reference.

## Setup and runtime

Primary installation path:

```bash
npm install -g snapmcp
snapmcp init
```

This path does not require Bun. The package postinstall step performs lightweight browser detection and guidance only; it does not download Chromium.

Bun may be used for local development and test execution. Docker is an optional packaging surface with Chromium included and a non-root runtime; it is not required by the Node/npm workflow.

## Dependency boundaries

- `@modelcontextprotocol/sdk`: MCP server, tools, resources, and stdio transport
- `playwright`: Chromium rendering and PDF output
- `shiki`: syntax highlighting
- `marked`: Markdown-to-HTML conversion before the synthetic-content boundary
- `gifenc`: GIF encoding
- `fast-png`: PNG frame encoding for GIF output

## Testing approach

Tests cover configuration, security boundaries, rendering helpers, browser behavior, highlighter integration, document and GIF generation, CLI behavior, and MCP integration. Integration tests that require Chromium need the browser installed explicitly. Test counts change with the suite, so documentation does not treat a fixed count as a release guarantee.
