# Contributing to snapmcp

> First, read [ARCHITECTURE.md](./ARCHITECTURE.md) for the full technical overview.

## Quick Start

```bash
git clone https://github.com/reeinharddd/snapmcp.git
cd snapmcp
bun install
bun run build      # Compile TypeScript → dist/
bun test           # Run test suite
```

## Prerequisites

- **Bun** >= 1.2 (primary runtime)
- **Node.js** >= 20 (optional, for Node usage)

The first `bun install` will install Playwright's Chromium browser binary
(~300MB) automatically.

## Project Structure

```
snapmcp/
├── src/              # TypeScript source (15 files)
│   ├── index.ts      # Entry point — MCP tools + CLI
│   ├── config.ts     # Configuration + env loading
│   ├── renderer.ts   # Playwright screenshot engine
│   ├── security.ts   # Validation + SSRF protection
│   ├── terminal.ts   # Real terminal detection
│   ├── browser.ts    # Chrome detection
│   ├── brand.ts      # Design tokens
│   ├── logger.ts     # Audit logging
│   ├── cli.ts        # CLI commands
│   ├── register.ts   # MCP auto-registration
│   ├── setup-shared.ts  # Bootstrap wizard
│   ├── document.ts   # Document renderer
│   ├── gif.ts        # GIF encoder
│   ├── highlighter.ts # Syntax highlighting
│   └── gifenc.d.ts   # gifenc type declarations
├── scripts/          # Setup scripts
│   ├── setup.ts      # Interactive installer
│   └── postinstall.ts # Post-install hook
├── tests/            # Test files
│   ├── security.test.ts
│   ├── config.test.ts
│   ├── cli.test.ts
│   └── integration/
│       ├── config-matrix.test.ts
│       └── mcp-e2e.test.ts
├── brand/            # Brand assets (logo, tokens, BRAND.md)
├── .github/          # CI/CD + Dependabot
└── Dockerfile        # Multi-stage build
```

## Development Workflow

### 1. Code Changes

```bash
bun run dev           # Watch mode — auto-restarts on file change
```

The source is TypeScript with strict mode enabled. All edits go in `src/`.
Running `bun run dev` watches for changes and re-runs via `bun --watch`.

### 2. Build

```bash
bun run build         # tsc → dist/
bun run build && bun start   # Build + start server
```

TypeScript compilation is strict — no `@ts-ignore`, no `any` (all `as any` usages
have been replaced with typed interfaces).

### 3. Test

```bash
bun test              # Run all tests
bun test tests/security.test.ts  # Single file
bun test --coverage   # With coverage
```

**Testing guidelines:**
- Unit tests go in `tests/<module>.test.ts`
- Integration tests go in `tests/integration/`
- Tests should verify both happy path AND error cases
- SSRF tests should test with `ssrfProtection=false` (pass), `true` (block), and `undefined` (pass)
- Avoid tests that require stdin interaction (they'll timeout at 15s)

### 4. Manual QA

```bash
snapmcp doctor        # 7 health checks
snapmcp test          # Generate terminal + code captures
```

Inspect generated files in `./captures/`.

### 5. Commit Style

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scope): description     # New feature
fix(scope): description      # Bug fix
docs(scope): description     # Documentation
chore(scope): description    # Maintenance
refactor(scope): description # Refactoring
ci(scope): description       # CI/CD
test(scope): description     # Tests
```

Examples:
```
feat(terminal): detect Kitty terminal config for real colors
fix(security): add loopback range to SSRF denylist
docs(readme): add GIF example usage
chore(deps): bump playwright to 1.60.0
```

### 6. PR Workflow

1. Create a feature branch from `main`
2. Make changes, write/update tests
3. Build + test locally
4. Push + open PR
5. CI runs on push (bun test on 3 OS)

---

## Adding a New Capture Tool

1. **Add the render function** in `src/renderer.ts`:
   - Create HTML template (or reuse `framedTemplate`/`rawHtmlTemplate`)
   - Call `screenshotHtml()` or `screenshotPage()`

2. **Register the tool** in `src/index.ts`:
   ```
   server.tool("capture_mytype", "description", schema, async (params) => {
     // validate → render → return path
   });
   ```

3. **Add Zod schema** for parameters

4. **Update README** tool table

5. **Add integration test** in `tests/integration/`

6. **Update CHANGELOG.md**

## Adding an Environment Variable

1. Add field to `SnapConfig` interface in `src/config.ts`
2. Add default value to `DEFAULTS`
3. Add env var reading to `loadConfig()` (use `getEnvVar` pattern)
4. Update `SnapConfig` documentation comment
5. Update README config table
6. Update ARCHITECTURE.md configuration section

---

## Architecture Principles

### Single Responsibility

Each file in `src/` has one job. If you need to touch 3+ files for a change,
consider whether a new module is needed.

### Real Fidelity First

Before adding a new synthetic/fallback theme or color, check if the real value
can be detected from the user's environment:
- Terminal colors → `src/terminal.ts`
- Browser profile → `src/browser.ts`
- OS theme → `src/terminal.ts` (gsettings/dconf)

### Security is Layered

Every capture tool passes through at least 2 security layers (validation + rendering).
SSRF protection is opt-in by design. Never make security opt-out of anything
already enforced — only make it opt-in.

### Brand Consistency

All visual output (CLI colors, document themes, badge gradients) uses tokens from
`src/brand.ts`. Don't hardcode colors directly.

### Cross-Platform Awareness

When adding platform-specific code, always provide fallback behavior:
- `/proc` terminal detection → env vars fallback → OS theme
- Linux Chrome paths → macOS Chrome paths → Windows Chrome paths
- `gsettings` → `defaults read` → Windows registry/env vars

---

## Code Review Checklist

- [ ] Does the code actually do what the task requires? (Read the diff — not just the claim)
- [ ] Are there stubs, TODOs, placeholders, or hardcoded values?
- [ ] Are error paths handled? (try/catch, validation before processing)
- [ ] Are there logic errors? (Trace both happy path and error path)
- [ ] Do tests cover the new behavior? (Both happy path AND failure cases)
- [ ] Are there `as any`, `@ts-ignore`, or empty catch blocks?
- [ ] Does it follow existing patterns? (Check a reference file)
- [ ] Are imports clean? (No unused imports, no circular deps)
- [ ] Does `bun test` pass? (All tests, not just the new ones)
- [ ] Does `bun run build` pass? (tsc clean)

---

## Cross-Platform Testing

If you change platform-specific code in `browser.ts` or `terminal.ts`:

```bash
# Linux (primary development platform)
bun test

# Check platform-specific paths are valid syntax
tsc --noEmit

# If you changed Chrome paths:
# Verify all platform path arrays are present
grep -n "CHROME_PATHS_" src/browser.ts
```

The CI runs tests on Ubuntu, macOS, and Windows — but it's your responsibility
to verify platform-specific logic doesn't crash on other OSes at the syntax level.

---

## Security Vulnerability Process

If you discover a security vulnerability:

1. **DO NOT** open a public GitHub issue
2. Email the maintainer or use GitHub's private vulnerability reporting
3. Do not disclose until a fix is published

For dependency vulnerabilities:
```bash
bun audit             # Check for known vulns
bun update            # Update all deps
```

---

## Release Process

Current maintainer only (not automated):

```bash
# 1. Update version in package.json
# 2. Update CHANGELOG.md
# 3. Build + test
bun run build && bun test
# 4. Commit + tag
git commit -m "chore(release): vX.Y.Z"
git tag vX.Y.Z
git push && git push --tags
# 5. Publish (if public)
npm publish
```
