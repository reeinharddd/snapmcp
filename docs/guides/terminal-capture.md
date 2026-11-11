# Terminal Capture Guide

Use `capture_terminal` to turn CLI output into a PNG or JPEG intended for a guide, tutorial, or PR description.

## Prompt markers

- A line beginning with `$ ` is rendered as a user prompt.
- A line beginning with `# ` is rendered as a root prompt.
- Other lines are rendered as command output.

The markers must begin the line and include the following space.

```json
{
  "name": "capture_terminal",
  "arguments": {
    "title": "install",
    "lines": [
      "$ npm install snapmcp",
      "added 42 packages",
      "# snapmcp doctor",
      "All checks passed"
    ]
  }
}
```

## Palette detection

Terminal color selection is heuristic. snapmcp can inspect common terminal configuration files, including Kitty, GNOME Terminal, Alacritty, and WezTerm, and can use environment or operating-system fallbacks.

It does not parse ANSI escape sequences. For reproducible output, set `SNAPMCP_THEME` explicitly and use the same value in every capture.

## Parameters

| Parameter | Type | Required | Description |
|---|---|:---:|---|
| `title` | string | yes | Terminal title, up to 100 characters |
| `lines` | string[] | yes | 1 to 1,000 lines |
| `output` | string | no | Output filename inside `SNAPMCP_DIR` |

## Keep output readable

- Prefer short lines that fit the captured viewport.
- Use blank strings between logical sections.
- Preserve leading spaces in indented output.
- Remove secrets, tokens, private hostnames, and personal paths before capture.
- Use `capture_code` for source code and `capture_diff` for a patch; do not disguise them as terminal output.

## Example

```json
{
  "name": "capture_terminal",
  "arguments": {
    "title": "npm test",
    "lines": [
      "$ npm test",
      "",
      " PASS  tests/example.test.ts",
      "  12 passed, 0 failed",
      "$ "
    ]
  }
}
```

The response contains the saved image path under `SNAPMCP_DIR`.

## Related

- [Tool Reference](../tools.md)
- [Configuration](../configuration.md)
- [GIF Animation Guide](gif-animation.md)
- [Security Policy](../../SECURITY.md)
