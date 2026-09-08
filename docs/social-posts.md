# SnapMCP — Social content (draft, 2026-08-20)

Status: draft. Publicar tras listing en el registry oficial + blog post en Dev.to.

---

## X/Twitter thread (5 tweets)

**Tweet 1**
Your coding agent can describe a page, but can it show one? SnapMCP is an MCP
server that turns agent output into pixel-faithful images: real terminal colors,
Shiki-highlighted code, visual diffs, PDFs and GIFs.

**Tweet 2**
The gap: Playwright MCP reads pages through token-efficient a11y snapshots
(great for *interacting*). But a README needs images humans want to read.
snapmcp renders them: terminal with your actual theme, diff with true red/green.

**Tweet 3**
13 tools, one server. capture_terminal, capture_code, capture_browser,
capture_markdown, capture_diff, capture_pdf, capture_gif, capture_batch...
SSRF protection on by default. Uses your system Chrome — or auto-installs Chromium.

**Tweet 4**
Setup in one minute:
npm install -g snapmcp
-> add "snapmcp" to your MCP client
-> "capture a terminal shot of git log --oneline -5"
Images land in ./captures. That's it.

**Tweet 5**
Playwright to interact. snapmcp to document. Docs: github.com/reeinharddd/snapmcp
#MCP #AI #Agents #DevTools

(GIF attached: demo of a terminal capture, then a diff. From assets/demo-*.png.)

---

## Reddit post (r/mcp + r/ClaudeCode)

**Title:** I built an MCP server that produces the images your agent docs are missing

**Body:**
Coding agents are great at describing things, but the docs they generate still
need real visuals. I kept hitting the same wall: terminal screenshots with
actual colors, syntax-highlighted code, visual diffs, PDFs, GIFs — no single
MCP server did it.

So I built snapmcp:
- 13 capture tools (terminal, code, browser, markdown, HTML, diff, PDF, batch, GIF, sequence, document)
- Real terminal theme detection (Kitty, GNOME, Alacritty, WezTerm, Xfce4, LXTerminal)
- Shiki highlighting, 50+ languages, 27 themes
- SSRF protection + file allowlist + input limits on by default
- Uses your system Chrome, or auto-installs Chromium at first setup

Honest positioning: if your agent needs to *click* buttons, use Playwright MCP.
If it needs to *show* something in docs/PRs, snapmcp is the complement.

npm: snapmcp | GitHub: github.com/reeinharddd/snapmcp
Happy to answer setup questions (Claude Code / Cursor / VS Code / OpenCode).

---

## DEV.to / Hashnode meta

- Source: docs/blog-post-devto.md (frontmatter listo, cover SVG verificado HTTP 200)
- Title: "Why I built an all-in-one visual MCP server (and when NOT to use Playwright)"
- tags: mcp, ai, agents, claude
