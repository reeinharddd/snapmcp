# Changelog

All notable changes to snapmcp are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.11] - 2026-11-12

### Added
- Added `lhm.plugin.json`, the LobeHub Marketplace manifest, generated from the running server so the listing carries the exact 13 tool names, descriptions, input schemas, and output schemas the server serves
- Added an integration test that compares the committed manifest against the `tools/list` response of the built server, so a stale manifest fails CI instead of reaching the marketplace
- Added the LobeHub Marketplace badge and the Glama score badge to the README, so the repository links back to both listings

### Changed
- Documented the directory listing matrix and the manifest regeneration flow in `docs/gtm-kit.md` and `CONTRIBUTING.md`

## [2.3.10] - 2026-11-12

### Changed
- Moved the 13-tool catalog in `server.json` from a top-level `tools` block into `_meta` under the `io.modelcontextprotocol.registry/publisher-provided` namespace, which is the only publisher-supplied data the MCP Registry preserves

### Fixed
- Fixed the MCP Registry record, which listed zero tools: the official server schema has no top-level `tools` property, so the catalog was silently dropped on publish and only appeared in the repository copy of the file

## [2.3.9] - 2026-11-12

### Fixed
- Fixed the startup banner and the `snapmcp --help` tool list, which still advertised `capture_document` as producing only Markdown, HTML, and PDF even though `2.3.8` added editable PowerPoint and Word output
- Fixed the `snapmcp-hint` document topic, which did not mention the PowerPoint and Word formats
- Added a regression test that pins the advertised document formats in the capability catalog and in the hint topic, so the supported formats cannot silently drift from the documented ones

## [2.3.8] - 2026-11-11

> The `v2.3.7` tag was pushed before the documentation was aligned with the new proxy behavior, and it was never released to npm or the MCP Registry. `2.3.8` is the first published version of this work.

### Added
- Added a JSON Schema `outputSchema` to all 13 tools, so `tools/list` advertises the exact shape of every result and MCP clients can consume results without parsing text
- Added a matching `structuredContent` payload to every successful tool result: the saved absolute path, the artifact format, the file size in bytes, and the real pixel dimensions for raster artifacts; composite tools report their per-capture entries, and `snapmcp-hint` reports the ranked matches it returned
- Added editable PowerPoint output to `capture_document` through the `pptx` format: a title slide plus one slide per capture, with headings, descriptions, and captions as real text boxes and captures as pictures that keep their aspect ratio
- Added editable Word output to `capture_document` through the `docx` format: a Heading 1 title plus one Heading 2 per capture, with the description, capture, caption, and code block as normal document content
- Added `src/results.ts` as the single source of truth for tool output schemas, result builders, and artifact metadata, and `src/tools/deps.ts` as the shared tool dependency contract
- Added a regression test that pins the HTML escaping of document titles, descriptions, and captions

### Security
- Closed the DNS-rebinding window in URL captures: Chromium now runs behind a local validating proxy that resolves and validates every target itself and connects to the validated IP literal, and Chromium is launched with a resolver rule that stops it from resolving target hostnames at all
- Validated every redirect hop independently through that proxy, including targets that are already IP literals, so a redirect to a private address cannot bypass the checks
- Replaced the previous "DNS is not pinned" limitation with the actual behavior: the address that was validated is the address that is connected to, while keeping the honest caveats about resolver trust and deployment-level isolation
- Overrode the transitive `image-size` dependency to the patched 2.1.0 release, clearing two high-severity parser denial-of-service advisories in the tree

### Changed
- Migrated every tool registration from the deprecated `server.tool()` API to `server.registerTool()`, which is the only registration path that can carry an output schema
- Added human-readable tool titles and behavioural annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) to the tool catalog
- Documented the structured result contract in `docs/tools.md` and added it to the `snapmcp://capabilities` manifest and the server instructions
- Aligned every documentation surface with the new DNS-pinning behavior, so no page still claims that Chromium connects to an address other than the validated one

### Fixed
- Fixed `capture_batch` and `capture_sequence` results, which previously reported their summary as a saved path (`Saved: Batch complete ...`) instead of returning structured capture entries

## [2.3.6] - 2026-11-10

