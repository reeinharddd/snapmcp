/**
 * Integration tests for the renderer module.
 *
 * These tests exercise the real Playwright browser to capture
 * actual screenshots. They verify that output files are created
 * on disk with correct format and reasonable size.
 *
 * When Chromium is not installed, all tests skip gracefully.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { loadConfig } from "../../src/config.js";
import { browserMissing } from "./runner.js";

const skipNoBrowser = browserMissing();

// ─── Shared state ────────────────────────────────────────────

let tmpDir: string;
let config: ReturnType<typeof loadConfig>;

// ─── Setup / Teardown ────────────────────────────────────────

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-integration-"));
  config = { ...loadConfig(), outputDir: tmpDir, format: "png", timeout: 15_000 };
});

after(async () => {
  // Close the browser singleton to release resources
  try {
    const { closeBrowser } = await import("../../src/renderer.js");
    await closeBrowser();
  } catch {
    // ignore
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Helpers ─────────────────────────────────────────────────

async function capture(mod: typeof import("../../src/renderer.js"), ...args: unknown[]) {
  // Type-safe dispatch by function name
  const name = new Error().stack?.split("\n")[2]?.trim();
  return undefined;
}

function outputPath(name: string): string {
  return path.join(tmpDir, name);
}

function fileExists(p: string): boolean {
  return fs.existsSync(p) && fs.statSync(p).size > 0;
}

// ─── captureTerminal ─────────────────────────────────────────

describe("captureTerminal integration", { skip: skipNoBrowser }, () => {
  it("captures 3 lines and creates a PNG file", async () => {
    const { captureTerminal } = await import("../../src/renderer.js");
    const out = outputPath("terminal-test.png");
    const result = await captureTerminal(
      "test-terminal",
      ["$ echo hello", "hello world", ""],
      out,
      config,
    );
    assert.equal(result, out);
    assert.ok(fileExists(out), "PNG file should exist");
  });

  it("captures with custom output filename", async () => {
    const { captureTerminal } = await import("../../src/renderer.js");
    const out = outputPath("my-custom-terminal.png");
    const result = await captureTerminal(
      "custom",
      ["$ ls", "file1  file2"],
      out,
      config,
    );
    assert.equal(result, out);
    assert.ok(fileExists(out));
  });

  it("handles empty lines array (just prompts)", async () => {
    const { captureTerminal } = await import("../../src/renderer.js");
    const out = outputPath("terminal-empty.png");
    const result = await captureTerminal("empty", ["$ echo hi", ""], out, config);
    assert.equal(result, out);
    assert.ok(fileExists(out));
  });
});

// ─── captureCode ─────────────────────────────────────────────

describe("captureCode integration", { skip: skipNoBrowser }, () => {
  it("captures TypeScript code", async () => {
    const { captureCode } = await import("../../src/renderer.js");
    const out = outputPath("code-ts.png");
    const result = await captureCode(
      "const x: number = 1;\nconsole.log(x);",
      "typescript",
      "demo.ts",
      out,
      config,
    );
    assert.equal(result, out);
    assert.ok(fileExists(out));
  });

  it("captures Python code", async () => {
    const { captureCode } = await import("../../src/renderer.js");
    const out = outputPath("code-py.png");
    const result = await captureCode(
      "def hello(name: str) -> str:\n    return f'Hello, {name}'",
      "python",
      "hello.py",
      out,
      config,
    );
    assert.equal(result, out);
    assert.ok(fileExists(out));
  });

  it("captures Go code", async () => {
    const { captureCode } = await import("../../src/renderer.js");
    const out = outputPath("code-go.png");
    const result = await captureCode(
      'package main\n\nfunc main() {\n\tprintln("hello")\n}',
      "go",
      "main.go",
      out,
      config,
    );
    assert.equal(result, out);
    assert.ok(fileExists(out));
  });

  it("captures with JPEG format", async () => {
    const jpegConfig = { ...config, format: "jpeg" as const, quality: 80 };
    const { captureCode } = await import("../../src/renderer.js");
    const out = outputPath("code-jpeg.jpg");
    const result = await captureCode(
      'console.log("jpeg test");',
      "javascript",
      "jpeg-test.js",
      out,
      jpegConfig,
    );
    assert.equal(result, out);
    assert.ok(fileExists(out));
    // Verify it's actually a JPEG (starts with FF D8)
    const header = fs.readFileSync(out).subarray(0, 2);
    assert.equal(header[0], 0xff);
    assert.equal(header[1], 0xd8);
  });

  it("handles very long code near the limit", { timeout: 30_000 }, async () => {
    const { captureCode } = await import("../../src/renderer.js");
    const longCode = "// " + "x".repeat(5_000) + "\n" + "y".repeat(5_000);
    const out = outputPath("code-long.png");
    const result = await captureCode(longCode, "text", "long.txt", out, config);
    assert.equal(result, out);
    assert.ok(fileExists(out));
  });
});

// ─── captureBrowser ──────────────────────────────────────────

describe("captureBrowser integration", { skip: skipNoBrowser }, () => {
  it("captures about:blank", async () => {
    const { captureBrowser } = await import("../../src/renderer.js");
    const out = outputPath("browser-blank.png");
    const result = await captureBrowser("about:blank", out, false, 800, 600, config);
    assert.equal(result, out);
    assert.ok(fileExists(out));
  });

  it("captures with custom viewport", async () => {
    const { captureBrowser } = await import("../../src/renderer.js");
    const out = outputPath("browser-viewport.png");
    const result = await captureBrowser("about:blank", out, false, 1024, 768, config);
    assert.equal(result, out);
    assert.ok(fileExists(out));
  });

  it("rejects invalid URL", async () => {
    const { captureBrowser } = await import("../../src/renderer.js");
    const out = outputPath("browser-invalid.png");
    await assert.rejects(
      () => captureBrowser("not-a-valid-url", out, false, 800, 600, config),
    );
    assert.ok(!fs.existsSync(out), "No file should be created for invalid URL");
  });
});

// ─── captureFile ─────────────────────────────────────────────

describe("captureFile integration", { skip: skipNoBrowser }, () => {
  let tempFile: string;

  before(() => {
    tempFile = path.join(tmpDir, "__test_source.ts");
    fs.writeFileSync(tempFile, "const greeting: string = 'Hello';\nconsole.log(greeting);\n");
  });

  it("captures an existing file", async () => {
    const { captureFile } = await import("../../src/renderer.js");
    const out = outputPath("file-capture.png");
    const result = await captureFile(tempFile, out, config);
    assert.equal(result, out);
    assert.ok(fileExists(out));
  });

  it("rejects non-existent file", async () => {
    const { captureFile } = await import("../../src/renderer.js");
    const out = outputPath("file-nonexistent.png");
    await assert.rejects(
      () => captureFile("/tmp/snapmcp-nonexistent-test-file-12345.ts", out, config),
    );
  });
});

// ─── captureMarkdown ─────────────────────────────────────────

describe("captureMarkdown integration", { skip: skipNoBrowser }, () => {
  it("renders simple markdown", async () => {
    const { captureMarkdown } = await import("../../src/renderer.js");
    const out = outputPath("md-simple.png");
    const result = await captureMarkdown(
      "# Hello\n\nThis is a **markdown** document.\n\n- Item 1\n- Item 2",
      "test-doc",
      out,
      config,
    );
    assert.equal(result, out);
    assert.ok(fileExists(out));
  });

  it("renders markdown with code block", async () => {
    const { captureMarkdown } = await import("../../src/renderer.js");
    const out = outputPath("md-code.png");
    const result = await captureMarkdown(
      "# Code Example\n\n```ts\nconst x = 1;\n```\n",
      "code-doc",
      out,
      config,
    );
    assert.equal(result, out);
    assert.ok(fileExists(out));
  });
});

// ─── captureHtml ─────────────────────────────────────────────

describe("captureHtml integration", { skip: skipNoBrowser }, () => {
  it("renders HTML snippet", async () => {
    const { captureHtml } = await import("../../src/renderer.js");
    const out = outputPath("html-snippet.png");
    const result = await captureHtml(
      "<h1>Test</h1><p>Hello world</p>",
      "html-test",
      out,
      config,
    );
    assert.equal(result, out);
    assert.ok(fileExists(out));
  });

  it("renders HTML with DOCTYPE without adding wrapper", async () => {
    const { captureHtml } = await import("../../src/renderer.js");
    const out = outputPath("html-doctype.png");
    const html = '<!DOCTYPE html><html><body><h1>Has DOCTYPE</h1></body></html>';
    const result = await captureHtml(html, "doctype-test", out, config);
    assert.equal(result, out);
    assert.ok(fileExists(out));
  });
});

// ─── captureDiff ─────────────────────────────────────────────

describe("captureDiff integration", { skip: skipNoBrowser }, () => {
  it("renders a simple diff", async () => {
    const { captureDiff } = await import("../../src/renderer.js");
    const out = outputPath("diff-simple.png");
    const diffText = `--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-old content
+new content`;
    const result = await captureDiff(diffText, out, config);
    assert.equal(result, out);
    assert.ok(fileExists(out));
  });

  it("renders multi-hunk diff", async () => {
    const { captureDiff } = await import("../../src/renderer.js");
    const out = outputPath("diff-multi.png");
    const diffText = `diff --git a/src/main.ts b/src/main.ts
index abc123..def456 100644
--- a/src/main.ts
+++ b/src/main.ts
@@ -10,6 +10,7 @@
 const x = 1;
+const y = 2;
 console.log(x);
@@ -20,6 +21,8 @@
 function hello() {
   return 'world';
+const z = 3;
+const w = 4;
 }`;
    const result = await captureDiff(diffText, out, config);
    assert.equal(result, out);
    assert.ok(fileExists(out));
  });
});

// ─── capturePdf ──────────────────────────────────────────────

describe("capturePdf integration", { skip: skipNoBrowser }, () => {
  it("converts about:blank to PDF", async () => {
    const { capturePdf } = await import("../../src/renderer.js");
    const out = outputPath("pdf-blank.pdf");
    const result = await capturePdf("about:blank", out, true, 1280, 800, config);
    assert.equal(result, out);
    assert.ok(fileExists(out));
    // PDF magic bytes: %PDF
    const header = fs.readFileSync(out).subarray(0, 4).toString();
    assert.equal(header, "%PDF");
  });

  it("creates non-empty PDF", async () => {
    const { capturePdf } = await import("../../src/renderer.js");
    const out = outputPath("pdf-nonempty.pdf");
    await capturePdf("about:blank", out, true, 800, 600, config);
    const stat = fs.statSync(out);
    assert.ok(stat.size > 100, "PDF should be larger than 100 bytes");
  });
});
