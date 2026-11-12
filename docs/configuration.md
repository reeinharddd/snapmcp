# Configuration Reference

snapmcp is configured with `SNAPMCP_*` environment variables. There is no required configuration file.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `SNAPMCP_DIR` | `./captures` | Root directory that confines every generated artifact |
| `SNAPMCP_FORMAT` | `png` | Image format: `png` or `jpeg` |
| `SNAPMCP_QUALITY` | `90` | JPEG quality from 1 to 100 |
| `SNAPMCP_THEME` | detected terminal palette, then `dark-plus` | One of 27 built-in Shiki themes |
| `SNAPMCP_FONT` | Ubuntu Mono and common monospace fallbacks | Font family for code and terminal captures |
| `SNAPMCP_FONT_SIZE` | `14px` | Font size for code and terminal captures |
| `SNAPMCP_TIMEOUT` | `30000` | Browser navigation timeout in milliseconds |
| `SNAPMCP_DEVICE_SCALE` | `2` | Device pixel ratio |
| `SNAPMCP_PADDING` | `32` | Inner padding in pixels |
| `SNAPMCP_SHADOW` | `none` | `none`, `soft`, `medium`, or `strong`; `sm`, `md`, and `lg` are aliases |
| `SNAPMCP_WINDOW_CHROME` | `false` | Show a macOS-style title bar |
| `SNAPMCP_BORDER_RADIUS` | `0` | Corner radius from 0 to 32 pixels |
| `SNAPMCP_BADGE` | `false` | Show the snapmcp footer badge |
| `SNAPMCP_CHROME_EXECUTABLE` | unset | Explicit path to a system Chrome or Chromium binary |
| `SNAPMCP_CHROME_CHANNEL` | unset | Playwright channel: `stable`, `beta`, `dev`, `canary`, `edge`, or `chromium` |
| `SNAPMCP_CHROME_PROFILE` | unset | Experimental persistent Chromium user-data directory: detected profile key/name or absolute path |
| `SNAPMCP_SSRF_PROTECTION` | `true` | Block private and local URL targets |
| `SNAPMCP_SECURITY_CHECKS` | `true` | Enable the broader validation layer |
| `SNAPMCP_ALLOWED_PATHS` | deny-all | Comma- or semicolon-separated file-read allowlist |
| `SNAPMCP_MAX_FILE_SIZE` | `5000000` | Maximum file read size in bytes |
| `SNAPMCP_LOG_FILE` | unset | Structured audit log path |
| `SNAPMCP_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error` |
| `SNAPMCP_CLEANUP_MAX` | `0` | Maximum retained image/PDF files in the output root; `0` disables cleanup |

## Output directory

`SNAPMCP_DIR` is a security boundary, not only a default location. Every generated file must resolve inside it, including files created by `capture_batch`, `capture_sequence`, `capture_gif`, and `capture_document`.

Traversal, absolute-path escapes, and symlink escapes are rejected. Relative output paths are resolved inside the configured root; an absolute path is accepted only when it resolves inside that root. Composite `output` directories are also confined to the configured root.

## Image format and quality

`SNAPMCP_FORMAT=png` produces lossless images. `SNAPMCP_FORMAT=jpeg` produces smaller files; `SNAPMCP_QUALITY` controls JPEG quality from 1 to 100.

An explicit image filename ending in `.png`, `.jpg`, or `.jpeg` determines the bytes and extension for that capture.

## Themes

snapmcp provides 27 built-in Shiki themes:

`dark-plus`, `dracula`, `github-dark`, `github-dark-dimmed`, `github-light`, `monokai`, `nord`, `one-dark-pro`, `one-light`, `poimandres`, `solarized-dark`, `solarized-light`, `vitesse-dark`, `vitesse-light`, `min-dark`, `min-light`, `tokyo-night`, `ayu-dark`, `ayu-light`, `catppuccin-mocha`, `catppuccin-latte`, `rose-pine`, `rose-pine-dawn`, `rose-pine-moon`, `slack-dark`, `slack-ochin`, and `snazzy-light`.

Shiki supports 300+ bundled languages. Common languages are preloaded; other bundled languages are loaded on demand.

## Terminal colors

Terminal palette detection is heuristic. snapmcp can read colors from common terminal configuration files, including Kitty, GNOME Terminal, Alacritty, and WezTerm, and can use environment or OS fallbacks.

It does not parse ANSI escape sequences. If detection is unavailable, the configured Shiki theme provides the terminal palette.

Terminal lines beginning with `$ ` are rendered as user prompts. Lines beginning with `# ` are rendered as root prompts.

## Browser selection

Playwright's bundled Chromium is the reproducible default. Install it with:

```bash
snapmcp init
```

A system browser is opt-in. Set its executable explicitly:

```bash
export SNAPMCP_CHROME_EXECUTABLE=/usr/bin/google-chrome
```

`SNAPMCP_CHROME_CHANNEL` selects a Playwright-managed channel instead.

### Experimental profile support

`SNAPMCP_CHROME_PROFILE` launches Chromium with a persistent user-data directory. A detected profile key or display name, such as `Default` or `Profile 1`, selects the detected Chrome user-data directory and adds `--profile-directory=<key>`; an absolute path is used as the user-data directory directly. Profile mode requires a system Chrome installation. URL captures run in that persistent context, so cookies and session state from the selected profile can be sent to the target site. Synthetic captures remain isolated. Use a dedicated profile and treat it as sensitive.

Use a dedicated profile rather than a live personal profile. Profile data may include cookies, extensions, local storage, and credentials.

## SSRF protection

`SNAPMCP_SSRF_PROTECTION=true` is the default. URL tools accept HTTP(S) only and block:

- private, loopback, link-local, multicast, and reserved IPv4 ranges;
- private, loopback, link-local, multicast, and reserved IPv6 ranges;
- IPv4-mapped IPv6 addresses;
- localhost variants;
- hostnames that resolve to private or local addresses.

Browser requests are revalidated as they occur, including redirects and subresources.

URL captures run through a local validating proxy that resolves and validates every target itself and connects to the validated IP literal, so there is no DNS-rebinding window between check and connection. The remaining limit is resolver trust, so use network isolation for hostile targets.

Setting `SNAPMCP_SSRF_PROTECTION=false` disables SSRF checks. It is not recommended outside a controlled test environment.

## File-read allowlist

File reads are denied unless `SNAPMCP_ALLOWED_PATHS` is configured. Entries may be files or directories and may be separated with commas or semicolons:

```bash
export SNAPMCP_ALLOWED_PATHS="/home/user/project,/home/user/project/config/settings.json"
```

Allowed paths are resolved before the boundary check. Symlinks cannot be used to read outside an allowed path.

## Security validation switch

`SNAPMCP_SECURITY_CHECKS=false` disables the broader validation layer, including the file-read allowlist and additional byte/file-size checks. Output confinement, HTTP(S)-only URL validation, and the separate `SNAPMCP_SSRF_PROTECTION` setting remain in force. This switch is intended only for controlled debugging and should not be used for shared or hostile workloads.

Synthetic captures retain their dedicated isolation: JavaScript is disabled, network resources are blocked, and a restrictive CSP applies. Markdown raw HTML is escaped and raw HTML input is DOM-sanitized. Sanitization is defense in depth, not a perfect-safety guarantee.

## Related

- [CLI Reference](cli.md)
- [Agent Guide](agents.md)
- [Browser Capture Guide](guides/browser-capture.md)
- [Terminal Capture Guide](guides/terminal-capture.md)
- [Security Policy](../SECURITY.md)
