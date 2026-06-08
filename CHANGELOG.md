# Changelog

All notable changes to snapmcp are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[2.1.0]: https://github.com/erik/snapmcp/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/erik/snapmcp/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/erik/snapmcp/releases/tag/v1.0.0