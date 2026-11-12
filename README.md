<p align="center">
  <img src="./brand/logo/snapmcp-logo-horizontal.svg" alt="snapmcp" width="380" />
</p>

<p align="center">
  <b>The visual documentation MCP server.</b><br/>
  Terminal · Code · Browser · Markdown · HTML · Diff · PDF · GIF · Documents<br/>
  <em>For documentation workflows where structured snapshots are not the final artifact.</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/snapmcp"><img src="https://img.shields.io/npm/v/snapmcp?style=flat&label=npm&color=%2300d4aa" alt="npm version"/></a>
  <a href="https://www.npmjs.com/package/snapmcp"><img src="https://img.shields.io/npm/dm/snapmcp?style=flat&label=downloads&color=%2300d4aa" alt="npm downloads"/></a>
  <a href="https://github.com/reeinharddd/snapmcp/actions/workflows/ci.yml"><img src="https://github.com/reeinharddd/snapmcp/actions/workflows/ci.yml/badge.svg" alt="tests"/></a>
  <a href="https://github.com/reeinharddd/snapmcp"><img src="https://img.shields.io/github/stars/reeinharddd/snapmcp?style=flat&color=%2300d4aa" alt="stars"/></a>
  <img src="https://img.shields.io/badge/license-MIT-%2300d4aa" alt="MIT"/>
</p>

---

**snapmcp 2.3.10** turns agent-provided content into visual documentation artifacts: syntax-highlighted code, terminal sessions, browser pages, diffs, PDFs, GIFs, and captioned documents. It exposes exactly 13 MCP tools. The 12 capture/document tools return saved file paths rather than image bytes, while `snapmcp-hint` returns text guidance, keeping agent context small. Every tool also returns a structured payload with the saved path, format, and size.

## Quick start

### 1. Install and initialize

Node.js 20 or newer is the primary runtime. Bun 1.2 or newer is optional.

```bash
npm install -g snapmcp
snapmcp init
```

`npm` and `npx` work without Bun. Package installation does not download a browser; `snapmcp init` explicitly installs Playwright Chromium for the reproducible default browser.

To try the server without a global install:

```bash
npx -y snapmcp init
npx -y snapmcp
```

### 2. Register it with an MCP client

Claude Code (`~/.claude/claude.json`):

```json
{
  "mcpServers": {
    "snapmcp": {
      "command": "npx",
      "args": ["-y", "snapmcp"],
      "env": {
        "SNAPMCP_DIR": "./captures",
        "SNAPMCP_THEME": "nord"
      }
    }
  }
}
```

OpenCode (`opencode.json` or `opencode.jsonc`) keeps local servers under `mcp.servers`:

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
          "SNAPMCP_FORMAT": "jpeg",
          "SNAPMCP_QUALITY": "95"
        }
      }
    }
  }
}
```

`snapmcp init` writes the current OpenCode V2 shape under `mcp.servers` for JSON and JSONC configuration files. JSONC comments, trailing commas, and unrelated settings are preserved. It also recognizes an existing deprecated `mcp.snapmcp` entry and leaves it unchanged to avoid creating a duplicate.

VS Code, Cline, and Roo-Cline use the same stdio command in their MCP server configuration.

### 3. Capture something

Ask the agent in natural language:

> Capture a terminal screenshot of `git log --oneline -5` and a syntax-highlighted image of `src/index.ts`.

The agent selects `capture_terminal` and `capture_file`. The `capture_file` call succeeds only when `src/index.ts` is covered by `SNAPMCP_ALLOWED_PATHS`; otherwise the agent can use `capture_code` with source text already in context. Generated files are saved under `SNAPMCP_DIR`, and the tool response contains their paths.

## Why snapmcp versus Playwright MCP

Use Playwright MCP for browser interaction: clicking, filling forms, navigating, and reading accessibility trees. Use snapmcp when the deliverable is a visual artifact for a person to read.

| Use case | snapmcp | Playwright MCP |
|---|:---:|:---:|
| Terminal capture with detected terminal colors | Yes | No |
| Code to syntax-highlighted image | Yes | No |
| Git diff to visual red/green image | Yes | No |
| URL to PDF | Yes | No |
| Captures to animated GIF | Yes | No |
| Browser page screenshot | Yes | Yes |
| Browser interaction and automation | No | Yes |

## The 13 tools

| Tool | Use it for | Result |
|---|---|---|
| `capture_terminal` | Terminal or CLI output, including `$` and root `#` prompts | PNG/JPEG path |
| `capture_code` | Source code with Shiki highlighting for 300+ bundled languages, 27 themes, and an optional inclusive line range | PNG/JPEG path |
| `capture_browser` | Full-page or viewport screenshot of an HTTP(S) page | PNG/JPEG path |
| `capture_file` | An allowlisted file, with extension-based language mapping and optional inclusive line range | PNG/JPEG path |
| `capture_markdown` | GitHub-flavored Markdown rendered as a document | PNG/JPEG path |
| `capture_html` | Sanitized HTML/CSS rendered as a document | PNG/JPEG path |
| `capture_diff` | Unified diff with additions and deletions highlighted | PNG/JPEG path |
| `capture_pdf` | The complete HTTP(S) URL document printed with Chromium | PDF path |
| `capture_batch` | Up to 10 independent captures in one call | Image paths |
| `capture_sequence` | Up to 60 ordered step images, with an optional GIF | Image paths and optional GIF path |
| `capture_gif` | An animation built from 2 to 60 captures | GIF path |
| `capture_document` | Up to 30 captioned captures embedded in a document | Markdown/HTML/PDF/PPTX/DOCX path |
| `snapmcp-hint` | Tool discovery, setup, security, and token guidance | Text |

