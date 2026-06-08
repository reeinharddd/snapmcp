# snapmcp 📸

**All-in-one MCP server for visual captures.** Generate screenshots of terminals, code, web pages, markdown documents, HTML snippets, diffs, and PDFs — all through a single MCP server powered by Playwright.

No more juggling 4 different MCP servers for your visual capture needs.

## Features

| Tool | Description |
|------|-------------|
| `capture_terminal` | Synthetic terminal output with syntax-colored prompts |
| `capture_code` | Syntax-highlighted code via Shiki (50+ languages, 27 themes) |
| `capture_browser` | Full-page or viewport URL screenshots |
| `capture_file` | File → auto-detected language → highlighted screenshot |
| `capture_markdown` | Rendered markdown as a styled document screenshot |
| `capture_html` | Arbitrary HTML snippet rendered as image |
| `capture_diff` | Git diffs with green additions / red deletions |
| `capture_pdf` | URL → PDF document |

## Quick Start

```bash
# Install globally
npm install -g snapmcp

# Or run directly
npx snapmcp
```

## Installation Guides

<details>
<summary><strong>Claude Code</strong></summary>

Add to your `~/.claude/claude.json`:

```json
{
  "mcpServers": {
    "snapmcp": {
      "command": "npx",
      "args": ["-y", "snapmcp"],
      "env": {
        "SNAPMCP_DIR": "/path/to/snapshots",
        "SNAPMCP_THEME": "nord"
      }
    }
  }
}
```
</details>

<details>
<summary><strong>OpenCode</strong></summary>

Add to your `opencode.json`:

```json
{
  "mcpServers": {
    "snapmcp": {
      "command": "npx",
      "args": ["-y", "snapmcp"],
      "env": {
        "SNAPMCP_DIR": "./snapshots",
        "SNAPMCP_FORMAT": "jpeg",
        "SNAPMCP_QUALITY": "95"
      }
    }
  }
}
```
</details>

<details>
<summary><strong>VS Code / Cline</strong></summary>

Add to your VS Code settings (`settings.json` → `cline.mcpServers` or `roo-cline.mcpServers`):

```json
{
  "mcpServers": {
    "snapmcp": {
      "command": "npx",
      "args": ["-y", "snapmcp"],
      "env": {
        "SNAPMCP_DIR": "/path/to/snapshots"
      },
      "disabled": false,
      "autoApprove": ["capture_terminal", "capture_code"]
    }
  }
}
```
</details>

<details>
<summary><strong>Continue (JetBrains / VS Code)</strong></summary>

Add to `~/.continue/config.json`:

```json
{
  "experimental": {
    "mcpServers": {
      "snapmcp": {
        "command": "npx",
        "args": ["-y", "snapmcp"]
      }
    }
  }
}
```
</details>

<details>
<summary><strong>Cursor</strong></summary>

Add to your Cursor MCP configuration:

```json
{
  "mcpServers": {
    "snapmcp": {
      "command": "npx",
      "args": ["-y", "snapmcp"]
    }
  }
}
```
</details>

<details>
<summary><strong>Windsurf</strong></summary>

Add to your Windsurf MCP configuration:

```json
{
  "mcpServers": {
    "snapmcp": {
      "command": "npx",
      "args": ["-y", "snapmcp"]
    }
  }
}
```
</details>

## Configuration

All options via environment variables with sensible defaults:

