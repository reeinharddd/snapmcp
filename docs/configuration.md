# Configuration Reference

All configuration is done through environment variables. There is no config
file. Set these before starting the MCP server or running CLI commands.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SNAPMCP_DIR` | `./captures` | Output directory for all captures |
| `SNAPMCP_FORMAT` | `png` | Image format: `png` or `jpeg` |
| `SNAPMCP_QUALITY` | `90` | JPEG quality (1-100, only used for JPEG) |
| `SNAPMCP_THEME` | `auto` | Shiki syntax highlighting theme (see list below) |
| `SNAPMCP_FONT` | `Fira Code, JetBrains Mono, Consolas, monospace` | Font family for code/terminal captures |
| `SNAPMCP_FONT_SIZE` | `14px` | Font size for code/terminal captures |
| `SNAPMCP_TIMEOUT` | `30000` | Browser timeout in milliseconds |
| `SNAPMCP_DEVICE_SCALE` | `2` | Device pixel ratio (2 = Retina quality) |
| `SNAPMCP_PADDING` | `32` | Inner padding in pixels around content |
| `SNAPMCP_SHADOW` | `none` | Shadow level: `none`, `sm`, `md`, `lg` |
| `SNAPMCP_WINDOW_CHROME` | `false` | Show macOS-style title bar on screenshots |
| `SNAPMCP_BORDER_RADIUS` | `0` | Corner radius in pixels for the screenshot |
| `SNAPMCP_BADGE` | `false` | Show footer badge with snapmcp branding |
| `SNAPMCP_CHROME_EXECUTABLE` | `--` | Path to system Chrome binary |
| `SNAPMCP_CHROME_CHANNEL` | `--` | Chrome channel: `chrome`, `msedge`, `chromium` |
| `SNAPMCP_CHROME_PROFILE` | `--` | Path to Chrome profile directory |
| `SNAPMCP_SSRF_PROTECTION` | `false` | Block requests to private IP ranges |
| `SNAPMCP_ALLOWED_PATHS` | `(deny all)` | Comma-separated allowlist for file reads |
| `SNAPMCP_MAX_FILE_SIZE` | `5242880` | Max file read size in bytes (5 MB) |
| `SNAPMCP_LOG_FILE` | `--` | File path for the audit log |
| `SNAPMCP_LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `SNAPMCP_CLEANUP_MAX` | `0` | Auto-delete captures older than N days (0 = off) |
| `SNAPMCP_SECURITY_CHECKS` | `true` | Enable security checks (`true`/`false`) |

## SNAPMCP_DIR

All captures go here unless you pass an explicit `output` parameter to a tool.
The directory is created automatically if it doesn't exist.

## SNAPMCP_FORMAT and SNAPMCP_QUALITY

Use JPEG for smaller file sizes at the cost of some fidelity. Quality only
applies when format is `jpeg`.

## SNAPMCP_THEME

Set to `auto` to let snapmcp detect your terminal theme. The detection chain is:

1. `SNAPMCP_THEME` environment variable (explicit override)
2. `COLORFGBG` environment variable (terminal light/dark detection)
3. OS-level theme (macOS dark mode, GNOME dark preference)
4. Falls back to `dracula`

### Available Themes (27)

| Theme | Style |
|-------|-------|
| `dracula` | Dark |
| `one-dark-pro` | Dark |
| `nord` | Dark |
| `tokyo-night` | Dark |
| `catppuccin-mocha` | Dark |
| `catppuccin-latte` | Light |
| `ayu-dark` | Dark |
| `ayu-light` | Light |
| `vitesse-dark` | Dark |
| `vitesse-light` | Light |
| `min-dark` | Dark |
| `min-light` | Light |
| `poimandres` | Dark |
| `rose-pine` | Dark |
| `rose-pine-moon` | Dark |
| `rose-pine-dawn` | Light |
| `slack-dark` | Dark |
| `slack-ochin` | Light |
| `snazzy-light` | Light |
| `github-dark-dimmed` | Dark |
| `github-light` | Light |
| `one-light` | Light |
| `solarized-light` | Light |
| `solarized-dark` | Dark |
| `material-theme` | Dark |
| `material-theme-lighter` | Light |
| `material-theme-ocean` | Dark |

## SNAPMCP_CHROME_EXECUTABLE and SNAPMCP_CHROME_PROFILE

Use these to point snapmcp at a real Chrome installation with your profiles,
cookies, and sessions. See the [Browser Capture Guide](guides/browser-capture.md)
for details on how Chrome detection works.

Without these, snapmcp uses Playwright's bundled Chromium.

## SNAPMCP_SSRF_PROTECTION

When enabled, snapmcp blocks requests to:

- `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
- `169.254.0.0/16` (link-local)
- `::1`, `fd00::/8` (IPv6 loopback and unique local)

## SNAPMCP_ALLOWED_PATHS

Controls which files the `capture_file` tools can read. By default, reads from
arbitrary paths are denied. Set to a comma-separated list of directories or
file paths:

```bash
export SNAPMCP_ALLOWED_PATHS="/home/user/projects,/etc/config.yaml"
```

## SNAPMCP_SECURITY_CHECKS

When `false`, skips path allowlist validation and SSRF checks. Only disable
this in trusted environments.

## Related

- [CLI Commands](cli.md) -- how to start the server and use utility commands
- [Terminal Capture Guide](guides/terminal-capture.md) -- theme detection and
  terminal screenshots
- [Browser Capture Guide](guides/browser-capture.md) -- Chrome configuration
  and authenticated pages