### Changed
- Reworked the release pipeline: the tag now drives npm publication with provenance, GitHub Release creation, and automatic MCP Registry publication through the official `mcp-publisher` CLI authenticated with GitHub OIDC
- Switched npm authentication to Trusted Publishing (OIDC) with the `NPM_TOKEN` secret kept only as a fallback, so no long-lived write token is required once a trusted publisher is configured
- Added a manual `workflow_dispatch` trigger to the release workflow so a failed publish can be retried without moving the tag
- Consolidated the release metadata and documentation on version `2.3.6` while keeping the public MCP surface at exactly 13 tools: 12 capture/document tools plus `snapmcp-hint`
- Made saved-path results the documented result contract across primitive and composite tools, so MCP responses do not carry image bytes
- Documented the actual flat discriminated-union schemas: `capture_batch.captures`, `capture_sequence.steps`, `capture_gif.captures`, and `capture_document.captures` now use `{ "type": ..., ...fields }` entries without a nested `params` object
- Added capability discovery through MCP `tools/list`, `snapmcp-hint` natural-language queries, the `snapmcp://capabilities` resource, `snapmcp capabilities --json`, `snapmcp search "<intent>" --json`, `llms.txt`, and server instructions
- Clarified that `capture_sequence` produces ordered individual step images and an optional GIF rather than a side-by-side composite
- Clarified that `capture_pdf` prints the complete URL document with Chromium and that `capture_document` PDF output embeds generated captures in a print-quality PDF
- Documented inclusive `startLine` and `endLine` ranges for code and file captures, Shiki support for 300+ bundled languages and 27 built-in themes, and heuristic terminal-palette detection without an ANSI parser
- Documented `$ ` user prompts and `# ` root prompts, GIF PNG frames, `loop: true` infinite playback, and `loop: false` one-shot playback
- Made Node.js 20 the primary documented runtime and Bun optional; npm/npx installation no longer requires Bun
- Clarified that `snapmcp init` explicitly installs Playwright Chromium while the package postinstall step does not download a browser
- Clarified that Playwright Chromium is the default browser and that a system browser is selected explicitly with `SNAPMCP_CHROME_EXECUTABLE`; fixed explicit profile mode so URL captures use the selected persistent context and can send profile cookies and session state to the target site, while synthetic captures remain isolated
- Added release gates for unit and integration tests, dependency audit, Node-only package installation, MCP tool/resource discovery, CLI discovery, and a non-root container smoke test
- Fixed the CI matrix job so it keeps emitting the `test (ubuntu-latest)` and `test (macos-latest)` status contexts required by the protected branch, and chained the audit, package-smoke and container-smoke gates so they block the merge
- Fixed the Node-only package smoke step, which created its install directory after restricting PATH and therefore could not find `mkdir`
- Fixed the Windows CI job, where Bun does not expose every named export of `node:child_process` and the import failed at link time
- Updated `actions/setup-node` to v7, which removes the deprecated Node.js 20 action runtime warning
- Updated OpenCode registration to detect global JSON and JSONC configs, preserve JSONC comments and unrelated settings, and print the OpenCode V2 `mcp.servers` configuration shape
- Replaced the doctor disk-space shell command with the Node filesystem API and added bounded document-image embedding limits so oversized captures fail loudly instead of being silently omitted

### Security
- Removed shell execution from the runtime: browser detection and terminal theme probes now use argument-vector command execution, so no value read from the environment can be interpreted as shell syntax and static analysers no longer flag concatenated shell commands
- Documented HTTP(S)-only URL handling and default-on SSRF protection for private/local IPv4 and IPv6 literals, IPv4-mapped IPv6 addresses, localhost variants, and DNS-resolved private addresses, with request revalidation
- Rejected embedded URL credentials during both initial validation and per-request revalidation
- Documented the DNS-pinning limit honestly: Chromium does not pin the DNS-resolved IP, so the checks do not guarantee complete DNS-rebinding prevention; hostile targets require deployment-level network isolation
- Documented deny-all file reads until `SNAPMCP_ALLOWED_PATHS` is configured, including symlink-aware allowlist checks
- Documented `SNAPMCP_DIR` output confinement for primitive and composite tools, including traversal and symlink checks; a symlinked output root is supported while nested or broken symlink escapes remain blocked
- Documented the synthetic-content boundary for every synthetic capture: JavaScript disabled, external network resources blocked, and a restrictive CSP, plus escaped raw Markdown HTML and DOM-sanitized raw HTML as defense in depth rather than a perfect-safety guarantee
- Removed unsupported security-policy claims about npm provenance, a committed npm lockfile, and an `npm audit` CI gate

### Added
- Added `llms.txt` with concise, link-oriented purpose, selection, discovery, safety, runtime, and documentation guidance
- Added `docs/agents.md` with tool selection, token-efficient behavior, discovery workflow, security boundaries, and OpenCode/code-mode examples
- Added registry metadata updates for `server.json` and `glama.json`, including version `2.3.6`, the exact 13-tool catalog, runtime requirements, discovery surfaces, and accurate security summaries

