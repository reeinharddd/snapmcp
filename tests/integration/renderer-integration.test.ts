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
import { createServer, type Server } from "node:http";
import { loadConfig } from "../../src/config.js";
import { browserMissing } from "./runner.js";

const skipNoBrowser = browserMissing();

// ─── Shared state ────────────────────────────────────────────

let tmpDir: string;
let config: ReturnType<typeof loadConfig>;
let localServer: Server;
let localOrigin: string;
let localRequestCount = 0;

// ─── Setup / Teardown ────────────────────────────────────────

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-integration-"));
  config = {
    ...loadConfig(),
    outputDir: tmpDir,
    format: "png",
    timeout: 15_000,
    allowedPaths: [tmpDir],
    // The deterministic test server is intentionally bound to loopback.
    ssrfProtection: false,
  };

  localServer = createServer((request, response) => {
    localRequestCount += 1;
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><html><body><h1>${request.url ?? "/"}</h1></body></html>`);
  });
  await new Promise<void>((resolve, reject) => {
    localServer.once("error", reject);
    localServer.listen(0, "127.0.0.1", resolve);
  });
  const address = localServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Local integration server did not expose a TCP port");
  }
  localOrigin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (localServer) {
    await new Promise<void>((resolve) => localServer.close(() => resolve()));
  }
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

/** Return the largest quantization value used by a JPEG's DQT tables. */
function maxJpegQuantization(filePath: string): number {
  const data = fs.readFileSync(filePath);
  let offset = 2;
  let maximum = 0;
  while (offset < data.length - 1) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = data[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0xdb) {
      const segmentLength = data.readUInt16BE(offset + 2);
      const segmentEnd = offset + 2 + segmentLength;
      let tableOffset = offset + 4;
      while (tableOffset < segmentEnd) {
        const precision = data[tableOffset]! >> 4;
        const valueCount = precision ? 128 : 64;
        const valueBytes = precision ? 2 : 1;
        for (let index = 0; index < valueCount; index++) {
          const valueOffset = tableOffset + 1 + index * valueBytes;
          const value = precision
            ? data.readUInt16BE(valueOffset)
            : data[valueOffset]!;
          maximum = Math.max(maximum, value);
        }
        tableOffset += 1 + valueCount * valueBytes;
      }
      return maximum;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const segmentLength = data.readUInt16BE(offset + 2);
    offset += 2 + segmentLength;
  }
  return maximum;
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

  it("honors the configured JPEG quality", async () => {
    const { captureCode } = await import("../../src/renderer.js");
    const source = 'const value = "quality";\n'.repeat(20);
    const lowQuality = outputPath("code-quality-low.jpg");
    const highQuality = outputPath("code-quality-high.jpg");

    await captureCode(
      source,
      "typescript",
      "quality.ts",
      lowQuality,
      { ...config, format: "jpeg", quality: 20 },
    );
    await captureCode(
      source,
      "typescript",
      "quality.ts",
      highQuality,
      { ...config, format: "jpeg", quality: 90 },
    );

    assert.ok(fileExists(lowQuality));
    assert.ok(fileExists(highQuality));
    assert.ok(
      maxJpegQuantization(lowQuality) > maxJpegQuantization(highQuality),
      "Lower JPEG quality should use coarser quantization tables",
    );
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
  it("captures a deterministic local HTTP page", async () => {
    const { captureBrowser } = await import("../../src/renderer.js");
    const out = outputPath("browser-local.png");
    const result = await captureBrowser(`${localOrigin}/browser`, out, false, 800, 600, config);
    assert.equal(result, out);
    assert.ok(fileExists(out));
  });

  it("captures with custom viewport", async () => {
    const { captureBrowser } = await import("../../src/renderer.js");
    const out = outputPath("browser-viewport.png");
    const result = await captureBrowser(`${localOrigin}/viewport`, out, false, 1024, 768, config);
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

  it("rejects about:blank", async () => {
    const { captureBrowser } = await import("../../src/renderer.js");
    const out = outputPath("browser-about-blank.png");
    await assert.rejects(
      () => captureBrowser("about:blank", out, false, 800, 600, config),
    );
    assert.ok(!fs.existsSync(out), "No file should be created for about:blank");
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

  it("does not load external resources for synthetic HTML", async () => {
    const { captureHtml } = await import("../../src/renderer.js");
    const out = outputPath("html-isolated.png");
    const before = localRequestCount;
    const html = `<img src="${localOrigin}/blocked.png"><script src="${localOrigin}/blocked.js"></script><p>Safe text</p>`;

    const result = await captureHtml(html, "isolated-test", out, config);

    assert.equal(result, out);
    assert.ok(fileExists(out));
    assert.equal(localRequestCount, before, "Synthetic HTML must not make network requests");
  });
});

// ─── Synthetic isolation ─────────────────────────────────────

describe("synthetic content isolation integration", { skip: skipNoBrowser }, () => {
  it("removes active markup and installs a restrictive CSP", async () => {
    const { getBrowser } = await import("../../src/renderer.js");
    const { installSyntheticContent, SYNTHETIC_CSP } = await import("../../src/synthetic.js");
    const browser = await getBrowser(config);
    const context = await browser.newContext({
      javaScriptEnabled: false,
      serviceWorkers: "block",
    });
    const page = await context.newPage();

    try {
      await installSyntheticContent(
        page,
        `<script>window.bad = true</script>
         <iframe src="https://example.invalid"></iframe>
         <img id="external" src="https://example.invalid/image.png" onerror="window.bad = true">
         <img id="embedded" src="data:image/png;base64,AA==">
         <a id="unsafe-link" href="javascript:alert(1)">bad link</a>
         <div id="handler" onclick="window.bad = true">safe text</div>`,
      );

      const state = await page.evaluate(() => ({
        scriptCount: document.querySelectorAll("script").length,
        iframeCount: document.querySelectorAll("iframe").length,
        externalSrc: document.querySelector("#external")?.getAttribute("src") ?? null,
        externalOnError: document.querySelector("#external")?.getAttribute("onerror") ?? null,
        embeddedSrc: document.querySelector("#embedded")?.getAttribute("src") ?? null,
        unsafeHref: document.querySelector("#unsafe-link")?.getAttribute("href") ?? null,
        handler: document.querySelector("#handler")?.getAttribute("onclick") ?? null,
        csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content") ?? null,
      }));

      assert.equal(state.scriptCount, 0);
      assert.equal(state.iframeCount, 0);
      assert.equal(state.externalSrc, null);
      assert.equal(state.externalOnError, null);
      assert.equal(state.embeddedSrc, "data:image/png;base64,AA==");
      assert.equal(state.unsafeHref, null);
      assert.equal(state.handler, null);
      assert.equal(state.csp, SYNTHETIC_CSP);
    } finally {
      await page.close();
      await context.close();
    }
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
  it("converts a deterministic local HTTP page to PDF", async () => {
    const { capturePdf } = await import("../../src/renderer.js");
    const out = outputPath("pdf-local.pdf");
    const result = await capturePdf(`${localOrigin}/pdf`, out, 1280, 800, config);
    assert.equal(result, out);
    assert.ok(fileExists(out));
    // PDF magic bytes: %PDF
    const header = fs.readFileSync(out).subarray(0, 4).toString();
    assert.equal(header, "%PDF");
  });

  it("creates non-empty PDF", async () => {
    const { capturePdf } = await import("../../src/renderer.js");
    const out = outputPath("pdf-nonempty.pdf");
    await capturePdf(`${localOrigin}/pdf-nonempty`, out, 800, 600, config);
    const stat = fs.statSync(out);
    assert.ok(stat.size > 100, "PDF should be larger than 100 bytes");
  });

  it("rejects about:blank", async () => {
    const { capturePdf } = await import("../../src/renderer.js");
    const out = outputPath("pdf-about-blank.pdf");
    await assert.rejects(
      () => capturePdf("about:blank", out, 800, 600, config),
    );
    assert.ok(!fs.existsSync(out), "No file should be created for about:blank");
  });
});

describe("document PDF integration", { skip: skipNoBrowser }, () => {
  it("builds the PDF in memory without a sibling HTML file", async () => {
    const { createDocument } = await import("../../src/document.js");
    const out = outputPath("document.pdf");
    const result = await createDocument(
      {
        title: "In-memory document",
        sections: [{ description: "PDF body" }],
        format: "pdf",
        outputPath: out,
      },
      config,
    );

    assert.equal(result, out);
    assert.ok(fileExists(out));
    assert.equal(fs.readFileSync(out).subarray(0, 4).toString(), "%PDF");
    assert.ok(!fs.existsSync(outputPath("document.html")));
  });
});