There is no additional capture tool. `capture_batch`, `capture_sequence`, `capture_gif`, and `capture_document` compose the same seven capture types: terminal, code, file, browser, Markdown, HTML, and diff.

## Discovery for agents

Agents do not need to load the full documentation before choosing a tool:

- MCP `tools/list` is the canonical tool catalog.
- `snapmcp-hint` accepts a natural-language `query`, such as `"website screenshot"` or `"pdf export"`.
- The MCP resource `snapmcp://capabilities` returns the machine-readable capability manifest.
- `snapmcp capabilities --json` prints the same compact manifest for shell and code-mode workflows.
- `snapmcp search "<intent>" --json` returns ranked matches for an intent.
- [`llms.txt`](./llms.txt) and the server instructions provide concise selection guidance.

See the [agent guide](./docs/agents.md) for selection rules, token-efficient behavior, and OpenCode/code-mode examples.

## Common workflows

**Automated documentation.** Capture terminal output, highlighted source, and a visual diff, then embed the generated images in a guide or PR description.

**Visual QA.** Capture affected pages with `capture_browser`, produce several independent images with `capture_batch`, or record an ordered walkthrough with `capture_sequence`.

**Technical tutorials.** Use `capture_sequence` for ordered step images and `capture_document` when the final artifact should be a captioned Markdown, self-contained HTML, print-quality PDF, editable PowerPoint, or editable Word document.

## Security boundaries

The defaults are designed for local use, not as a complete isolation boundary for hostile content.

- URL tools accept HTTP(S) only. With `SNAPMCP_SSRF_PROTECTION=true` by default, private and local IPv4/IPv6 literals, IPv4-mapped IPv6 addresses, localhost variants, and DNS names resolving to private addresses are blocked. Requests are revalidated as they occur.
- URL captures run through a local validating proxy that resolves and pins every target, including each redirect hop, so the address that was validated is the address that is connected to. Chromium is launched with a resolver rule that stops it from resolving target hostnames itself.
- File reads are deny-all until `SNAPMCP_ALLOWED_PATHS` is configured. Allowed files are resolved before the boundary check so symlinks cannot escape the allowlist.
- Every output is confined to `SNAPMCP_DIR`, including composite-tool outputs. Traversal and symlink escapes are rejected.
- Synthetic captures, including terminal, code, diff, Markdown, HTML, and generated document PDFs, render in an isolated browser context with JavaScript disabled, external network resources blocked, and a restrictive Content Security Policy. Markdown and HTML add content-specific handling: raw HTML in Markdown is escaped and raw HTML input is DOM-sanitized. These are defense-in-depth controls, not a guarantee of perfect sanitizer safety.
- Inputs are bounded: terminal 1,000 lines; code, Markdown, and HTML 200 KB each; diff 500 KB; file 5 MB by default; batch 10 items; sequence 60 steps; GIF 2 to 60 frames; document 30 captures with up to 25 MB per embedded image and 75 MB total.
- `SNAPMCP_SSRF_PROTECTION=false` disables SSRF checks. `SNAPMCP_SECURITY_CHECKS=false` disables the broader validation layer, including the file-read allowlist and additional byte/file-size checks. Output confinement and HTTP(S)-only URL validation remain in force. Do not disable either in shared or hostile environments.

