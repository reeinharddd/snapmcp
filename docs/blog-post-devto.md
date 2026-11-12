---
title: "Why visual documentation needs a focused MCP server"
published: false
description: "snapmcp gives AI agents 13 tools for terminal screenshots, highlighted code, browser captures, PDFs, GIFs, ordered steps, and captioned visual documents, with saved-path results and explicit security boundaries."
tags: [mcp, ai, agents, developer-tools, documentation]
cover_image: https://raw.githubusercontent.com/reeinharddd/snapmcp/main/brand/logo/snapmcp-logo-horizontal.svg
---

# Why visual documentation needs a focused MCP server

Coding agents are good at describing what changed. Documentation workflows often need something else: an artifact intended for a person to read.

A terminal screenshot with a familiar palette. A code snippet with syntax highlighting. A diff with additions and deletions made obvious. A browser page saved as an image or PDF. An ordered walkthrough that can become a GIF. A captioned report that contains all of those artifacts.

Browser automation servers solve a different problem. They navigate, click, fill forms, and return accessibility snapshots that are efficient for an agent to reason about. They are the right tool for interaction. They are not a focused visual-document production system.

[snapmcp](https://github.com/reeinharddd/snapmcp) fills that gap with exactly 13 MCP tools.

## The tool surface

| Tool | What it produces |
|---|---|
| `capture_terminal` | Terminal output with `$ ` user prompts and `# ` root prompts |
| `capture_code` | Shiki-highlighted code with an optional inclusive line range |
| `capture_browser` | Full-page or viewport screenshot of an HTTP(S) URL |
| `capture_file` | Highlighted image of an allowlisted file and line range |
| `capture_markdown` | GitHub-flavored Markdown rendered as an image |
| `capture_html` | Sanitized HTML and CSS rendered as an image |
| `capture_diff` | Unified diff with additions and deletions highlighted |
| `capture_pdf` | Complete URL document printed to PDF |
| `capture_batch` | Up to 10 independent capture images |
| `capture_sequence` | Up to 60 ordered step images and an optional GIF |
| `capture_gif` | GIF from 2 to 60 PNG captures |
| `capture_document` | Up to 30 captioned captures in Markdown, HTML, or PDF |
| `snapmcp-hint` | Natural-language tool discovery and concise guidance |

There is no extra capture tool. Composite workflows reuse the same terminal, code, file, browser, Markdown, HTML, and diff primitives.

## Results that keep agent context small

The capture/document tools return saved file paths, not image bytes; `snapmcp-hint` returns text guidance. That keeps the model context focused on the task and leaves image handling to the client or the documentation pipeline.

Inputs are bounded too: 1,000 terminal lines, 200 KB for code, Markdown, and HTML, 500 KB for diffs, 5 MB for files by default, 10 batch items, 60 sequence steps, 2 to 60 GIF frames, and 30 document captures.

For independent images, one `capture_batch` call is usually better than a series of unrelated tool calls. For an ordered walkthrough, `capture_sequence` saves individual images and can also compile a GIF. It does not make a side-by-side composite.

## Setup should not have a hidden side effect

The primary runtime is Node.js 20 or newer. Bun 1.2 or newer is optional, and npm and npx work without Bun.

```bash
npm install -g snapmcp
snapmcp init
```

The package postinstall step does not download Chromium. `snapmcp init` installs Playwright Chromium explicitly, making the browser choice visible and reproducible.

An agent can discover the catalog without loading a long reference:

```bash
snapmcp capabilities --json
snapmcp search "printable report with captures" --json
```

Over MCP, the equivalent surfaces are `tools/list`, `snapmcp-hint` with a natural-language query, and the `snapmcp://capabilities` resource.

## Security needs precise language

snapmcp is designed for local use, but it should not be described as a complete hostile-content sandbox.

URL tools accept HTTP(S) only. SSRF protection is default-on: private and local IPv4 and IPv6 literals, IPv4-mapped IPv6 addresses, localhost variants, and hostnames resolving to private addresses are blocked. Requests are revalidated as they occur.

The address that was checked is the address that is used: Chromium reaches every capture target through a local validating proxy that resolves and validates the target and then connects to the validated IP literal, which closes the DNS-rebinding window. Hostile targets still need an additional network boundary, such as a container or VM without access to internal networks.

File reads are deny-all until `SNAPMCP_ALLOWED_PATHS` is configured. Every output stays inside `SNAPMCP_DIR`, including composite outputs, and traversal and symlink escapes are rejected.

Synthetic captures, including terminal, code, diff, Markdown, HTML, and generated document PDFs, render in an isolated browser context with JavaScript disabled, external network resources blocked, and a restrictive Content Security Policy. Raw HTML in Markdown is escaped, while raw HTML input is DOM-sanitized to remove active and external content. That is defense in depth, not a guarantee of perfect sanitizer safety.

Browser profile support is experimental and never selected automatically. It launches Chromium with a persistent user-data directory; URL captures run in that context, so profile cookies and session state can be sent to the target site. Synthetic captures remain isolated. Use a dedicated profile and treat it as sensitive.

## The complementary split

Use a browser-automation MCP server when the agent needs to act on a page. Use snapmcp when the agent needs to produce something a reader will see.

That distinction keeps both tools focused:

> Browser automation to interact. snapmcp to document.

## Try it

- Repository: https://github.com/reeinharddd/snapmcp
- npm package: `snapmcp`
- Release: `2.3.7`
- License: MIT