| Variable | Default | Description |
|----------|---------|-------------|
| `SNAPMCP_DIR` | `./snapshots` | Output directory |
| `SNAPMCP_FORMAT` | `png` | Output format: `png` or `jpeg` |
| `SNAPMCP_QUALITY` | `90` | JPEG quality (1-100, jpeg only) |
| `SNAPMCP_THEME` | `dark-plus` | Color theme (see below) |
| `SNAPMCP_FONT` | `'Ubuntu Mono',...` | Font family override |
| `SNAPMCP_FONT_SIZE` | `14px` | Font size |
| `SNAPMCP_TIMEOUT` | `30000` | Browser timeout in ms |
| `SNAPMCP_DEVICE_SCALE` | `2` | Device pixel ratio (2 = retina) |
| `SNAPMCP_CLEANUP_MAX` | `0` | Auto-delete oldest files when count exceeds N (0 = no limit) |
| `SNAPMCP_FILE_SIZE_LIMIT` | `5242880` | Max file read size in bytes (5 MB) |
| `SNAPMCP_ALLOWED_PATHS` | `""` | Comma-separated allowed paths for file reads |
| `SNAPMCP_SECURITY_CHECKS` | `true` | Enable/disable security validations |
| `SNAPMCP_LOG_LEVEL` | `info` | Log level: error, warn, info, debug |

### Visual Options

| Variable | Default | Description |
|----------|---------|-------------|
| `SNAPMCP_PADDING` | `32` | Inner padding inside the capture window (px) |
| `SNAPMCP_SHADOW` | `soft` | Window drop-shadow: `none`, `soft`, `medium`, `strong` |
| `SNAPMCP_WINDOW_CHROME` | `true` | macOS-style title bar (traffic light buttons) on/off |
| `SNAPMCP_BORDER_RADIUS` | `8` | Capture window corner radius (px, 0–32) |
| `SNAPMCP_BADGE` | `false` | Subtle "snapmcp" badge in the window footer |

### Available Themes (27)

snapmcp pre-loads every theme Shiki ships — switch instantly with `SNAPMCP_THEME`:

| Dark Themes | Light Themes |
|-------------|--------------|
| `dark-plus` (default) | `github-light` |
| `github-dark` | `solarized-light` |
| `github-dark-dimmed` | `vitesse-light` |
| `monokai` | `catppuccin-latte` |
| `nord` | `ayu-light` |
| `solarized-dark` | `one-light` |
| `dracula` | `min-light` |
| `one-dark-pro` | `slack-ochin` |
| `tokyo-night` | `snazzy-light` |
| `catppuccin-mocha` | `rose-pine-dawn` |
| `vitesse-dark` | |
| `ayu-dark` | |
| `min-dark` | |
| `poimandres` | |
| `rose-pine` | |
| `rose-pine-moon` | |
| `slack-dark` | |

## Output

Files are saved to `SNAPMCP_DIR` (default: `./snapshots/`) with auto-generated names like:

```
snapshots/
├── terminal-1717000000000.png
├── code-1717000000001.jpg
├── browser-1717000000002.png
├── markdown-1717000000003.png
├── diff-1717000000004.png
└── pdf-1717000000005.pdf
```

Set `SNAPMCP_CLEANUP_MAX` to auto-purge old files when the count exceeds your limit.

## Docker

```bash
docker run -i --init -v $(pwd)/snapshots:/app/snapshots ghcr.io/erik/snapmcp
```

## Development

```bash
git clone https://github.com/erik/snapmcp
cd snapmcp

# Install with bun (recommended)
bun install
bunx playwright install chromium
bun run build
bun start

# Or with npm
npm install
npx playwright install chromium
npm run build
npm start
```

### Testing

```bash
bun test        # with bun
npm test         # with npm
```

### Setup script

```bash
bun run setup    # Installs Chromium + creates output dir
```

## Requirements

- Node.js 20+ or Bun 1.2+
- Chromium (install via `bun run setup` or `npx playwright install chromium`)

## Security

snapmcp includes built-in security protections:

- **Path traversal prevention** on all file operations
- **Input size limits** per tool (code: 200KB, markdown: 200KB, diff: 500KB, etc.)
- **File read validation** (max 5MB, optional path allowlist)
- **Chromium sandbox detection** at startup
- **Dependency pinning** — all deps locked to exact versions

See [SECURITY.md](SECURITY.md) for full details.

## License

MIT
