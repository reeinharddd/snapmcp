# Browser Capture Guide

Use `capture_browser` for screenshots and `capture_pdf` for a print-quality PDF of an HTTP(S) document.

## Browser selection

Playwright's bundled Chromium is the reproducible default:

```bash
snapmcp init
```

A system browser is selected explicitly:

```bash
export SNAPMCP_CHROME_EXECUTABLE=/usr/bin/google-chrome
```

`SNAPMCP_CHROME_CHANNEL` can instead select a Playwright-managed channel such as `stable`, `beta`, `dev`, `canary`, `edge`, or `chromium`.

### Experimental profiles

`SNAPMCP_CHROME_PROFILE` launches Chromium with a persistent user-data directory. A detected profile key or display name, such as `Default` or `Profile 1`, selects the detected Chrome user-data directory and adds `--profile-directory=<key>`; an absolute path is used as the user-data directory directly. Profile mode requires a system Chrome installation.

URL captures run in the selected persistent context, so cookies and session state from that profile can be sent to the target site. Synthetic captures remain isolated.

Use a dedicated profile. Do not point snapmcp at a live personal profile unless access to its cookies, extensions, and stored credentials is intentional.

## Screenshot a page

```json
{
  "name": "capture_browser",
  "arguments": {
    "url": "https://example.com/docs",
    "fullPage": true,
    "width": 1440,
    "height": 900
  }
}
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `url` | string | required | HTTP(S) URL |
| `fullPage` | boolean | `false` | Capture the full scrollable page |
| `width` | integer | `1280` | Viewport width, 320 to 3,840 pixels |
| `height` | integer | `800` | Viewport height, 240 to 4,096 pixels |
| `output` | string | auto | Output filename inside `SNAPMCP_DIR` |

## Print a URL to PDF

```json
{
  "name": "capture_pdf",
  "arguments": {
    "url": "https://example.com/docs",
    "width": 1280,
    "height": 800,
    "output": "example-docs.pdf"
  }
}
```

`capture_pdf` prints the complete paginated document with Chromium. It does not expose a `fullPage` versus print-mode switch.

The width and height parameters control the responsive rendering viewport before pagination.

## SSRF protection

SSRF protection is default-on. URL tools accept HTTP(S) only and block:

- private and local IPv4 and IPv6 literals;
- IPv4-mapped IPv6 addresses;
- localhost variants;
- hostnames that resolve to private or local addresses.

The initial URL and browser requests are revalidated, including redirects and subresources.

Chromium does not pin the DNS-resolved IP that snapmcp validated. This reduces common SSRF paths but does not guarantee complete DNS-rebinding prevention. Use a container or VM without internal network access for hostile targets.

`SNAPMCP_SSRF_PROTECTION=false` disables these checks. Do not use that setting for shared services.

## Local development targets

By default, `http://localhost:3000` and private development addresses are blocked because they are local or private targets. Use a controlled test environment if the switch is disabled, and do not expose that configuration to untrusted agents.

## Tips

- Full-page captures are useful for articles and long documentation pages.
- Viewport captures produce more consistent dimensions for dashboards and application views.
- Keep the browser viewport and padding consistent across frames in an animation.
- Review the captured page for secrets before publishing it.
- Browser captures can expose content that is public on the network but sensitive in context.

## Related

- [Tool Reference](../tools.md)
- [Configuration](../configuration.md)
- [Security Policy](../../SECURITY.md)
- [GIF Animation Guide](gif-animation.md)
