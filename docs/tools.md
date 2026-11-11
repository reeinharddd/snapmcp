# Tools Reference

> snapmcp 2.3.6 exposes exactly 13 MCP tools: 12 capture/document tools and one discovery tool.

The 12 capture/document tools return saved file paths and short text summaries rather than image bytes. `snapmcp-hint` returns text guidance. Generated files are confined to `SNAPMCP_DIR`.

## Common rules and limits

| Area | Limit or behavior |
|---|---|
| Terminal | 1,000 lines and 1 MB of text |
| Code | 200 KB |
| Markdown | 200 KB |
| HTML | 200 KB |
| Diff | 500 KB |
| File | 5 MB by default |
| Batch | 1 to 10 items |
| Sequence | 1 to 60 steps |
| GIF | 2 to 60 PNG frames; canvas up to 8,192 by 8,192 |
| Document | 1 to 30 captures; 25 MB per embedded image; 75 MB total embedded images |
| URLs | HTTP(S) only |
| File reads | Denied unless `SNAPMCP_ALLOWED_PATHS` is configured |
| Output | Confined to `SNAPMCP_DIR`, including composite outputs |

## Flat capture unions

`capture_batch`, `capture_sequence`, `capture_gif`, and `capture_document` accept discriminated unions. The `type` field and its type-specific fields are siblings. There is no nested `params` property.

### Primitive variants

| `type` | Type-specific fields |
|---|---|
| `terminal` | `title?` (up to 100 characters), `lines` (1 to 1,000) |
| `code` | `code` (up to 200 KB), `language?`, `title?` (up to 100 characters), `startLine?`, `endLine?` |
| `file` | `filePath`, `startLine?`, `endLine?` |
| `browser` | `url`, `fullPage?`, `width?` (320 to 3,840), `height?` (240 to 4,096) |
| `markdown` | `markdown` (up to 200 KB), `title?` (up to 100 characters) |
| `html` | `html` (up to 200 KB), `title?` (up to 100 characters) |
| `diff` | `diff` (up to 500 KB) |

`startLine` and `endLine` are 1-indexed and inclusive. `capture_sequence` steps may also include `stepNumber?` (integer, at least 1) and `label?` (up to 100 characters). `capture_document` captures may also include `caption?` (up to 200 characters).

Example:

```json
{
  "captures": [
    {
      "type": "terminal",
      "title": "build",
      "lines": ["$ npm run build", "Build complete"]
    },
    {
      "type": "code",
      "language": "typescript",
      "code": "export const ready = true;",
      "startLine": 1,
      "endLine": 1
    }
  ]
}
```

## Tool reference

### 1. `capture_terminal`

Render terminal lines as a PNG or JPEG. A line beginning with `$ ` is a user prompt; a line beginning with `# ` is a root prompt. Terminal palette detection is heuristic and reads common terminal configurations when available. It does not parse ANSI escape sequences.

| Parameter | Type | Required | Description |
|---|---|:---:|---|
| `title` | string | yes | Terminal title, up to 100 characters |
| `lines` | string[] | yes | 1 to 1,000 terminal lines |
| `output` | string | no | Output filename inside `SNAPMCP_DIR` |

Example:

```json
{
  "name": "capture_terminal",
  "arguments": {
    "title": "git log",
    "lines": [
      "$ git log --oneline -3",
      "a1b2c3d fix: handle null values",
      "e4f5g6h feat: add discovery hints",
      "# "
    ]
  }
}
```

### 2. `capture_code`

Render source code with Shiki syntax highlighting. Shiki supports 300+ bundled languages and 27 built-in themes. `startLine` and `endLine` are 1-indexed and inclusive; the selected range is rendered and receives line numbers.

