# Changelog

All notable changes to snapmcp are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.4] - 2026-07-01

### Added
- **Doc-as-code docs site** — `docs/` directory with full reference (getting-started, tools, configuration, CLI, guides)
- Cross-linked documentation with hyperlinks between all pages

### Changed
- Updated README with links to docs/ and improved examples
- Bumped playwright to 1.61.1, shiki to 4.3.0, @types/node to 26.0.1

### Infrastructure
- Merged dependabot PRs: #17 (playwright+shiki), #18 (@types/node), #19 (actions/checkout v7)

## [2.2.3] - 2026-06-28

### Fixed
- GIF frame auto-padding (centered, transparent) instead of throwing on dimension mismatch
- Auto-append file extension in outPath() and PDF capture

## [2.2.0] - 2026-06-27

### Added
- **12 MCP tools** — new `create_gif`, `create_sequence`, `document`, `init` tools
- **Real Terminal Colors** — detects Kitty, Gnome Terminal, Alacritty, WezTerm, Xfce4, LXTerminal configs via process parent tree and config parsing; fallback to COLORFGBG and OS theme
- **Real Browser Profile** — 8-step Chrome/Edge/Brave detection (Linux, macOS, Windows) with profile extraction from Local State
- **In-Project Captures** — default output directory changed to `./captures` (visible in cwd, not isolated)
- **Interactive Setup Wizard** — `snapmcp init` guides through configuration with dependency detection and MCP config snippet output
- **Health Check CLI** — `snapmcp doctor` runs 7 system readiness checks
- **Test Captures** — `snapmcp test` generates verification captures
- **SSRF Protection** — opt-in URL denylist that blocks private/internal IP ranges when enabled via `SNAPMCP_SSRF_PROTECTION=true` (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, ::1/128)
- **Audit Logging** — structured JSON log file (`SNAPMCP_LOG_FILE`) with typed AuditEvent entries
- **Centralized Brand** — `src/brand.ts` with consistent teal/blue tokens across CLI, document renderer, and banner
- **CLI Banner** — brand-colored ASCII header showing version and all 12 tool names
- **Cross-Platform Chrome Paths** — Windows (6 paths), macOS (3 paths), Linux (existing) in browser detection
- **Type Safety** — all `as any` casts replaced with typed interfaces (`CaptureBrowserArgs`, `CaptureCodeArgs`, `ScreenshotOptions`, `PageScreenshotOptions`, etc.)

### Changed
- **Frame defaults**: `windowChrome=false`, `shadow=none`, `borderRadius=0` — no more decorative frames on captures by default
- **GIF engine**: migrated from gifencoder + pngjs to gifenc + fast-png (zero dependencies, removed 7 high-severity vulnerabilities)
- **Config defaults**: `outputDir='./captures'`, `theme` auto-detected from terminal if available
- **CI**: simplified to bun-only (3 OS, no node matrix)
- **Server name**: `SnapMCP` (capitalized) for branding consistency
- **Package**: `"private": true` to prevent accidental npm publish

### Security
- URL SSRF denylist (opt-in via `SNAPMCP_SSRF_PROTECTION=true`) blocks all private, loopback, link-local, and multicast IP ranges
- File capture deny-by-default: `SNAPMCP_ALLOWED_PATHS` must be explicitly set
- Audit trail for blocked SSRF attempts, file read violations, and capture events
- Chromium sandbox check at startup with clear guidance

### Infrastructure
- `src/terminal.ts` — real terminal detection module
- `src/browser.ts` — system Chrome detection module
- `src/setup-shared.ts` — shared bootstrap logic for interactive setup
- `npm` → `bun` only (removed node workflow from CI)
- `.gitignore` excludes agent artifacts (`.atl/`, `.omo/`, `.code-review-graph/`)

## [2.1.0] - 2025-06-07

### Added
- **27 syntax highlighting themes** (all Shiki v4 built-in themes): dracula, one-dark-pro, tokyo-night, catppuccin-mocha/latte, ayu-dark/light, vitesse-dark/light, min-dark/light, poimandres, rose-pine/rose-pine-moon/rose-pine-dawn, slack-dark/ochin, snazzy-light, github-dark-dimmed, one-light, solarized-light
- **Visual customization options** via environment variables:
  - `SNAPMCP_PADDING` (default: 32) — inner padding
  - `SNAPMCP_SHADOW` — `none | soft | medium | strong`
  - `SNAPMCP_WINDOW_CHROME` (default: true) — macOS traffic light title bar
  - `SNAPMCP_BORDER_RADIUS` (default: 8) — window corner radius 0-32px
  - `SNAPMCP_BADGE` (default: false) — subtle snapmcp footer badge
- **Terminal glass redesign** — glassmorphism title bar with radial-gradient traffic light buttons, configurable drop-shadow, backdrop-blur effect
- **CLI flags** — `--help`, `--version`, `--setup`
- **Security hardening** — Chromium sandbox detection at startup, exact dependency pinning, npm provenance

### Changed
- Renamed from `capture-server` to `snapmcp`
- Migrated from npm to **bun** as primary package manager
- All dependencies pinned to exact versions (no `^` ranges)
- Terminal template completely rewritten with premium glass design
- Diff, code, and terminal captures now share unified window frame
- Updated README with multi-editor install guides (Claude Code, OpenCode, Cline, Cursor, Windsurf, Continue)

### Security
- Path traversal prevention on all output filenames (`resolveSafePath`)
- Input size limits per tool (code/markdown: 200KB, diff: 500KB, terminal: 1000 lines, file: 5MB)
- File read validation with optional path allowlist (`SNAPMCP_ALLOWED_PATHS`)
- `SECURITY.md` with vulnerability disclosure policy
- `.github/dependabot.yml` for weekly security updates
- npm provenance enabled in `publishConfig`

### Infrastructure
- Multi-stage Dockerfile using `oven/bun` base
- CI workflow testing on both **bun** and **node**
- Setup script: `bun run setup` (installs Chromium, creates output dir)
- Post-install script for Chromium detection

## [2.0.0] - 2025-05-15

### Added
- 8 capture tools: terminal, code, browser, file, markdown, html, diff, pdf
- 6 syntax highlighting themes (dark-plus, github-dark, github-light, monokai, nord, solarized-dark)
- PNG and JPEG output with configurable quality
- Auto-cleanup of old captures (`SNAPMCP_CLEANUP_MAX`)
- Security: path traversal prevention, input size limits, file validation

### Changed
- Complete rewrite from v1 (capture-server)
- Playwright-based rendering engine
- Shiki v4 for syntax highlighting
- MCP stdio transport

## [1.0.0] - 2024-12-01

### Added
- Initial release as `capture-server`
- Basic terminal and code capture tools
- 3 built-in themes

---

[2.1.0]: https://github.com/reeinharddd/snapmcp/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/reeinharddd/snapmcp/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/reeinharddd/snapmcp/releases/tag/v1.0.0
[2.2.4]: https://github.com/reeinharddd/snapmcp/compare/v2.2.3...v2.2.4