# Workflow Examples

Real-world recipes combining multiple snapmcp tools for common documentation
and automation tasks.

## 1. Automated PR Documentation

Generate a complete PR description with terminal output, code changes, and
visual diffs.

```json
{
  "name": "capture_document",
  "arguments": {
    "title": "PR #142: Add dark mode toggle",
    "format": "markdown",
    "captures": [
      {
        "type": "terminal",
        "params": {
          "title": "branch status",
          "lines": ["$ git checkout -b feat/dark-mode", "Switched to branch 'feat/dark-mode'"]
        },
        "caption": "Created feature branch"
      },
      {
        "type": "terminal",
        "params": {
          "title": "run tests",
          "lines": ["$ npm test", "", " PASS  tests/ui.test.ts (12 tests)", " PASS  tests/theme.test.ts (8 tests)", "", "Tests: 20 passed, 20 total"]
        },
        "caption": "All tests pass before changes"
      },
      {
        "type": "code",
        "params": {
          "code": "export function useTheme() {\n  const [theme, setTheme] = useState<'light' | 'dark'>('light');\n  return { theme, toggle: () => setTheme(t => t === 'light' ? 'dark' : 'light') };\n}",
          "language": "typescript",
          "title": "hooks/useTheme.ts"
        },
        "caption": "New theme hook implementation"
      },
      {
        "type": "diff",
        "params": {
          "diff": "--- a/src/App.tsx\n+++ b/src/App.tsx\n@@ -10,6 +10,7 @@\n import { Header } from './components/Header';\n import { Main } from './components/Main';\n+import { ThemeToggle } from './components/ThemeToggle';\n import { useTheme } from './hooks/useTheme';\n \n export function App() {\n@@ -18,6 +19,7 @@\n   return (\n     <div className={theme}>\n+      <ThemeToggle />\n       <Header />\n       <Main />\n     </div>\n"
        },
        "caption": "App.tsx changes adding ThemeToggle"
      },
      {
        "type": "browser",
        "params": {
          "url": "http://localhost:3000",
          "fullPage": true
        },
        "caption": "Dark mode preview in browser"
      },
      {
        "type": "terminal",
        "params": {
          "title": "push changes",
          "lines": ["$ git add -A", "$ git commit -m 'feat: add dark mode toggle'", "[feat/dark-mode a1b2c3d] feat: add dark mode toggle", "$ git push origin feat/dark-mode", "Enumerating objects: 12, done.", "To github.com:org/repo.git", " * [new branch] feat/dark-mode -> feat/dark-mode"]
        },
        "caption": "Changes pushed to remote"
      }
    ],
    "output": "pr-142-docs.md"
  }
}
```

**Output**: `pr-142-docs.md` with embedded images and captions — ready to copy into
GitHub PR description.

---

## 2. Before/After Visual Comparison

Create an animated GIF showing the before/after state of a UI change.

```json
{
  "name": "create_gif",
  "arguments": {
    "title": "login-page-redesign",
    "captures": [
      {
        "type": "browser",
        "params": {
          "url": "https://staging.example.com/login",
          "fullPage": true
        },
        "label": "Before: Old login page"
      },
      {
        "type": "browser",
        "params": {
          "url": "https://staging.example.com/login?new=1",
          "fullPage": true
        },
        "label": "After: New login page"
      }
    ],
    "frameDelay": 2000,
    "loop": true,
    "output": "login-redesign.gif"
  }
}
```

**Output**: `login-redesign.gif` — animated comparison perfect for design
reviews and stakeholder updates.

---

## 3. CI/CD Pipeline Visualization

Document your deployment pipeline as a step-by-step sequence.

```json
{
  "name": "create_sequence",
  "arguments": {
    "steps": [
      {
        "type": "terminal",
        "stepNumber": 1,
        "label": "checkout",
        "params": { "title": "checkout", "lines": ["$ git fetch origin", "$ git checkout main", "Already on 'main'"] }
      },
      {
        "type": "terminal",
        "stepNumber": 2,
        "label": "install",
        "params": { "title": "install deps", "lines": ["$ npm ci", "✓ installed in 3.2s"] }
      },
      {
        "type": "terminal",
        "stepNumber": 3,
        "label": "lint",
        "params": { "title": "lint", "lines": ["$ npm run lint", "✓ no issues found"] }
      },
      {
        "type": "terminal",
        "stepNumber": 4,
        "label": "test",
        "params": { "title": "test", "lines": ["$ npm test", "✓ 42 tests passed in 4.1s"] }
      },
      {
        "type": "terminal",
        "stepNumber": 5,
        "label": "build",
        "params": { "title": "build", "lines": ["$ npm run build", "✓ built in 5.8s", "  dist/ (2.1 MB)"] }
      },
      {
        "type": "terminal",
        "stepNumber": 6,
        "label": "docker",
        "params": { "title": "docker build", "lines": ["$ docker build -t app:v1.2.3 .", "✓ image built: sha256:abc123..."] }
      },
      {
        "type": "terminal",
        "stepNumber": 7,
        "label": "deploy",
        "params": { "title": "deploy", "lines": ["$ kubectl set image deployment/app app=app:v1.2.3", "deployment.apps/app image updated"] }
      }
    ],
    "compileGif": true,
    "frameDelay": 1200,
    "loop": false,
    "output": "ci-pipeline"
  }
}
```