| Parameter | Type | Required | Description |
|---|---|:---:|---|
| `code` | string | yes | Source text, up to 200 KB |
| `language` | string | no | Shiki language identifier; defaults to `text` |
| `title` | string | no | Display title; defaults to `code` |
| `startLine` | integer | no | First line to render, 1-indexed and inclusive |
| `endLine` | integer | no | Last line to render, 1-indexed and inclusive |
| `output` | string | no | Output filename inside `SNAPMCP_DIR` |

Example:

```json
{
  "name": "capture_code",
  "arguments": {
    "language": "typescript",
    "title": "src/index.ts",
    "code": "export const version = \"2.3.6\";\n",
    "startLine": 1,
    "endLine": 1
  }
}
```

### 3. `capture_browser`

Capture an HTTP(S) URL as a full-page or viewport PNG/JPEG. SSRF protection is default-on. The URL and each browser request are validated, including redirects and subresources.

| Parameter | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `url` | string | yes | — | HTTP(S) URL |
| `fullPage` | boolean | no | `false` | Capture the full scrollable page |
| `width` | integer | no | `1280` | Viewport width, 320 to 3,840 pixels |
| `height` | integer | no | `800` | Viewport height, 240 to 4,096 pixels |
| `output` | string | no | auto | Output filename inside `SNAPMCP_DIR` |

Example:

```json
{
  "name": "capture_browser",
  "arguments": {
    "url": "https://example.com",
    "fullPage": true,
    "width": 1440,
    "height": 900
  }
}
```

### 4. `capture_file`

Read a regular file, map its extension to a language, and render an inclusive line range as a highlighted PNG/JPEG. File reads are deny-all until `SNAPMCP_ALLOWED_PATHS` is configured. Allowed paths are resolved before the boundary check.

| Parameter | Type | Required | Description |
|---|---|:---:|---|
| `filePath` | string | yes | Path that must resolve inside the allowlist |
| `startLine` | integer | no | First line to render, 1-indexed and inclusive |
| `endLine` | integer | no | Last line to render, 1-indexed and inclusive |
| `output` | string | no | Output filename inside `SNAPMCP_DIR` |

Example:

```json
{
  "name": "capture_file",
  "arguments": {
    "filePath": "/home/user/project/src/index.ts",
    "startLine": 10,
    "endLine": 35
  }
}
```

### 5. `capture_markdown`

Render GitHub-flavored Markdown as a PNG/JPEG document. Tables, task lists, fenced code blocks, strikethrough, and autolinks are supported. Raw HTML in Markdown is escaped.

| Parameter | Type | Required | Description |
|---|---|:---:|---|
| `markdown` | string | yes | Markdown content, up to 200 KB |
| `title` | string | no | Document title; defaults to `document` |
| `output` | string | no | Output filename inside `SNAPMCP_DIR` |

### 6. `capture_html`

Render HTML and CSS as a PNG/JPEG in an isolated context with JavaScript disabled and network resources blocked. The DOM sanitizer removes active elements, event handlers, unsafe URL schemes, external references, and external CSS imports. Inline styles, `<style>` tags, and embedded data images are supported.

The sanitizer and CSP are defense in depth, not a guarantee of perfect sanitizer safety.

| Parameter | Type | Required | Description |
|---|---|:---:|---|
| `html` | string | yes | HTML content, up to 200 KB |
| `title` | string | no | Description used in the title area; defaults to `html` |
| `output` | string | no | Output filename inside `SNAPMCP_DIR` |

### 7. `capture_diff`

Render a unified diff as a PNG/JPEG, with additions highlighted in green and deletions in red.

| Parameter | Type | Required | Description |
|---|---|:---:|---|
| `diff` | string | yes | Unified diff content, up to 500 KB |
| `output` | string | no | Output filename inside `SNAPMCP_DIR` |

### 8. `capture_pdf`

Print a complete HTTP(S) URL document to a PDF with Chromium. The PDF contains the complete paginated document; there is no `fullPage` versus print-mode switch. SSRF protection is default-on.

