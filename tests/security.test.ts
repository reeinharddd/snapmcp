import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  resolveSafePath,
  validateTerminalLines,
  validateCodeInput,
  validateMarkdownInput,
  validateDiffInput,
  validateHtmlInput,
  validateFileRead,
  checkChromiumSandbox,
  SecurityError,
  LimitError,
  LIMITS,
} from "../src/security.js";

// ─── resolveSafePath ─────────────────────────────────────────

describe("resolveSafePath", () => {
  const baseDir = "/tmp/out";

  it("resolves normal path", () => {
    const result = resolveSafePath(baseDir, "file.png");
    assert.equal(result, "/tmp/out/file.png");
  });

  it("resolves path in subdirectory", () => {
    const result = resolveSafePath(baseDir, "sub/file.png");
    assert.equal(result, "/tmp/out/sub/file.png");
  });

  it("blocks simple path traversal (../etc/passwd)", () => {
    assert.throws(
      () => resolveSafePath(baseDir, "../etc/passwd"),
      SecurityError,
    );
  });

  it("blocks multiple path traversal (foo/../../etc/passwd)", () => {
    assert.throws(
      () => resolveSafePath(baseDir, "foo/../../etc/passwd"),
      SecurityError,
    );
  });

  it("allows absolute path inside base dir", () => {
    const result = resolveSafePath(baseDir, "/tmp/out/file.png");
    assert.equal(result, "/tmp/out/file.png");
  });

  it("blocks absolute path outside base dir", () => {
    assert.throws(
      () => resolveSafePath(baseDir, "/etc/passwd"),
      SecurityError,
    );
  });

  it("blocks deeply nested traversal", () => {
    assert.throws(
      () => resolveSafePath("/tmp/out/a/b/c", "../../../file.png"),
      SecurityError,
    );
  });

  it("resolves '.' as base dir", () => {
    const result = resolveSafePath(baseDir, ".");
    assert.ok(result.endsWith("/out"));
  });

  it("does not prevent encoded path that doesn't contain ../", () => {
    // URL-encoded paths are NOT decoded by resolveSafePath
    // so this resolves inside the base dir without throwing
    const result = resolveSafePath(baseDir, "..%2Fetc%2Fpasswd");
    assert.ok(result.endsWith("..%2Fetc%2Fpasswd"));
  });

  it("resolves nested paths within bounds", () => {
    const result = resolveSafePath("/tmp/out/sub", "file.png");
    assert.equal(result, "/tmp/out/sub/file.png");
  });
});

// ─── Input validation limits ─────────────────────────────────

describe("validateTerminalLines", () => {
  it("accepts 1000 lines", () => {
    const lines = new Array(1000).fill("test");
    validateTerminalLines(lines); // should not throw
  });

  it("rejects 1001 lines", () => {
    const lines = new Array(1001).fill("test");
    assert.throws(() => validateTerminalLines(lines), LimitError);
  });

  it("rejects invalid line type (number in array)", () => {
    const lines = ["valid", 123 as unknown as string, "valid"];
    assert.throws(() => validateTerminalLines(lines), SecurityError);
  });

  it("accepts empty array", () => {
    validateTerminalLines([]); // should not throw
  });

  it("exactly at limit is OK", () => {
    const lines = new Array(LIMITS.TERMINAL_LINES).fill("test");
    validateTerminalLines(lines); // should not throw
  });

  it("one past limit throws", () => {
    const lines = new Array(LIMITS.TERMINAL_LINES + 1).fill("test");
    assert.throws(() => validateTerminalLines(lines), LimitError);
  });
});

describe("validateCodeInput", () => {
  it("accepts 200KB string", () => {
    const code = "x".repeat(200_000);
    validateCodeInput(code); // should not throw
  });

  it("rejects 200001 char string", () => {
    const code = "x".repeat(200_001);
    assert.throws(() => validateCodeInput(code), LimitError);
  });

  it("accepts empty string", () => {
    validateCodeInput("");
  });

  it("exactly at limit is OK", () => {
    const code = "x".repeat(LIMITS.CODE_LENGTH);
    validateCodeInput(code);
  });

  it("one past limit throws", () => {
    const code = "x".repeat(LIMITS.CODE_LENGTH + 1);
    assert.throws(() => validateCodeInput(code), LimitError);
  });
});

describe("validateMarkdownInput", () => {
  it("accepts 200KB string", () => {
    const md = "x".repeat(200_000);
    validateMarkdownInput(md);
  });

  it("rejects 200001 char string", () => {
    const md = "x".repeat(200_001);
    assert.throws(() => validateMarkdownInput(md), LimitError);
  });

  it("accepts empty string", () => {
    validateMarkdownInput("");
  });

  it("exactly at limit is OK", () => {
    const md = "x".repeat(LIMITS.MARKDOWN_LENGTH);
    validateMarkdownInput(md);
  });

  it("one past limit throws", () => {
    const md = "x".repeat(LIMITS.MARKDOWN_LENGTH + 1);
    assert.throws(() => validateMarkdownInput(md), LimitError);
  });
});

describe("validateDiffInput", () => {
  it("accepts 500KB string", () => {
    const diff = "x".repeat(500_000);
    validateDiffInput(diff);
  });

  it("rejects 500001 char string", () => {
    const diff = "x".repeat(500_001);
    assert.throws(() => validateDiffInput(diff), LimitError);
  });

  it("accepts empty string", () => {
    validateDiffInput("");
  });

  it("exactly at limit is OK", () => {
    const diff = "x".repeat(LIMITS.DIFF_LENGTH);
    validateDiffInput(diff);
  });

  it("one past limit throws", () => {
    const diff = "x".repeat(LIMITS.DIFF_LENGTH + 1);
    assert.throws(() => validateDiffInput(diff), LimitError);
  });
});