**Output**: Individual step images + `ci-pipeline.gif` animation — perfect for
runbooks, onboarding docs, and incident response guides.

---

## 4. Interactive Tutorial Generation

Create a step-by-step tutorial with terminal commands, code snippets, and
explanations.

```json
{
  "name": "capture_document",
  "arguments": {
    "title": "Getting Started with React + TypeScript",
    "format": "html",
    "captures": [
      {
        "type": "markdown",
        "params": {
          "markdown": "# Getting Started with React + TypeScript\n\nThis tutorial walks through creating a new React project with TypeScript using Vite."
        },
        "caption": "Introduction"
      },
      {
        "type": "terminal",
        "params": {
          "title": "create project",
          "lines": ["$ npm create vite@latest my-app -- --template react-ts", "✔ Select a framework: › React", "✔ Select a variant: › TypeScript", "", "Scaffolding project in ./my-app...", "Done. Now run:", "  cd my-app", "  npm install", "  npm run dev"]
        },
        "caption": "Create the project with Vite"
      },
      {
        "type": "code",
        "params": {
          "code": "import { useState } from 'react';\nimport './App.css';\n\nfunction App() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <div className='app'>\n      <header>\n        <h1>Vite + React + TS</h1>\n      </header>\n      <main>\n        <p>Count: {count}</p>\n        <button onClick={() => setCount(count + 1)}>Increment</button>\n      </main>\n    </div>\n  );\n}\n\nexport default App;",
          "language": "typescript",
          "title": "src/App.tsx"
        },
        "caption": "Default App.tsx created by Vite"
      },
      {
        "type": "terminal",
        "params": {
          "title": "dev server",
          "lines": ["$ cd my-app", "$ npm run dev", "", "  VITE v5.0.0  ready in 200 ms", "", "  ➜  Local:   http://localhost:5173/", "  ➜  Network: http://192.168.1.5:5173/"]
        },
        "caption": "Start the dev server"
      },
      {
        "type": "browser",
        "params": {
          "url": "http://localhost:5173",
          "fullPage": true
        },
        "caption": "Running app in browser"
      }
    ],
    "format": "html",
    "output": "react-ts-tutorial.html"
  }
}
```

**Output**: `react-ts-tutorial.html` — self-contained HTML with embedded images,
ready to share or publish.

---

## 5. Code Review Package

Bundle a diff with context (terminal commands, related files) for async code
review.

```json
{
  "name": "capture_batch",
  "arguments": {
    "captures": [
      { "type": "diff", "params": { "diff": "---\n+++ b/src/auth.ts\n@@ -45,7 +45,7 @@\n   const token = await generateToken(user);\n-  return { token, expiresIn: 3600 };\n+  return { token, expiresIn: 7200 };\n }" } },
      { "type": "code", "params": { "code": "export async function generateToken(user: User): Promise<string> {\n  const payload = { sub: user.id, roles: user.roles };\n  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '1h' });\n}", "language": "typescript", "title": "src/auth.ts" } },
      { "type": "terminal", "params": { "title": "test auth", "lines": ["$ npm test -- auth.test.ts", "✓ should generate valid token", "✓ should include roles in payload", "✓ should reject expired tokens"] } },
      { "type": "file", "params": { "filePath": "/path/to/project/CHANGELOG.md" } }
    ],
    "output": "code-review-42"
  }
}
```

**Output**: Individual files in `code-review-42/` directory:
- `diff-<timestamp>.png`
- `code-<timestamp>.png`
- `terminal-<timestamp>.png`
- `file-<timestamp>.png`

Perfect for attaching to PRs or sharing in team chat.

---

## 6. Security Audit Report

Document security findings with terminal evidence, code, and browser captures.