### Documentation
- Rewrote the tool reference with the actual flat union schemas and current limits
- Refreshed the getting-started, configuration, CLI, terminal, browser, GIF, workflow, registry, launch-copy, and social-content documentation
- Replaced stale claims about automatic browser download, automatic authenticated profile reuse, side-by-side sequences, PDF page-mode switches, and broad HTML escaping with behavior-specific wording
- Updated the architecture description with the capability catalog/resource, Node-first setup, output confinement, synthetic isolation, and the actual request lifecycle
- Updated OpenCode registration to the current `mcp.servers` shape; existing deprecated `mcp.snapmcp` entries are recognized and not duplicated

## [2.3.2] - 2026-08-17

### Changed
- Dependabot now opens bun-ecosystem PRs (lockfile kept in sync); merged @types/node 26.2.0, playwright 1.62.1, shiki 4.4.3, action-gh-release v3
- Added `mcpName` + validated `server.json` for the MCP Registry submission

## [2.3.1] - 2026-08-17

### Changed
- Bumped marked 15→18 and typescript 5→7 (native compiler; explicit "types": ["node"] in tsconfig)
- Dependabot now uses the bun ecosystem (keeps bun.lock in sync)

## [2.3.0] - 2026-08-17

### Security (hardening)
- **SSRF protection now ON by default** — `SNAPMCP_SSRF_PROTECTION` defaults to `true` (was opt-in); the README/config docs updated to match
- **DNS-aware SSRF blocking** — `validateUrl` resolves hostnames and blocks private/loopback/link-local answers, reducing hostname-obfuscation bypasses such as nip.io and localtest.me; IPv6 ranges (`::1`, `fc00::/7`, `fe80::/10`, `::ffff:v4`) and trailing-dot FQDNs (`localhost.`) are covered. Chromium does not pin the validated IP, so this is not complete DNS-rebinding prevention
- **URL validation moved to capture entry points** — `captureBrowser`, `capturePdf` and the 4 composite tools (`capture_batch`, `capture_gif`, `capture_sequence`, `capture_document`) now validate every URL; `file://` reads via browser tools are blocked
- **Per-request route guard** — when SSRF protection is on, every subrequest and redirect made by a URL capture is re-validated and aborted if it targets a private network; synthetic captures instead disable JavaScript and block network resources
- **Path allowlist hardened** — `SNAPMCP_ALLOWED_PATHS` uses `realpath` + boundary-aware prefix matching (no more `/tmp/allowed` matching `/tmp/allowed-evil`), supports comma or semicolon separators, and no longer leaks the full config in error messages

### Added
- **Real Chrome profile support** — `SNAPMCP_CHROME_EXECUTABLE`, `SNAPMCP_CHROME_CHANNEL` and `SNAPMCP_CHROME_PROFILE` env vars now actually work: snapmcp launches the system Chrome with your profile (cookies/sessions) via persistent context instead of always falling back to bundled Chromium
- **Browser bootstrap behavior (superseded in 2.3.6)** — package installation no longer downloads Chromium; `snapmcp init` performs the browser installation explicitly
- **Test coverage for terminal/browser detection, logger and brand** — new `tests/terminal.test.ts`, `tests/browser.test.ts`, `tests/logger.test.ts`, `tests/brand.test.ts`, `tests/register.test.ts`, `tests/setup-shared.test.ts` (suite now 250+ tests)
- **URL protocol hardening (superseded in 2.3.6)** — URL-producing tools now accept HTTP(S) only; `about:blank` and other non-HTTP(S) schemes are rejected

### Fixed
- **Browser singleton race** — concurrent capture calls no longer race on first-launch (promise-cached singleton); close-failure no longer leaves a poisoned browser instance
- **PDF capture leak** — `writePdf` reuses the shared browser instead of launching/leaking a second one
- **GIF engine** — OOM-safe two-pass encoding with per-frame dimension metadata; frame count limit enforced
- **Terminal font-size normalization** — GNOME/other parsers reporting bare numbers (e.g. `"12"`) are normalized to CSS `px`
- **WezTerm config parsing** — typed `matchAll` replaces untyped regex loop that broke `tsc` builds
- **Version source of truth** — banner/`--version` read from `package.json` instead of a hardcoded string; `SNAPMCP_THEME=auto` no longer passed to Shiki as a theme name

### Changed
- **Docs synchronized with code** — README tool count (13 tools), `SNAPMCP_SHADOW` values (`none|soft|medium|strong`), SSRF default, separators, theme list, Node/Bun requirements, batch schema (`captures` with flat type-specific fields), and brand tokens (`#00d4aa` primary) match the implementation
- **CI runs the full unit-test suite** — new test files added to `ci.yml` and `publish.yml`

### Infrastructure
- Dependency auditing uses the committed Bun lockfile through `bun audit`; `npm audit` is not a release gate
- 2 dependabot PRs reviewed (no issues found)

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
- **Security hardening** — Chromium sandbox configuration checks at startup and exact dependency pinning

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
- npm publish access configured as public; npm provenance is not enabled

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