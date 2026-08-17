---
title: "Why I built an all-in-one visual MCP server (and when NOT to use Playwright)"
published: false
description: "snapmcp: real terminal colors, Shiki syntax, visual diffs, PDFs and GIFs for AI documentation agents — one MCP server, zero heavy deps, SSRF protection on by default."
tags: [mcp, ai, agents, claude]
cover_image: https://raw.githubusercontent.com/reeinharddd/snapmcp/main/brand/logo/snapmcp-logo-horizontal.svg
---

# Why I built an all-in-one visual MCP server (and when NOT to use Playwright)

If you've used Claude Code, Cursor, or any coding agent with the Model Context Protocol, you've probably hit the same wall I did: getting your agent to *show* something instead of just *describe* it.

Playwright MCP is the obvious answer for browser automation — it's excellent at it. But documentation isn't browser automation. The moment your agent needs a **terminal screenshot with real colors**, a **syntax-highlighted code image**, or a **visual git diff**, Playwright's accessibility snapshots don't help. They're token-efficient for *reading* a page, not for producing images a human wants to see in a README.

I built [snapmcp](https://github.com/reeinharddd/snapmcp) to close that gap: one MCP server that produces pixel-faithful visual artifacts for the pieces of your workflow that Playwright never touches.

## The problem with piecing together capture tools

Before, a documentation workflow needed several servers:

- one for browser screenshots
- one for code screenshots
- one for PDFs
- one for GIFs
- ...and none of them reproduced *real terminal colors*

That's five configs to maintain, five installs to keep working, five SSRF surfaces to worry about.

snapmcp replaces that with one server, 13 tools, and zero heavy dependencies.

## What it does

| Tool | What you get |
|------|-------------|
| `capture_terminal` | Terminal output with **your actual detected theme** — Kitty, GNOME, Alacritty, WezTerm, Xfce4, LXTerminal. Not a generic dark rectangle. |
| `capture_code` | Shiki syntax highlighting, 50+ languages, 27 themes |
| `capture_browser` | Full-page or viewport screenshot (uses your system Chrome profile when available) |
| `capture_file` | File → auto-detected language → highlighted image |
| `capture_markdown` / `capture_html` | Rendered documents as styled images |
| `capture_diff` | Git diffs with green additions / red deletions |
| `capture_pdf` | URL → PDF document |
| `capture_batch` | Multiple captures in one call |
| `capture_gif` / `capture_sequence` | Animated GIFs from your captures |
| `capture_to_document` | A multi-section document with captures embedded |

## The setup that sells it

```bash
npm install -g snapmcp
```

Add to Claude Code:

```json
{
  "mcpServers": {
    "snapmcp": {
      "command": "npx",
      "args": ["-y", "snapmcp"],
      "env": { "SNAPMCP_DIR": "./captures" }
    }
  }
}
```

Then just ask:

> "Capture a terminal screenshot of `git log --oneline -5` and a highlighted PNG of `src/index.ts`."

The agent calls `capture_terminal` and `capture_file`, and the images land in `./captures/` with your real theme.

## Being honest about where Playwright wins

A comparison is only useful if it's honest. Playwright MCP is **the right tool** for browser *interaction*: clicking, filling forms, navigating, and reading pages through token-efficient accessibility trees (50–200 tokens vs 800–2000 for a screenshot).

I don't compete with that. Most documentation pipelines pair them:

> **Playwright to interact. snapmcp to document.**

Here's the honest split:

| Use case | snapmcp | Playwright MCP |
|----------|:-------:|:--------------:|
| Terminal capture with real colors | ✅ | ❌ |
| Code → syntax-highlighted image | ✅ | ❌ |
| Git diff → visual image | ✅ | ❌ |
| URL → PDF | ✅ | ❌ |
| Animated GIF | ✅ | ❌ |
| Browser page screenshot | ✅ | ✅ |
| Browser **automation** (click/fill) | ❌ | ✅ |

## Security first

Because an MCP server takes inputs from an LLM, I treat every input as potentially untrusted:

- **SSRF protection on by default** — blocks IP literals (v4 + v6), localhost variants, and DNS names that resolve to private ranges (`10.0.0.0/8`, `192.168.0.0/16`, `fc00::/7`, `fe80::/10`, …). Every page request — redirects included — is re-checked.
- **File allowlist** — `capture_file` defaults to deny-all until you allow paths.
- **Path traversal** — blocks `../` escapes, symlink traversal (via realpath), and null bytes.
- **Input limits** — terminal 1000 lines, code/markdown/HTML 200KB, diff 500KB, files 5MB.

## When NOT to use it

Use it when you need **visual artifacts for humans** — documentation, READMEs, PR descriptions, tutorials, QA evidence.

Don't reach for it when your agent needs to *do things* in a browser. That's Playwright's job. Use both, and give each its lane.

## Try it

- GitHub: [reeinharddd/snapmcp](https://github.com/reeinharddd/snapmcp)
- npm: `snapmcp` — `2.3.2`
- MIT licensed, CI green on Linux/macOS/Windows, 317 tests

The next time your agent writes docs, let it *show* the reader what it means.
