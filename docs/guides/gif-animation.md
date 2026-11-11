# GIF Animation Guide

Use `capture_gif` for an explicit animation and `capture_sequence` when ordered step images are the primary deliverable.

## Flat capture entries

Both tools use flat discriminated unions. The `type` discriminator and the type-specific fields are siblings; there is no nested `params` object.

```json
{
  "captures": [
    {
      "type": "terminal",
      "title": "install",
      "lines": ["$ npm install", "added 42 packages"]
    },
    {
      "type": "terminal",
      "title": "test",
      "lines": ["$ npm test", "42 tests passed"]
    }
  ]
}
```

Supported primitive types are `terminal`, `code`, `file`, `browser`, `markdown`, `html`, and `diff`.

## `capture_gif`

`capture_gif` renders 2 to 60 captures as PNG frames and compiles them into a GIF. Intermediate PNG frames are removed after encoding.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `title` | string | `animation` | Name used in the default filename |
| `captures` | capture union[] | required | 2 to 60 frames |
| `frameDelay` | integer | `800` | Delay from 10 to 5,000 milliseconds |
| `loop` | boolean | `true` | `true` repeats forever; `false` plays once |
| `output` | string | auto | `.gif` filename inside `SNAPMCP_DIR` |

Example:

```json
{
  "name": "capture_gif",
  "arguments": {
    "title": "build-walkthrough",
    "captures": [
      {
        "type": "code",
        "language": "typescript",
        "code": "const before = 1;"
      },
      {
        "type": "code",
        "language": "typescript",
        "code": "const after = 2;"
      }
    ],
    "frameDelay": 1200,
    "loop": false,
    "output": "build-walkthrough.gif"
  }
}
```

## `capture_sequence`

`capture_sequence` captures up to 60 ordered steps and saves each step as an individual image. With `compileGif: true`, it also creates a GIF alongside those images.

It does not create a side-by-side composite.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `steps` | step union[] | required | 1 to 60 ordered steps |
| `compileGif` | boolean | `false` | Also compile a GIF; requires at least two steps |
| `frameDelay` | integer | `800` | Delay from 10 to 5,000 milliseconds |
| `loop` | boolean | `true` | `true` repeats forever; `false` plays once |
| `output` | string | auto | Output subdirectory inside `SNAPMCP_DIR` |

Each step may also include `stepNumber` and `label`.

```json
{
  "name": "capture_sequence",
  "arguments": {
    "steps": [
      {
        "type": "terminal",
        "stepNumber": 1,
        "label": "checkout",
        "title": "checkout",
        "lines": ["$ git checkout main", "Already on main"]
      },
      {
        "type": "terminal",
        "stepNumber": 2,
        "label": "test",
        "title": "test",
        "lines": ["$ npm test", "42 tests passed"]
      }
    ],
    "compileGif": true,
    "frameDelay": 1000,
    "loop": false
  }
}
```

## Frame consistency

Frames are normalized to a common canvas for the GIF. For cleaner results:

- use the same browser width and height for browser frames;
- keep terminal line counts and padding similar;
- use the same `SNAPMCP_THEME` for every frame;
- avoid mixing very large and very small captures in one animation.

## Related

- [Tool Reference](../tools.md)
- [Agent Guide](../agents.md)
- [Workflow Examples](workflow-examples.md)
- [Security Policy](../../SECURITY.md)