Read [SECURITY.md](./SECURITY.md) for the enforced controls and their limits.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `SNAPMCP_DIR` | `./captures` | Confined output directory for every generated file |
| `SNAPMCP_THEME` | detected terminal theme | One of 27 built-in Shiki themes |
| `SNAPMCP_FORMAT` | `png` | Image format: `png` or `jpeg` |
| `SNAPMCP_QUALITY` | `90` | JPEG quality from 1 to 100 |
| `SNAPMCP_PADDING` | `32` | Content padding in pixels |
| `SNAPMCP_SHADOW` | `none` | `none`, `soft`, `medium`, or `strong` |
| `SNAPMCP_WINDOW_CHROME` | `false` | Show a macOS-style title bar |
| `SNAPMCP_BORDER_RADIUS` | `0` | Window corner radius in pixels |
| `SNAPMCP_BADGE` | `false` | Show the snapmcp footer badge |
| `SNAPMCP_LOG_FILE` | unset | Optional structured audit log path |
| `SNAPMCP_CHROME_EXECUTABLE` | unset | Explicit system Chrome/Chromium executable; bundled Playwright Chromium is the default |
| `SNAPMCP_CHROME_CHANNEL` | unset | Playwright Chrome channel such as `stable`, `beta`, `dev`, or `canary` |
| `SNAPMCP_CHROME_PROFILE` | unset | Experimental persistent Chromium user-data directory: detected profile key/name or absolute path |
| `SNAPMCP_ALLOWED_PATHS` | deny-all | Comma- or semicolon-separated file-read allowlist |
| `SNAPMCP_SSRF_PROTECTION` | `true` | Block private and local URL targets |
| `SNAPMCP_SECURITY_CHECKS` | `true` | Enable the broader validation layer |

Terminal color detection is heuristic: it reads colors from common terminal configuration files when possible. It does not parse ANSI escape sequences.

Browser profile support is experimental and is never selected automatically. `SNAPMCP_CHROME_PROFILE` launches Chromium with a persistent user-data directory; URL captures run in that context, so cookies and session state can be sent to the target site. Synthetic captures remain isolated. Use a dedicated profile and treat it as sensitive.

## CLI

```text
snapmcp                         Start the MCP server on stdio
snapmcp init                    Install Chromium and configure the environment
snapmcp doctor                  Diagnose runtime, browser, paths, and configuration
snapmcp doctor --json           Machine-readable diagnostics
snapmcp test                    Generate verification captures
snapmcp capabilities --json     Print the capability manifest
snapmcp search "<intent>" --json
                                Search tools by intent
```

## Docker (optional)

Docker is an optional packaging surface. The image includes Chromium, runs as a non-root user, and speaks MCP over stdio:

```bash
docker run -i --rm \
  -e SNAPMCP_DIR=/app/captures \
  -v /path/to/output:/app/captures \
  ghcr.io/reeinharddd/snapmcp
```

The mounted output directory must be writable by the container's non-root user.

## Documentation

| Page | Contents |
|---|---|
| [Getting Started](docs/getting-started.md) | Installation, initialization, and client setup |
| [Tools Reference](docs/tools.md) | All 13 tools and the flat discriminated-union schemas |
| [Agent Guide](docs/agents.md) | Tool selection, discovery, token policy, and safety limits |
| [Configuration](docs/configuration.md) | Environment variables, browser behavior, and theme notes |
| [CLI Reference](docs/cli.md) | Setup, diagnostics, discovery, and verification commands |
| [Guides](docs/guides/index.md) | Terminal, browser, GIF, and workflow examples |
| [Security Policy](SECURITY.md) | Enforced controls and known limits |
| [Architecture](ARCHITECTURE.md) | Capability catalog, request flow, and security architecture |
| [`llms.txt`](llms.txt) | Concise link-oriented guidance for agents |

## Development

```bash
git clone https://github.com/reeinharddd/snapmcp
cd snapmcp
bun install
bun run build
bun test
```

Node.js 20 or newer is the primary runtime. Bun is optional for package installation and local development.

## License

MIT. See [LICENSE](./LICENSE).
