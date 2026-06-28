# snapmcp Architecture

> All-in-one MCP server for visual captures: terminal, code, browser, markdown, diffs,
> HTML, PDF, and GIF — via Playwright.

**Version**: 2.2.0  
**Runtime**: Bun (primary) / Node >=20  
**License**: MIT  
**Repository**: [github.com/reeinharddd/snapmcp](https://github.com/reeinharddd/snapmcp)

---

## Table of Contents

- [Philosophy](#philosophy)
- [Module Map](#module-map)
- [Data Flow](#data-flow)
- [Request Lifecycle](#request-lifecycle)
- [Key Design Decisions](#key-design-decisions)
- [Cross-Platform Architecture](#cross-platform-architecture)
- [Security Architecture](#security-architecture)
- [MCP Protocol Details](#mcp-protocol-details)
- [Dependency Graph](#dependency-graph)
- [Testing Strategy](#testing-strategy)

---

## Philosophy

snapmcp exists because LLM workflows need visual evidence (screenshots of terminals,
code, web pages) but no single MCP server handled all types. Every capture type
funnels through a **shared rendering engine**: build HTML → screenshot with Playwright.

**Core tenets:**

1. **Real fidelity first** — use the user's actual terminal colors and browser profile
   when available; fall back to synthetic themes.
2. **In-project captures** — output goes to `./captures` in the current project,
   visible and trackable.
3. **Zero-config startup** — `snapmcp` with no arguments starts a working server.
   Configuration is opt-in via `SNAPMCP_*` env vars.
4. **Security by design, not by default** — SSRF protection is opt-in. Path
   traversal and input limits are always on.

---

## Module Map

```
src/
├── index.ts          # Entry point: 13 MCP tools + CLI parsing
├── config.ts         # SnapConfig interface + env-based loading
├── renderer.ts       # Playwright screenshot engine + HTML templates
├── cli.ts            # CLI commands: init, doctor, test
├── security.ts       # URL validation, input limits, path safety
├── terminal.ts       # Real terminal detection + color reading
├── browser.ts        # System Chrome detection + profile
├── brand.ts          # Centralized design tokens (teal/indigo)
├── document.ts       # Document capture rendering
├── gif.ts            # GIF encoding (gifenc + fast-png)
├── highlighter.ts    # Shiki v4 syntax highlighting
├── logger.ts         # Structured audit logging
├── setup-shared.ts   # Shared bootstrap logic (installer wizard)
├── register.ts       # MCP auto-registration in client configs
└── gifenc.d.ts       # TypeScript declarations for gifenc
```

### Detailed Responsibilities

| File | Lines | Role | Key Exports |
|------|-------|------|-------------|
| `index.ts` | 771 | **Orchestrator**. Defines all MCP tools via `@modelcontextprotocol/sdk`. CLI entry point. SIGINT/SIGTERM cleanup. Wires SSRF, audit, Chrome status. | `main()` |
| `config.ts` | 157 | **Configuration**. Loads `SNAPMCP_*` env vars into typed `SnapConfig`. Terminal theme auto-detection fallback. | `SnapConfig`, `loadConfig()`, `DEFAULTS` |
| `renderer.ts` | 881 | **Capture engine**. All templates + Playwright screenshot logic. Three template modes: minimal (no frame), full-frame (window chrome), raw HTML. | `captureTerminal()`, `captureBrowser()`, `screenshotHtml()` |
| `cli.ts` | 326 | **CLI dispatcher**. Routes `init`/`doctor`/`test` commands. Uses shared bootstrap from `setup-shared.ts`. | `cliInit()`, `cliDoctor()`, `cliTest()` |
| `security.ts` | ~200 | **Validation layer**. URL SSRF denylist, input size limits, path traversal prevention, Chromium sandbox check. | `validateUrl()`, `resolveSafePath()`, `checkChromiumSandbox()` |
| `terminal.ts` | 191 | **Terminal detection**. Walks `/proc` process tree for emulator, reads config files. Fallback chain: config → COLORFGBG → OS theme. | `detectTerminalColors()`, `detectTerminalTheme()`, `terminalColorsToThemeOverrides()` |
| `browser.ts` | 224 | **Chrome detection**. 8-step priority (env var → platform paths → which). Cross-platform. Profile extraction from Local State. | `detectChrome()`, `logChromeStatus()`, `ChromeProfile` |
| `brand.ts` | ~50 | **Design tokens**. Teal `#06b6d4` and indigo `#6366f1` brand colors. Used in CLI banner, document rendering, badge gradient. | `BRAND`, `brandGradient`, `lighten()` |
| `document.ts` | — | **Document renderer**. Multi-section markdown → styled document. Uses brand colors. | — |
| `gif.ts` | — | **GIF encoder**. Wraps `gifenc` + `fast-png` (zero deps). | `createGif()` |
| `highlighter.ts` | — | **Syntax highlighter**. Shiki v4, 27 themes, 50+ languages. | `codeToHtml()` |
| `logger.ts` | — | **Audit log**. Typed `AuditEvent` entries. JSON log file via `SNAPMCP_LOG_FILE`. | `logger.audit()`, `setLogFile()`, `AuditEvent` |
| `setup-shared.ts` | — | **Bootstrap wizard**. Detects system state (deps, Chrome, output dir), interactive prompts. | `detectSystemState()`, `bootstrapSetup()`, `printSummary()` |
| `register.ts` | 330 | **MCP auto-registration**. Scans 5 client configs (OpenCode, Claude Desktop, Windsurf, Cursor, VS Code Cline). Creates `.bak` backups. | `detectMcpClients()`, `registerSnapmcp()` |
| `gifenc.d.ts` | — | **Type declarations** for `gifenc` library (`quantize`, `applyPalette`, `GIFEncoder`). | TypeScript interfaces |

---

## Data Flow

```
                          ┌─────────────────┐
                          │  MCP Client      │
                          │  (LLM agent)     │
                          └────────┬────────┘
                                   │ JSON-RPC over stdio
                                   ▼
┌─────────────────────────────────────────────────────────┐
│                    index.ts                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Tool defs │→│ Zod      │→│ Handler  │→│ Response│ │
│  │ (13)      │  │ Validate │  │ Logic    │  │         │ │
│  └──────────┘  └──────────┘  └────┬─────┘  └─────────┘ │
└──────────────────────────────────┼──────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
      ┌──────────────┐   ┌──────────────┐   ┌────────────────┐
      │ security.ts  │   │ renderer.ts  │   │  gif.ts        │
      │ validateUrl  │   │ build HTML   │   │  encode GIF    │
      │ input limits │   │ screenshot   │   │  (if animated) │
      │ path safety  │   │ save PNG/PDF │   └────────────────┘
      └──────────────┘   └──────┬───────┘
                                │
                                ▼
                      ┌─────────────────┐
                      │  ./captures/    │
                      │  terminal-…png  │
                      │  code-…png      │
                      │  browser-…pdf   │
                      └─────────────────┘
```

**For browser/PDF captures**, `renderer.ts` calls `browser.ts` (via `detectChrome()`) to
get the system Chrome path when configured, falling back to Playwright's bundled Chromium.

**For terminal captures**, the theme is resolved by `terminal.ts` → `detectTerminalColors()`
→ merged into config's `terminalColors` → applied by `renderer.ts` as CSS overrides.

---

## Request Lifecycle

Each MCP tool invocation follows this exact path:

```
1. index.ts: Zod schema validation (types, ranges, URL format)
2. index.ts: SSRF check (validateUrl if enabled)
3. index.ts: Audit event (logger.audit)
4. renderer.ts: Build HTML template (framedTemplate / documentTemplate / rawHtmlTemplate)
5. renderer.ts: Input validation (security.ts — size limits, path safety)
6. renderer.ts: Playwright page → setContent → screenshot
7. renderer.ts: Save to outputDir via resolveSafePath
8. index.ts: Return path to generated file
```

Error handling at every step: `try/catch` in tool handlers, error messages returned
as MCP `content` with `isError: true`.

---

## Key Design Decisions

### 1. SSRF Protection: Opt-In Only

**Status**: `ssrfProtection = false` by default (user must opt in via `SNAPMCP_SSRF_PROTECTION=true`)  
**Why**: The user explicitly said *"no bloquees nada por defecto — es libertad, responsabilidad del usuario."*  
**What it blocks when enabled**: `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `::1/128`, `169.254.0.0/16`, `0.0.0.0/8`  
**File**: `src/security.ts` → `validateUrl(raw, ssrfProtection)`

### 2. Frame Removal

**Status**: `windowChrome: false`, `shadow: none`, `borderRadius: 0` by default  
**Why**: The user said *"elimina completamente el marco, solo padding o espacio pero no adornos externos."*  
**How**: `framedTemplate()` splits into two rendering paths:
- **Minimal** (no chrome): just `body` with padding, no frame wrapper
- **Full-frame** (chrome enabled): macOS traffic lights, shadow, border-radius  
**File**: `src/renderer.ts` → `framedTemplate()`

### 3. Real Terminal Colors > Synthetic

**Status**: Terminal emulator config > COLORFGBG > OS theme > pre-set theme  
**Why**: Users noticed synthetic terminal colors didn't match their actual terminal  
**How**: `detectTerminalColors()` walks `/proc/<pid>/comm` up the process tree to find
the emulator, then reads its config:
- **Kitty**: `~/.config/kitty/kitty.conf`
- **Gnome Terminal**: `gsettings` dconf path
- **Alacritty**: `~/.config/alacritty/alacritty.toml`
- **WezTerm**: `~/.config/wezterm/wezterm.lua`
- **Xfce4 Terminal**: `~/.config/xfce4/terminal/terminalrc`
- **LXTerminal**: `~/.config/lxterminal/lxterminal.conf`  
**File**: `src/terminal.ts`

### 4. Real Browser Profile > Headless

**Status**: 8-step detection chain  
**Why**: Screenshots with real user data (logged-in sessions, extensions) are more useful  
**How**: `detectChrome()` checks in priority order:
1. `SNAPMCP_CHROME_EXECUTABLE` env var
2. Platform-specific known paths (Linux/Mac/Windows)
3. `which google-chrome-stable`, `which chromium`, etc.
4. Playwright bundled Chromium (fallback)  
**File**: `src/browser.ts`

### 5. In-Project Captures

**Status**: `outputDir = './captures'`  
**Why**: Captures should be visible in the current project directory, not hidden  
**Migration**: Changed from `./snapshots` (v2.1) to `./captures` (v2.2)  
**File**: `src/config.ts` → `DEFAULTS.outputDir`

### 6. gifenc + fast-png > gifencoder + pngjs

**Status**: Zero dependencies vs 7 high-severity vulnerabilities  
**Why**: `gifencoder` depends on `tar` which had 7 high-severity CVEs in its dependency chain  
**API change**: `gifenc.quantize()` returns a palette array, `gifenc.applyPalette()` creates indexed pixel data, `fast-png.encode()` handles PNG frame encoding  
**File**: `src/gif.ts`, `src/gifenc.d.ts`

### 7. Auto-MCP Registration

**Status**: Interactive, per-client, with `.bak` backup  
**Why**: Users shouldn't manually edit config files (the plan was always auto-configure)  
**Supported clients**: OpenCode, Claude Desktop, Windsurf, Cursor, VS Code Cline/Roo-Cline  
**File**: `src/register.ts`

### 8. Interactive Installer

**Status**: Agent-driven bootstrap, not just a script  
**Why**: Zero-config installation that detects deps and asks user validation at each step  
**Supports**: Global install (`npm install -g snapmcp`) and project-local install  
**File**: `src/setup-shared.ts`, `scripts/setup.ts`

---

## Cross-Platform Architecture

| Component | Linux | macOS | Windows |
|-----------|-------|-------|---------|
| **Chrome detection** | 6 paths (google-chrome, chromium, chrome, edge, chrome-beta, brave-browser) | 3 paths (Google Chrome.app, Edge.app) | 6 paths (%LOCALAPPDATA%, %PROGRAMFILES%) |
| **Chrome profile dir** | `~/.config/google-chrome` | `~/Library/Application Support/Google/Chrome` | `%LOCALAPPDATA%\Google\Chrome\User Data` |
| **Terminal detection** | `/proc` process tree walk + config parsing | Falls back to `defaults read` for dark mode, `$TERM_PROGRAM` | Falls back to `$COLORFGBG` + `$TERM` |
| **Terminal configs** | Kitty, Gnome, Alacritty, WezTerm, Xfce4, LXTerminal | iTerm2, Terminal.app (via defaults) | Windows Terminal (via settings.json) |
| **Output path** | `./captures` (POSIX) | `./captures` (POSIX) | `./captures` (normalized by path.join) |
| **Audit log** | JSON file (POSIX) | JSON file (POSIX) | JSON file (POSIX) |

The `/proc` filesystem-based terminal detection (`detectTerminalColors` → `detectTerminalEmulator`)
is Linux-specific. On macOS/Windows, it falls back to env vars and OS-level dark mode detection.

---

## Security Architecture

```
┌─────────────────────────────────────────────────┐
│                   index.ts                       │
│  ┌──────────────┐  ┌──────────────┐              │
│  │ Zod validation│  │ SSRF check  │              │
│  │ (all inputs)  │  │ (opt-in)    │              │
│  └──────────────┘  └──────┬───────┘              │
└───────────────────────────┼──────────────────────┘
                            │
┌───────────────────────────┼──────────────────────┐
│                   renderer.ts                    │
│  ┌──────────────┐  ┌──────────────┐              │
│  │ Input limits  │  │ Path safety  │              │
│  │ (size, lines) │  │ resolveSafe  │              │
│  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐              │
│  │ HTML escape  │  │ Finally block │              │
│  │ (all content)│  │ (no leaks)   │              │
│  └──────────────┘  └──────────────┘              │
└──────────────────────────────────────────────────┘
```

**Layered approach:**

1. **Input validation** (index.ts): Zod schemas for every tool parameter
2. **SSRF protection** (security.ts): URL denylist (opt-in)
3. **Input limits** (security.ts): Size caps per tool (code/markdown: 200KB, diff: 500KB, terminal: 1000 lines, file: 5MB)
4. **Path traversal prevention** (security.ts): `resolveSafePath()` validates all output filenames
5. **HTML escaping** (renderer.ts): All user content is HTML-escaped before rendering
6. **Resource cleanup** (renderer.ts): Browser pages closed in `finally` blocks
7. **Chromium sandbox** (security.ts): Detection at startup with clear guidance

---

## MCP Protocol Details

- **Transport**: stdio (JSON-RPC over stdin/stdout)
- **SDK**: `@modelcontextprotocol/sdk@1.29.0`
- **Server name**: `SnapMCP` (capitalized)
- **Server version**: `2.2.0`

### MCP Tools

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `capture_terminal` | `content: string`, `opts: ScreenshotOptions?` | `PNG/JPEG` | Terminal output with syntax-colored prompt |
| `capture_code` | `code: string`, `language: string`, `opts: ScreenshotOptions?` | `PNG/JPEG` | Syntax-highlighted code via Shiki |
| `capture_browser` | `url: string`, `opts: ScreenshotOptions?` | `PNG/JPEG` | Full-page or viewport browser screenshot |
| `capture_file` | `path: string`, `opts: ScreenshotOptions?` | `PNG/JPEG` | File → auto-detected language → highlighted |
| `capture_markdown` | `content: string`, `opts: ScreenshotOptions?` | `PNG/JPEG` | Rendered markdown as styled document |
| `capture_html` | `content: string`, `opts: ScreenshotOptions?` | `PNG/JPEG` | Arbitrary HTML rendered as image |
| `capture_diff` | `content: string`, `opts: ScreenshotOptions?` | `PNG/JPEG` | Git diff with green/red colorization |
| `capture_pdf` | `url: string`, `opts: PdfOptions?` | `PDF` | URL → PDF document |
| `capture_batch` | `items: CaptureItem[]` | `PNG/JPEG[]` | Batch capture multiple items |
| `capture_sequence` | `captures: CaptureItem[]`, `opts: SequenceOptions?` | `PNG[] + GIF` | Step sequence + optional GIF animation |
| `capture_gif` | `captures: CaptureItem[]`, `opts: GifOptions?` | `GIF` | Multi-frame animated GIF |
| `capture_to_document` | `sections: DocumentSection[]` | `MD/HTML/PDF` | Multi-section document with embedded captures |
| `snapmcp-hint` | — | JSON | Server capability hints for MCP clients |

### CLI Commands

| Command | Description |
|---------|-------------|
| `snapmcp` (no args) | Start MCP server on stdio |
| `snapmcp init` | Interactive setup wizard (detects deps, configures MCP clients) |
| `snapmcp doctor` | 7 system health checks (Node, TypeScript, Chromium, permissions, deps, config) |
| `snapmcp test` | Generate verification captures (terminal.png + code.png) |
| `snapmcp --help` | Show usage information |
| `snapmcp --version` | Show version |

### Configuration (SNAPMCP_* env vars)

| Variable | Default | Description |
|----------|---------|-------------|
| `SNAPMCP_DIR` | `./captures` | Output directory |
| `SNAPMCP_FORMAT` | `png` | Image format (`png` or `jpeg`) |
| `SNAPMCP_QUALITY` | `90` | JPEG quality (1-100) |
| `SNAPMCP_THEME` | auto-detected | Shiki theme name |
| `SNAPMCP_FONT` | `'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace` | Font family |
| `SNAPMCP_FONT_SIZE` | `14px` | Font size |
| `SNAPMCP_TIMEOUT` | `30000` | Browser timeout (ms) |
| `SNAPMCP_DEVICE_SCALE` | `2` | Device pixel ratio |
| `SNAPMCP_CLEANUP_MAX` | `0` | Max files before cleanup (0 = no limit) |
| `SNAPMCP_LOG_LEVEL` | `info` | Log level |
| `SNAPMCP_ALLOWED_PATHS` | `''` (all) | File read allowlist (semicolon-separated) |
| `SNAPMCP_MAX_FILE_SIZE` | `5242880` | Max file read size (bytes) |
| `SNAPMCP_SECURITY_CHECKS` | `true` | Enable security checks |
| `SNAPMCP_SSRF_PROTECTION` | `false` | Enable SSRF URL denylist |
| `SNAPMCP_LOG_FILE` | `''` | Audit log file path |
| `SNAPMCP_PADDING` | `32` | Inner padding (px) |
| `SNAPMCP_SHADOW` | `none` | Shadow level |
| `SNAPMCP_WINDOW_CHROME` | `false` | macOS traffic light title bar |
| `SNAPMCP_BORDER_RADIUS` | `0` | Corner radius (px) |
| `SNAPMCP_BADGE` | `false` | Footer badge |

---

## Dependency Graph

```
src/index.ts
  ├── src/config.ts
  │     └── src/terminal.ts (theme detection)
  ├── src/renderer.ts
  │     ├── src/config.ts
  │     ├── src/security.ts
  │     ├── src/browser.ts (Chrome detection)
  │     ├── src/terminal.ts (terminal colors)
  │     └── src/brand.ts (CSS tokens)
  ├── src/security.ts
  ├── src/logger.ts
  ├── src/brand.ts
  ├── src/document.ts
  │     └── src/brand.ts
  └── src/highlighter.ts

src/cli.ts
  ├── src/setup-shared.ts
  │     ├── src/register.ts
  │     └── src/browser.ts
  └── src/config.ts

src/gif.ts
  ├── gifenc (external)
  └── fast-png (external)

scripts/setup.ts → src/setup-shared.ts
scripts/postinstall.ts → src/browser.ts
```

**External dependencies:**
- `@modelcontextprotocol/sdk` — MCP server framework
- `playwright` — browser automation engine
- `shiki` — syntax highlighting (50+ langs, 27 themes)
- `marked` — markdown → HTML rendering
- `gifenc` — GIF encoding (zero deps)
- `fast-png` — PNG encoding for GIF frames

---

## Testing Strategy

- **Framework**: Bun's built-in test runner (`bun test`)
- **Total tests**: 240+ (varies by state)
- **Test types**:
  - **Unit tests**: `tests/security.test.ts`, `tests/config.test.ts`
  - **Integration tests**: `tests/integration/config-matrix.test.ts`, `tests/integration/mcp-e2e.test.ts`
  - **CLI tests**: `tests/cli.test.ts` (tested via `snapmcp test` command)

### Known Test Limitations

1. **config-matrix.test.ts**: Uses nested `describe()` which crashes under Bun's `node:test` runner (Bun bug). Tests pass individually but fail in batch.
2. **cli.test.ts**: `cliInit()` uses `ask()` (stdin prompt), causing 15s timeout in non-interactive test environments.
3. **MCP e2e**: Requires built `dist/` directory and Playwright browser binary.

### Running Tests

```bash
bun test                    # All tests
bun test tests/security.test.ts  # Single test file
snapmcp test                # Generate test capture files (manual QA)
```
