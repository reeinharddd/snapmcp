import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import dns from "node:dns";
import {
  resolveSafePath,
  validateUrl,
  validateUrlResolve,
  assertSafeRequestUrl,
  isPrivateIpAddress,
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
  // Use path.resolve for cross-platform compatibility
  const baseDir = path.resolve("/tmp/out");

  it("resolves normal path", () => {
    const result = resolveSafePath(baseDir, "file.png");
    assert.equal(result, path.join(baseDir, "file.png"));
  });

  it("resolves path in subdirectory", () => {
    const result = resolveSafePath(baseDir, "sub/file.png");
    assert.equal(result, path.join(baseDir, "sub", "file.png"));
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
    const result = resolveSafePath(baseDir, path.resolve("/tmp/out/file.png"));
    assert.equal(result, path.resolve("/tmp/out/file.png"));
  });

  it("blocks absolute path outside base dir", () => {
    assert.throws(
      () => resolveSafePath(baseDir, path.resolve("/etc/passwd")),
      SecurityError,
    );
  });

  it("blocks deeply nested traversal", () => {
    assert.throws(
      () => resolveSafePath(path.resolve("/tmp/out/a/b/c"), "../../../file.png"),
      SecurityError,
    );
  });

  it("resolves '.' as base dir", () => {
    const result = resolveSafePath(baseDir, ".");
    assert.ok(result.endsWith(path.sep + "out"));
  });

  it("blocks encoded path separators", () => {
    for (const encodedPath of [
      "..%2Fetc%2Fpasswd",
      "..%2fetc%2fpasswd",
      "..%5Cetc%5Cpasswd",
      "%2e%2e%2fescape.png",
    ]) {
      assert.throws(
        () => resolveSafePath(baseDir, encodedPath),
        SecurityError,
        `Expected encoded traversal to be blocked: ${encodedPath}`,
      );
    }
  });

  it("blocks a symlink that escapes the base directory", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-safe-path-"));
    const safeBase = path.join(root, "out");
    const outside = path.join(root, "outside");
    fs.mkdirSync(safeBase);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "secret.txt"), "secret");

    const link = path.join(safeBase, "escape");
    try {
      fs.symlinkSync(
        outside,
        link,
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES" || code === "ENOTSUP") {
        t.skip(`symlink creation is not permitted on this platform: ${code}`);
        fs.rmSync(root, { recursive: true, force: true });
        return;
      }
      throw error;
    }

    try {
      assert.throws(
        () => resolveSafePath(safeBase, "escape/secret.txt"),
        SecurityError,
      );
      assert.throws(
        () => resolveSafePath(safeBase, "escape"),
        SecurityError,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves nested paths within bounds", () => {
    const result = resolveSafePath(path.resolve("/tmp/out/sub"), "file.png");
    assert.equal(result, path.join(path.resolve("/tmp/out/sub"), "file.png"));
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

  it("enforces the terminal payload limit in UTF-8 bytes", () => {
    const exact = `${"a".repeat(LIMITS.TERMINAL_BYTES - 3)}€`;
    assert.equal(Buffer.byteLength(exact, "utf8"), LIMITS.TERMINAL_BYTES);
    validateTerminalLines([exact]);

    assert.throws(
      () => validateTerminalLines([exact, "a"]),
      LimitError,
    );
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

  it("measures UTF-8 bytes rather than JavaScript characters", () => {
    const exact = `${"a".repeat(LIMITS.CODE_LENGTH - 3)}€`;
    assert.equal(Buffer.byteLength(exact, "utf8"), LIMITS.CODE_LENGTH);
    validateCodeInput(exact);

    assert.throws(
      () => validateCodeInput(`${exact}a`),
      LimitError,
    );
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
  const SAVED_SANDBOX = process.env["PLAYWRIGHT_SANDBOX"];

  after(() => {
    if (SAVED_CHROMIUM === undefined) {
      delete process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"];
    } else {
      process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"] = SAVED_CHROMIUM;
    }
    if (SAVED_SANDBOX === undefined) {
      delete process.env["PLAYWRIGHT_SANDBOX"];
    } else {
      process.env["PLAYWRIGHT_SANDBOX"] = SAVED_SANDBOX;
    }
  });

  it("reports the sandbox as enabled when snapmcp has not disabled it", () => {
    delete process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"];
    delete process.env["PLAYWRIGHT_SANDBOX"];
    const result = checkChromiumSandbox();
    assert.equal(result.sandboxEnabled, true);
    assert.match(result.message, /sandbox/i);
    assert.match(result.message, /not disabled|enabled/i);
  });

  it("reports a custom executable as unverifiable", () => {
    process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"] = "/usr/bin/chromium-browser";
    delete process.env["PLAYWRIGHT_SANDBOX"];
    const result = checkChromiumSandbox();
    assert.equal(result.sandboxEnabled, false);
    assert.match(result.message, /custom chromium executable/i);
  });

  it("reports an explicitly disabled sandbox", () => {
    delete process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"];
    process.env["PLAYWRIGHT_SANDBOX"] = "false";
    const result = checkChromiumSandbox();
    assert.equal(result.sandboxEnabled, false);
    assert.match(result.message, /disabled/i);
  });

  it("treats an empty executable path as no custom executable", () => {
    delete process.env["PLAYWRIGHT_SANDBOX"];
    process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"] = "";
    const result = checkChromiumSandbox();
    assert.equal(result.sandboxEnabled, true);
    assert.match(result.message, /sandbox/i);
  });
});

// ─── validateUrl ──────────────────────────────────────────────

describe("validateUrl", () => {
  it("rejects an invalid URL regardless of SSRF protection", () => {
    assert.throws(() => validateUrl("not-a-url", false), SecurityError);
    assert.throws(() => validateUrl("not-a-url", true), SecurityError);
  });

  it("allows private IP literals only when SSRF protection is disabled", () => {
    validateUrl("http://127.0.0.1:8080/test", false);
    validateUrl("http://192.168.1.1/admin", false);
    validateUrl("http://10.0.0.1/internal", false);
    validateUrl("http://[::1]:8080", false);
  });

  it("blocks private and local IPv4 targets when SSRF protection is enabled", () => {
    for (const url of [
      "http://127.0.0.1:8080/test",
      "http://127.0.0.1./test",
      "http://192.168.1.1/admin",
      "http://10.0.0.1/internal",
      "http://169.254.169.254/latest/meta-data",
    ]) {
      assert.throws(
        () => validateUrl(url, true),
        SecurityError,
        `Expected private target to be blocked: ${url}`,
      );
    }
  });

  it("blocks localhost variants when SSRF protection is enabled", () => {
    for (const url of [
      "http://localhost:3000",
      "http://foo.localhost/",
      "http://printer.local/",
    ]) {
      assert.throws(
        () => validateUrl(url, true),
        SecurityError,
        `Expected local target to be blocked: ${url}`,
      );
    }
  });

  it("blocks bare and bracketed IPv6 local targets when SSRF protection is enabled", () => {
    for (const url of [
      "http://[::1]:8080",
      "http://[::]/",
      "http://[fc00::1]/",
      "http://[fd12:3456::1]/",
      "http://[fe80::1]/",
      "http://[ff02::1]/",
    ]) {
      assert.throws(
        () => validateUrl(url, true),
        SecurityError,
        `Expected IPv6 target to be blocked: ${url}`,
      );
    }
  });

  it("blocks IPv4-mapped IPv6 targets when SSRF protection is enabled", () => {
    for (const url of [
      "http://[::ffff:127.0.0.1]/",
      "http://[::ffff:192.168.1.1]/",
      "http://[::ffff:7f00:1]/",
    ]) {
      assert.throws(
        () => validateUrl(url, true),
        SecurityError,
        `Expected mapped IPv6 target to be blocked: ${url}`,
      );
    }
  });

  it("classifies bare IPv6 and IPv4-mapped literals without DNS", () => {
    for (const address of [
      "::1",
      "::",
      "fc00::1",
      "fd12:3456::1",
      "fe80::1",
      "ff02::1",
      "::ffff:127.0.0.1",
      "::ffff:192.168.1.1",
    ]) {
      assert.equal(
        isPrivateIpAddress(address),
        true,
        `Expected private IPv6 literal: ${address}`,
      );
    }

    assert.equal(isPrivateIpAddress("2001:4860:4860::8888"), false);
    assert.equal(isPrivateIpAddress("93.184.216.34"), false);
  });

  it("always enforces HTTP(S) protocols", () => {
    for (const url of [
      "file:///etc/passwd",
      "ftp://files.example.com/",
      "data:text/html,hello",
      "javascript:alert(1)",
      "about:blank",
    ]) {
      assert.throws(
        () => validateUrl(url, false),
        SecurityError,
        `Expected protocol to be rejected without SSRF protection: ${url}`,
      );
      assert.throws(
        () => validateUrl(url, true),
        SecurityError,
        `Expected protocol to be rejected with SSRF protection: ${url}`,
      );
    }
  });

  it("always rejects embedded URL credentials", () => {
    for (const url of [
      "https://user@example.com/",
      "https://user:password@example.com/",
      "http://token@example.com/path",
    ]) {
      assert.throws(
        () => validateUrl(url, false),
        SecurityError,
        `Expected credentials to be rejected without SSRF protection: ${url}`,
      );
      assert.throws(
        () => validateUrl(url, true),
        SecurityError,
        `Expected credentials to be rejected with SSRF protection: ${url}`,
      );
    }
  });

  it("rejects embedded credentials during route revalidation", async () => {
    await assert.rejects(
      assertSafeRequestUrl("https://redirect-user:password@example.com/", true),
      SecurityError,
    );
  });

  it("allows public URL literals regardless of SSRF protection", () => {
    validateUrl("https://example.com", false);
    validateUrl("https://example.com", true);
    validateUrl("http://93.184.216.34", true);
  });
});

describe("DNS-aware URL validation", () => {
  function mockLookup(value: () => Promise<unknown>): () => void {
    const original = dns.promises.lookup;
    Object.defineProperty(dns.promises, "lookup", {
      configurable: true,
      writable: true,
      value,
    });
    return () => {
      Object.defineProperty(dns.promises, "lookup", {
        configurable: true,
        writable: true,
        value: original,
      });
    };
  }

  it("fails closed when DNS resolution fails", async () => {
    const restore = mockLookup(async () => {
      throw new Error("deterministic DNS failure");
    });
    try {
      await assert.rejects(
        validateUrlResolve("https://unresolvable.invalid", true),
        SecurityError,
      );
      await assert.rejects(
        assertSafeRequestUrl("https://unresolvable-route.invalid", true),
        SecurityError,
      );
    } finally {
      restore();
    }
  });

  it("fails closed when DNS resolves to a private address", async () => {
    const restore = mockLookup(async () => [
      { address: "10.0.0.8", family: 4 },
    ]);
    try {
      await assert.rejects(
        validateUrlResolve("https://private-dns.test", true),
        SecurityError,
      );
      await assert.rejects(
        assertSafeRequestUrl("https://private-route.test", true),
        SecurityError,
      );
    } finally {
      restore();
    }
  });

  it("caches successful DNS answers for five seconds", async () => {
    const originalNow = Date.now;
    let now = 1_700_000_000_000;
    let calls = 0;
    Date.now = () => now;

    const restore = mockLookup(async () => {
      calls += 1;
      return [{ address: "93.184.216.34", family: 4 }];
    });

    try {
      const url = "https://cached-public.test";
      await validateUrlResolve(url, true);
      await validateUrlResolve(url, true);
      assert.equal(calls, 1, "DNS answer should be reused inside the TTL");

      now += 4_999;
      await validateUrlResolve(url, true);
      assert.equal(calls, 1, "DNS answer should still be cached at 4.999s");

      now += 1;
      await validateUrlResolve(url, true);
      assert.equal(calls, 2, "DNS answer should be refreshed at the five-second TTL");
    } finally {
      restore();
      Date.now = originalNow;
    }
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
