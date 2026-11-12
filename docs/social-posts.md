# snapmcp Social Content Drafts

These drafts describe snapmcp 2.3.11 accurately. They are drafts and have not been published.

## X/Twitter thread

### Post 1

Your coding agent can describe a terminal, code sample, diff, or web page. snapmcp lets it create the visual artifact: screenshots, PDFs, GIFs, ordered walkthroughs, and captioned documents, including editable PowerPoint and Word files.

### Post 2

Browser automation and visual documentation are different jobs. Use a browser MCP server to click and navigate. Use snapmcp when a person needs to read the result in a README, tutorial, PR, or report.

### Post 3

snapmcp has exactly 13 tools: terminal, code, browser, file, Markdown, HTML, diff, PDF, batch, sequence, GIF, document, and hint. No redundant capture feature.

### Post 4

Capture results are saved file paths, not image bytes, and every tool returns a structured payload with the path, format, and size; the hint tool returns text. Inputs are bounded, file reads are deny-all by default, output stays inside `SNAPMCP_DIR`, and SSRF checks are on by default.

### Post 5

Setup is explicit:

```bash
npm install -g snapmcp
snapmcp init
```

Node.js 20 is primary. Bun is optional. Agents can discover the right tool with `snapmcp-hint` or `snapmcp://capabilities`.

### Post 6

Playwright to interact. snapmcp to document.

Repository: https://github.com/reeinharddd/snapmcp

## Reddit draft

**Title:** I built an MCP server for the visual artifacts coding-agent documentation is missing

**Body:**

Coding agents are good at describing changes, but READMEs, tutorials, PR descriptions, and QA reports often need images intended for people.

I built snapmcp as a focused visual documentation MCP server:

- exactly 13 tools for terminal output, code, browser pages, Markdown, HTML, diffs, PDFs, GIFs, ordered sequences, and captioned documents in Markdown, HTML, PDF, PowerPoint, or Word;
- Shiki highlighting for 300+ bundled languages and 27 themes;
- inclusive code and file line ranges;
- saved-path results instead of image bytes, plus a structured payload with the path, format, and size;
- bounded inputs, deny-all file reads, output confinement, and default-on SSRF checks;
- Node.js 20 primary and npm/npx support without Bun.

The boundary is explicit: URL tools accept HTTP(S), SSRF checks block private and local targets, and every capture target is resolved and connected by a local validating proxy, so the address that was checked is the address that is used. Hostile targets still need network isolation, and synthetic HTML and Markdown are isolated and sanitized as defense in depth, not as a guarantee of perfect sanitizer safety.

Repository: https://github.com/reeinharddd/snapmcp

## Blog metadata

- Source: [blog-post-devto.md](blog-post-devto.md)
- Suggested title: "Why visual documentation needs a focused MCP server"
- Suggested tags: mcp, ai, agents, developer-tools, documentation