```json
{
  "name": "capture_document",
  "arguments": {
    "title": "Security Audit Report - Q3 2024",
    "format": "pdf",
    "captures": [
      {
        "type": "markdown",
        "params": {
          "markdown": "# Security Audit Report\n\n**Scope**: Authentication & Authorization\n**Date**: 2024-09-15\n**Auditor**: Security Team\n\n## Findings Summary\n\n| Severity | Count |\n|----------|-------|\n| Critical | 0 |\n| High | 1 |\n| Medium | 3 |\n| Low | 2 |"
        },
        "caption": "Executive Summary"
      },
      {
        "type": "terminal",
        "params": {
          "title": "dependency audit",
          "lines": ["$ npm audit --audit-level=high", "", "found 1 high severity vulnerability", "  fast-uri@3.1.2 - SSRF via IPv6 normalization", "  fix available via `npm audit fix`"]
        },
        "caption": "Dependency vulnerability scan"
      },
      {
        "type": "code",
        "params": {
          "code": "export async function validateRedirect(url: string): Promise<void> {\n  const parsed = new URL(url);\n  // BLOCKED: private IP ranges\n  if (isPrivateIP(parsed.hostname)) {\n    throw new Error('Redirect to private IP blocked');\n  }\n  return parsed.href;\n}",
          "language": "typescript",
          "title": "src/security/redirect.ts"
        },
        "caption": "SSRF protection implementation"
      },
      {
        "type": "browser",
        "params": {
          "url": "https://example.com/admin",
          "fullPage": true
        },
        "caption": "Admin panel accessible without auth (HIGH)"
      }
    ],
    "output": "security-audit-q3-2024.pdf"
  }
}
```

**Output**: `security-audit-q3-2024.pdf` — professional PDF report with embedded
evidence.

---

## 7. API Documentation with Live Examples

Capture API endpoint behavior with real requests and responses.

```json
{
  "name": "capture_sequence",
  "arguments": {
    "steps": [
      {
        "type": "terminal",
        "stepNumber": 1,
        "label": "health check",
        "params": { "title": "health", "lines": ["$ curl -s https://api.example.com/health | jq .", "{", "  \"status\": \"healthy\",", "  \"version\": \"2.1.0\"", "}"] }
      },
      {
        "type": "terminal",
        "stepNumber": 2,
        "label": "auth",
        "params": { "title": "auth", "lines": ["$ curl -s -X POST https://api.example.com/auth \\", "  -H 'Content-Type: application/json' \\", "  -d '{\"email\":\"user@example.com\"}' | jq .", "{", "  \"token\": \"eyJhbGciOiJIUzI1NiIs...\",", "  \"expiresIn\": 3600", "}"] }
      },
      {
        "type": "terminal",
        "stepNumber": 3,
        "label": "list users",
        "params": { "title": "users", "lines": ["$ curl -s https://api.example.com/users \\", "  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...' | jq .", "[", "  {\"id\": 1, \"name\": \"Alice\"},", "  {\"id\": 2, \"name\": \"Bob\"}", "]",] }
      },
      {
        "type": "terminal",
        "stepNumber": 4,
        "label": "create user",
        "params": { "title": "create", "lines": ["$ curl -s -X POST https://api.example.com/users \\", "  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...' \\", "  -H 'Content-Type: application/json' \\", "  -d '{\"name\":\"Charlie\"}' | jq .", "{", "  \"id\": 3,", "  \"name\": \"Charlie\"", "}"] }
      }
    ],
    "compileGif": false,
    "output": "api-docs"
  }
}
```

**Output**: Individual step images in `api-docs/` — use in OpenAPI specs,
Postman collections, or developer portal.

---

## Common Patterns

| Use Case | Tool(s) | Output Format |
|----------|---------|---------------|
| PR description | `capture_document` | Markdown (`.md`) |
| Design review | `create_gif` | GIF (`.gif`) |
| Pipeline docs | `create_sequence` | Images + GIF |
| Tutorials | `capture_document` | HTML/Markdown/PDF |
| Code review | `capture_batch` | Individual images |
| Security audit | `capture_document` | PDF |
| API docs | `create_sequence` | Images |

---

## Tips for Best Results

1. **Consistent sizing**: Use `SNAPMCP_WIDTH`/`SNAPMCP_HEIGHT` env vars for
   uniform browser captures across frames.

2. **Padding consistency**: Set `SNAPMCP_PADDING=32` globally so all captures
   have the same internal spacing.

3. **Theme consistency**: Set `SNAPMCP_THEME=nord` (or your team theme) in
   CI/CD so all captures match.

4. **Cleanup**: Set `SNAPMCP_CLEANUP_MAX=100` to auto-remove old captures.

5. **Naming**: Use descriptive `output` names with timestamps:
   `output: "pr-142-{{timestamp}}"` (interpolation varies by client).

---

## Related

- [Terminal Capture Guide](terminal-capture.md) — terminal-specific tips
- [Browser Capture Guide](browser-capture.md) — browser/PDF tips
- [GIF Animation Guide](gif-animation.md) — animation parameters
- [Configuration Reference](../configuration.md) — all `SNAPMCP_*` vars
- [CLI Reference](../cli.md) — `snapmcp init`, `doctor`, `test`