describe("validateHtmlInput", () => {
  it("accepts 200KB string", () => {
    const html = "x".repeat(200_000);
    validateHtmlInput(html);
  });

  it("rejects 200001 char string", () => {
    const html = "x".repeat(200_001);
    assert.throws(() => validateHtmlInput(html), LimitError);
  });

  it("accepts empty string", () => {
    validateHtmlInput("");
  });

  it("exactly at limit is OK", () => {
    const html = "x".repeat(LIMITS.HTML_LENGTH);
    validateHtmlInput(html);
  });

  it("one past limit throws", () => {
    const html = "x".repeat(LIMITS.HTML_LENGTH + 1);
    assert.throws(() => validateHtmlInput(html), LimitError);
  });
});

// ─── validateFileRead ────────────────────────────────────────

describe("validateFileRead", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-sec-test-"));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("allows reading existing file with allowed path", () => {
    const fp = path.join(tmpDir, "test.txt");
    fs.writeFileSync(fp, "hello");
    validateFileRead(fp, { maxSize: 1_000_000, allowedPaths: [tmpDir] });
  });

  it("rejects file exceeding maxSize", () => {
    const fp = path.join(tmpDir, "large.txt");
    fs.writeFileSync(fp, "x".repeat(100));
    assert.throws(
      () => validateFileRead(fp, { maxSize: 10, allowedPaths: [tmpDir] }),
      LimitError,
    );
  });

  it("rejects non-existent file", () => {
    assert.throws(
      () => validateFileRead(path.join(tmpDir, "nope.txt"), { maxSize: 1_000_000, allowedPaths: [tmpDir] }),
      SecurityError,
    );
  });

  it("rejects a directory (not regular file)", () => {
    const subDir = path.join(tmpDir, "subdir");
    fs.mkdirSync(subDir);
    assert.throws(
      () => validateFileRead(subDir, { maxSize: 1_000_000, allowedPaths: [tmpDir] }),
      SecurityError,
    );
  });

  it("allows file within allowed path", () => {
    const fp = path.join(tmpDir, "within.txt");
    fs.writeFileSync(fp, "allowed");
    validateFileRead(fp, { maxSize: 1_000_000, allowedPaths: [tmpDir] });
  });

  it("rejects file outside allowed path", () => {
    const fp = path.join(tmpDir, "outside.txt");
    fs.writeFileSync(fp, "outside");
    // Use a path that won't be a prefix of tmpDir
    const otherDir = "/nonexistent-snapmcp-test-dir";
    assert.throws(
      () => validateFileRead(fp, { maxSize: 1_000_000, allowedPaths: [otherDir] }),
      SecurityError,
    );
  });

  it("rejects file when allowedPaths is empty (security default)", () => {
    const fp = path.join(tmpDir, "any.txt");
    fs.writeFileSync(fp, "any");
    assert.throws(
      () => validateFileRead(fp, { maxSize: 1_000_000, allowedPaths: [] }),
      SecurityError,
    );
  });

  it("allows file with exact size at max", () => {
    const fp = path.join(tmpDir, "exact.txt");
    fs.writeFileSync(fp, "x".repeat(100));
    validateFileRead(fp, { maxSize: 100, allowedPaths: [tmpDir] });
  });
});

// ─── checkChromiumSandbox ────────────────────────────────────

describe("checkChromiumSandbox", () => {
  const SAVED_CHROMIUM = process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"];

  after(() => {
    if (SAVED_CHROMIUM === undefined) {
      delete process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"];
    } else {
      process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"] = SAVED_CHROMIUM;
    }
  });

  it("returns enabled when no env var set", () => {
    delete process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"];
    const result = checkChromiumSandbox();
    assert.ok(result.sandboxEnabled);
    assert.equal(result.message, "✓ Chromium sandbox enabled");
  });

  it("returns custom message when executable has 'chromium' in path", () => {
    process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"] = "/usr/bin/chromium-browser";
    const result = checkChromiumSandbox();
    assert.equal(result.sandboxEnabled, false);
    assert.ok(result.message.includes("without sandbox"));
  });

  it("returns unknown message for custom executable", () => {
    process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"] = "/usr/bin/firefox";
    const result = checkChromiumSandbox();
    assert.equal(result.sandboxEnabled, false);
    assert.ok(result.message.includes("Custom Chromium executable"));
  });

  it("reports sandbox enabled for empty executable path", () => {
    process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"] = "";
    const result = checkChromiumSandbox();
    // Empty string is falsy, so both condition branches are skipped
    // and sandbox is reported as enabled
    assert.equal(result.sandboxEnabled, true);
    assert.equal(result.message, "✓ Chromium sandbox enabled");
  });
});

// ─── Error types ─────────────────────────────────────────────

describe("SecurityError", () => {
  it("includes [SECURITY] prefix", () => {
    const err = new SecurityError("test");
    assert.ok(err.message.startsWith("[SECURITY]"));
    assert.equal(err.name, "SecurityError");
  });
});

describe("LimitError", () => {
  it("includes [LIMIT] prefix and details", () => {
    const err = new LimitError("code length", 200000, 300000);
    assert.ok(err.message.startsWith("[LIMIT]"));
    assert.ok(err.message.includes("code length"));
    assert.ok(err.message.includes("200000"));
    assert.ok(err.message.includes("300000"));
    assert.equal(err.name, "LimitError");
  });
});
