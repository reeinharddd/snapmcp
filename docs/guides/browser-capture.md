# Browser Capture Guide

Use the `capture_browser` tool to take screenshots of web pages. You can also
convert pages to PDF with `capture_pdf`.

## How System Chrome Detection Works

When you set `SNAPMCP_CHROME_EXECUTABLE`, snapmcp uses your system Chrome
instead of Playwright's bundled Chromium. This lets you access authenticated
sessions, cookies, and browser profiles.

The detection follows an 8-step priority chain:

1. **`SNAPMCP_CHROME_EXECUTABLE`** -- explicit path. If set, snapmcp uses
   this directly and skips all other detection.
2. **`SNAPMCP_CHROME_CHANNEL`** -- named channel: `chrome`, `msedge`, or
   `chromium`. Only works on macOS and Windows via Playwright's channel
   discovery.
3. **`SNAPMCP_CHROME_PROFILE`** -- path to a Chrome user data directory. If
   set, snapmcp launches Chrome with `--user-data-dir` pointing to it.
4. **macOS default install** -- checks `/Applications/Google Chrome.app`
5. **Linux default install** -- checks `google-chrome`, `google-chrome-stable`,
   `chromium-browser` in `$PATH`
6. **Windows default install** -- checks `Program Files` Chrome locations
7. **Playwright Chromium** -- falls back to `npx playwright install chromium`
   location
8. **Error** -- if nothing is found, the tool returns an error telling you to
   install Chrome or set `SNAPMCP_CHROME_EXECUTABLE`

## Using a Real Browser Profile

To take authenticated screenshots (pages behind a login), point snapmcp to
your real Chrome profile:

```bash
export SNAPMCP_CHROME_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
export SNAPMCP_CHROME_PROFILE="$HOME/Library/Application Support/Google Chrome/Default"
```

On Linux:

```bash
export SNAPMCP_CHROME_EXECUTABLE="/usr/bin/google-chrome"
export SNAPMCP_CHROME_PROFILE="$HOME/.config/google-chrome/Default"
```

Now `capture_browser` will use your existing sessions, cookies, and
extensions. Log in to the site in your normal browser, then use snapmcp to
capture it.

## Using `capture_browser`

```json
{
  "name": "capture_browser",
  "arguments": {
    "url": "https://example.com",
    "fullPage": true,
    "width": 1280,
    "height": 800
  }
}
```

Parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required | URL to capture |
| `fullPage` | boolean | `false` | Capture the full scrollable page |
| `width` | number | `1280` | Viewport width in pixels |
| `height` | number | `800` | Viewport height in pixels |
| `output` | string | auto | Custom output filename |

## PDF Capture from URL

Use `capture_pdf` to convert a web page to PDF:

```json
{
  "name": "capture_pdf",
  "arguments": {
    "url": "https://example.com/report",
    "fullPage": true,
    "width": 1280,
    "height": 800
  }
}
```

Parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | required | URL to convert |
| `fullPage` | boolean | `true` | Include all content (vs screen only) |
| `width` | number | `1280` | Viewport width |
| `height` | number | `800` | Viewport height |
| `output` | string | auto | Custom output filename |

## SSRF Protection

By default, snapmcp allows requests to any URL. To block requests to internal
networks, set `SNAPMCP_SSRF_PROTECTION=true`. This blocks private IP ranges:

- `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
- `169.254.0.0/16`
- `::1`, `fd00::/8`

Enable this when snapmcp is used in a shared or server environment where
users could point it at internal services.

## Tips

**Full page captures work best for articles and docs.** Single-viewport
captures work best for dashboards and apps.

**Set a longer `waitFor` on JS-heavy pages.** Some SPAs need extra time to
render. Use the `waitFor` parameter (in milliseconds) if your capture target
supports it.

**Use `fullPage: false` for consistent heights.** Full page captures can vary
in height depending on content. If you need a fixed size, keep fullPage off.

## Related

- [Configuration Reference](../configuration.md) -- Chrome-related env vars
  and SSRF config
- [CLI Commands](../cli.md) -- running `snapmcp doctor` to verify Chrome
  detection
- [Terminal Capture Guide](terminal-capture.md) -- capturing terminal output
- [GIF Animation Guide](gif-animation.md) -- creating animations from browser
  sequences
