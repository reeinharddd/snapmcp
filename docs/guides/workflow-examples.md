# Workflow Examples

These examples use the actual flat composite schemas. Each capture entry has `type` and its type-specific fields at the same level.

## PR documentation

Capture terminal evidence, a highlighted implementation, and a visual diff as one batch:

```json
{
  "name": "capture_batch",
  "arguments": {
    "captures": [
      {
        "type": "terminal",
        "title": "tests",
        "lines": [
          "$ npm test",
          " PASS  tests/ui.test.ts",
          " 12 passed, 0 failed"
        ]
      },
      {
        "type": "code",
        "language": "typescript",
        "title": "src/useTheme.ts",
        "code": "export function useTheme() {\n  return { theme, toggle };\n}\n",
        "startLine": 1,
        "endLine": 3
      },
      {
        "type": "diff",
        "diff": "--- a/src/App.tsx\n+++ b/src/App.tsx\n@@ -1,2 +1,3 @@\n import { Header } from './Header';\n+import { ThemeToggle } from './ThemeToggle';\n export { App };"
      }
    ],
    "output": "pr-142"
  }
}
```

The result contains individual image paths under the confined `pr-142` subdirectory.

## Before-and-after animation

```json
{
  "name": "capture_gif",
  "arguments": {
    "title": "login-redesign",
    "captures": [
      {
        "type": "browser",
        "url": "https://example.com/login?version=before",
        "fullPage": true,
        "width": 1280,
        "height": 800
      },
      {
        "type": "browser",
        "url": "https://example.com/login?version=after",
        "fullPage": true,
        "width": 1280,
        "height": 800
      }
    ],
    "frameDelay": 2000,
    "loop": false,
    "output": "login-redesign.gif"
  }
}
```

`loop: false` plays the animation once. Set `loop: true` for an infinite loop.

## Ordered CI pipeline walkthrough

```json
{
  "name": "capture_sequence",
  "arguments": {
    "steps": [
      {
        "type": "terminal",
        "stepNumber": 1,
        "label": "install",
        "title": "install",
        "lines": ["$ npm ci", "installed 420 packages"]
      },
      {
        "type": "terminal",
        "stepNumber": 2,
        "label": "test",
        "title": "test",
        "lines": ["$ npm test", "42 tests passed"]
      },
      {
        "type": "terminal",
        "stepNumber": 3,
        "label": "build",
        "title": "build",
        "lines": ["$ npm run build", "build complete"]
      }
    ],
    "compileGif": true,
    "frameDelay": 1200,
    "loop": false,
    "output": "ci-pipeline"
  }
}
```

This saves three ordered individual images and an optional GIF. It does not create a side-by-side composite.

## Interactive tutorial document

```json
{
  "name": "capture_document",
  "arguments": {
    "title": "Getting Started",
    "format": "pdf",
    "includeTimestamps": false,
    "captures": [
      {
        "type": "markdown",
        "markdown": "# Getting Started\n\nCreate a project and run the test suite.",
        "caption": "Introduction"
      },
      {
        "type": "terminal",
        "title": "create project",
        "lines": ["$ npm create example-app", "Project created"],
        "caption": "Create the project"
      },
      {
        "type": "code",
        "language": "typescript",
        "title": "src/index.ts",
        "code": "console.log('hello');\n",
        "caption": "Entry point"
      }
    ],
    "output": "getting-started.pdf"
  }
}
```

The PDF is a print-quality document with the generated captures embedded.

## Code review package

```json
{
  "name": "capture_batch",
  "arguments": {
    "captures": [
      {
        "type": "diff",
        "diff": "--- a/src/auth.ts\n+++ b/src/auth.ts\n@@ -1 +1 @@\n-const expiresIn = 3600;\n+const expiresIn = 7200;"
      },
      {
        "type": "code",
        "language": "typescript",
        "title": "src/auth.ts",
        "code": "const expiresIn = 7200;\n",
        "startLine": 1,
        "endLine": 1
      },
      {
        "type": "terminal",
        "title": "auth tests",
        "lines": ["$ npm test -- auth", "3 tests passed"]
      }
    ]
  }
}
```

A `file` entry can be used instead of `code` when the file is inside `SNAPMCP_ALLOWED_PATHS`.

## Agent tool discovery

Ask the MCP hint tool before choosing a composite workflow:

```json
{
  "name": "snapmcp-hint",
  "arguments": {
    "query": "ordered tutorial with a final PDF"
  }
}
```

A shell or code-mode agent can run:

```bash
snapmcp search "ordered tutorial with a final PDF" --json
```

## Related

- [Tool Reference](../tools.md)
- [Agent Guide](../agents.md)
- [GIF Animation Guide](gif-animation.md)
- [Security Policy](../../SECURITY.md)