| Parameter | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `url` | string | yes | — | HTTP(S) URL |
| `width` | integer | no | `1280` | Rendering viewport width, 320 to 3,840 pixels |
| `height` | integer | no | `800` | Rendering viewport height, 240 to 4,096 pixels |
| `output` | string | no | auto | `.pdf` filename inside `SNAPMCP_DIR` |

### 9. `capture_batch`

Capture up to 10 independent items in one call. Every item uses one of the flat primitive variants. Items are processed sequentially and each result is saved as an individual image.

| Parameter | Type | Required | Description |
|---|---|:---:|---|
| `captures` | capture union[] | yes | 1 to 10 flat capture items |
| `output` | string | no | Output subdirectory confined to `SNAPMCP_DIR` |

Example:

```json
{
  "name": "capture_batch",
  "arguments": {
    "captures": [
      {
        "type": "terminal",
        "title": "install",
        "lines": ["$ npm install", "added 42 packages"]
      },
      {
        "type": "diff",
        "diff": "--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1 +1 @@\n-old\n+new"
      }
    ]
  }
}
```

### 10. `capture_sequence`

Capture up to 60 ordered process steps. Each step is saved as an individual image in order. With `compileGif: true`, the steps are also compiled into a GIF. This tool does not create a side-by-side composite.

| Parameter | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `steps` | step union[] | yes | — | 1 to 60 ordered flat capture items |
| `compileGif` | boolean | no | `false` | Also compile a GIF; requires at least two steps |
| `frameDelay` | integer | no | `800` | GIF frame delay, 10 to 5,000 milliseconds |
| `loop` | boolean | no | `true` | `true` repeats forever; `false` plays once |
| `output` | string | no | auto | Output subdirectory confined to `SNAPMCP_DIR` |

### 11. `capture_gif`

Render 2 to 60 captures as PNG frames and compile them into a GIF. Intermediate PNG frames are removed after encoding. `loop: true` repeats forever; `loop: false` plays once.

| Parameter | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `title` | string | no | `animation` | Name used in the default filename, up to 100 characters |
| `captures` | capture union[] | yes | — | 2 to 60 flat capture frames |
| `frameDelay` | integer | no | `800` | Frame delay, 10 to 5,000 milliseconds |
| `loop` | boolean | no | `true` | `true` repeats forever; `false` plays once |
| `output` | string | no | auto | `.gif` filename inside `SNAPMCP_DIR` |

### 12. `capture_document`

Generate up to 30 captioned captures and embed them in a document. Embedded images are limited to 25 MB each and 75 MB total; exceeding a limit fails the call instead of silently producing an incomplete document.

- `markdown` writes a Markdown document with embedded data-URI image references.
- `html` writes a self-contained HTML document with embedded images.
- `pdf` writes a print-quality PDF with the generated captures embedded.

| Parameter | Type | Required | Default | Description |
|---|---|:---:|---|---|
| `title` | string | yes | — | Document title, 1 to 200 characters |
| `captures` | document capture union[] | yes | — | 1 to 30 flat captures, each with optional `caption` |
| `format` | enum | no | `markdown` | `markdown`, `html`, or `pdf` |
| `includeTimestamps` | boolean | no | `false` | Include capture timestamps |
| `output` | string | no | auto | Output filename; its extension must match the selected format |

### 13. `snapmcp-hint`

Find the right tool by natural-language intent, or request concise setup, security, browser, token, or agent guidance.

| Parameter | Type | Required | Description |
|---|---|:---:|---|
| `query` | string | no | Natural-language intent, up to 200 characters |
| `topic` | string | no | Legacy named topic, up to 50 characters |

Example:

```json
{
  "name": "snapmcp-hint",
  "arguments": {
    "query": "printable report with embedded screenshots"
  }
}
```

## Related

- [Agent Guide](agents.md) for selection and discovery workflows
- [Configuration](configuration.md) for environment variables
- [CLI Reference](cli.md) for capability discovery from a shell
- [Security Policy](../SECURITY.md) for enforced controls and limits
