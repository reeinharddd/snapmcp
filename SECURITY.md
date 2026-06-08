# Security Policy for snapmcp

## 🔒 What snapmcp does

snapmcp is an MCP (Model Context Protocol) server that runs locally on your machine.
It has filesystem and network access to perform its capture functions:

- **Reads** files you explicitly specify via `capture_file`
- **Writes** screenshots/PDFs to a single output directory (configurable via `SNAPMCP_DIR`)
- **Browses** URLs you provide via `capture_browser`, `capture_pdf`
- **Renders** text/code you provide into images via `capture_terminal`, `capture_code`, etc.

## 🛡️ Built-in Protections

| Protection | Where | How |
|------------|-------|-----|
| **Path traversal prevention** | `src/security.ts` | All output filenames are validated to stay inside `SNAPMCP_DIR` |
| **Input size limits** | `src/security.ts` | Terminal, code, markdown, diff, HTML inputs are capped (see limits below) |
| **File read validation** | `src/security.ts` | File size limit (5MB default), optional path allowlist via `SNAPMCP_ALLOWED_PATHS` |
| **Zod validation** | `src/index.ts` | All tool parameters validated (types, ranges, URL format) |
| **HTML escaping** | `src/renderer.ts` | All user content is HTML-escaped before rendering |
| **Resource cleanup** | `src/renderer.ts` | Browser pages closed in `finally` blocks — no leaks |
| **Dependency pinning** | `package.json` | All deps pinned to exact versions (no `^` ranges) |
| **Provenance** | `package.json` | npm provenance enabled for package signing |
| **Dependabot** | `.github/dependabot.yml` | Weekly automated security updates |

### Input Size Limits

| Tool | Limit |
|------|-------|
| `capture_terminal` | 1,000 lines |
| `capture_code` | 200 KB |
| `capture_markdown` | 200 KB |
| `capture_html` | 200 KB |
| `capture_diff` | 500 KB |
| `capture_file` | 5 MB file size |

### Disabling Security Checks

Set `SNAPMCP_SECURITY_CHECKS=false` to disable all security validations
(not recommended — use only for debugging).

## 🔍 Reporting a Vulnerability

snapmcp is a small utility with a limited attack surface, but if you find
a security issue:

1. **DO NOT** open a public GitHub issue
2. Email the maintainer directly, or
3. Use GitHub's private vulnerability reporting feature

We will:
- Acknowledge receipt within 48 hours
- Provide an estimated timeline for a fix
- Publish a CVE if applicable

## 📦 Supply Chain Security

- All dependencies are pinned to exact versions
- `bun.lock` / `package-lock.json` is committed to the repository
- `npm audit` runs in CI on every PR
- Dependabot is configured for weekly automated updates
- npm provenance signs the published package

## 🐛 Known Security Considerations

1. **`capture_browser` and `capture_pdf` can browse any URL** — including
   internal services (localhost, internal APIs). This is inherent to the
   functionality. Only use snapmcp in trusted environments.

2. **`capture_file` can read any file** within the configured size limits
   and allowed paths. Restrict paths via `SNAPMCP_ALLOWED_PATHS` if needed.

3. **Chromium sandbox status** — snapmcp checks at startup if Chromium's
   sandbox is enabled and warns if not.
