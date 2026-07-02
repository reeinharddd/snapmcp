# GIF Animation Guide

Snapmcp can compile sequences of captures into animated GIFs. Two tools handle
this: `create_gif` for a single animation from existing captures, and
`create_sequence` for a step-by-step process that combines capture and
compilation.

## Using `create_gif`

The `create_gif` tool takes an array of capture definitions and compiles them
into one animated GIF. Each frame can be any capture type: terminal, code,
file, browser, markdown, diff, or HTML.

```json
{
  "name": "create_gif",
  "arguments": {
    "title": "demo workflow",
    "captures": [
      { "type": "terminal", "params": { "title": "install", "lines": ["$ npm install", "✓ done"] } },
      { "type": "terminal", "params": { "title": "build", "lines": ["$ npm run build", "✓ built"] } },
      { "type": "terminal", "params": { "title": "test", "lines": ["$ npm test", "✓ passed"] } }
    ],
    "frameDelay": 800,
    "loop": true
  }
}
```

Parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | `"animation"` | Name for the GIF (used in filename) |
| `captures` | array | required | 2-60 capture frame definitions |
| `frameDelay` | number | `800` | Milliseconds per frame |
| `loop` | boolean | `true` | Whether the GIF loops |
| `output` | string | auto | Custom output filename |

### Capture Frame Types

Each frame in the `captures` array is an object with `type`, `params`, and an
optional `label`:

```json
{ "type": "terminal", "params": { "title": "...", "lines": [...] }, "label": "step 1" }
```

Types and their params:

| Type | Required Params |
|------|----------------|
| `terminal` | `title` (string), `lines` (string[]) |
| `code` | `code` (string), `language` (string) |
| `file` | `filePath` (string) |
| `browser` | `url` (string) |
| `markdown` | `markdown` (string) |
| `diff` | `diff` (string) |
| `html` | `html` (string) |

Each frame is rendered separately, then compiled into the GIF. All frames
share the same dimensions (determined by the first frame).

## Using `create_sequence`

The `create_sequence` tool combines capture and animation in one call. Each
step defines a capture, and you can optionally compile them into a GIF at the
end.

```json
{
  "name": "create_sequence",
  "arguments": {
    "steps": [
      { "type": "terminal", "stepNumber": 1, "label": "install",
        "params": { "title": "install", "lines": ["$ npm install", "✓ done"] } },
      { "type": "terminal", "stepNumber": 2, "label": "build",
        "params": { "title": "build", "lines": ["$ npm run build", "✓ built"] } }
    ],
    "compileGif": true,
    "frameDelay": 1000,
    "loop": false
  }
}
```

Parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `steps` | array | required | 1-60 step definitions |
| `compileGif` | boolean | `false` | Compile frames into an animated GIF |
| `frameDelay` | number | `800` | Milliseconds per frame (only if compileGif) |
| `loop` | boolean | `true` | Whether the GIF loops (only if compileGif) |
| `output` | string | auto | Output directory (defaults to `SNAPMCP_DIR`) |

Each step can also include `stepNumber` and `label` for identification.

## Frame Dimensions

GIF frames are rendered at the size of the first frame. Mixed types
(terminal + browser frames) work, but the dimensions might shift between
frames. To keep things uniform:

- Use the same `width` and `height` across browser captures
- Terminal captures auto-size to content; keep line counts similar
- Set `SNAPMCP_PADDING` consistently so spacing matches

## Delay and Looping

- **Frame delay** (`frameDelay`): 300-500ms for fast transitions, 800-1200ms
  for readable walkthroughs. Below 200ms can be hard to follow.
- **Looping** (`loop`): `true` for GIFs shown inline (they loop by default in
  most viewers). `false` for documentation sequences where the viewer should
  see it once and stop.

## Examples

### Code change walkthrough

```json
{
  "name": "create_gif",
  "arguments": {
    "title": "refactor",
    "captures": [
      { "type": "code", "params": { "code": "function oldWay() { return null; }", "language": "javascript" } },
      { "type": "code", "params": { "code": "function newWay() { return 'hello'; }", "language": "javascript" } },
      { "type": "terminal", "params": { "title": "test", "lines": ["$ npm test", "PASS"] } }
    ],
    "frameDelay": 600,
    "loop": false
  }
}
```

### Multi-step with `create_sequence`

```json
{
  "name": "create_sequence",
  "arguments": {
    "steps": [
      { "type": "terminal", "stepNumber": 1,
        "params": { "title": "start", "lines": ["$ git status", "nothing to commit"] } },
      { "type": "file", "stepNumber": 2,
        "params": { "filePath": "/path/to/source.ts" } },
      { "type": "terminal", "stepNumber": 3,
        "params": { "title": "commit", "lines": ["$ git commit -m 'fix'", "[main a1b2c3d] fix"] } }
    ],
    "compileGif": true,
    "frameDelay": 1000
  }
}
```

## Related

- [Terminal Capture Guide](terminal-capture.md) -- creating terminal frames
- [Browser Capture Guide](browser-capture.md) -- creating browser frames
- [Configuration Reference](../configuration.md) -- output directory and
  padding settings
- [CLI Commands](../cli.md) -- running `snapmcp test` to verify captures work
