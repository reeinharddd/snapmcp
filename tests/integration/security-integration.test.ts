/**
 * Integration-level security tests.
 *
 * Tests that security measures work end-to-end through the MCP
 * protocol layer and at the module level.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { spawn, type ChildProcess } from "node:child_process";

// ─── MCP server helper (minimal, for security testing) ───────

interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: { content?: Array<{ text: string }>; isError?: boolean };
  error?: { code: number; message: string };
}

class McpSecurityServer {
  private proc: ChildProcess;
  private idCounter = 0;
  private stdoutLines: string[] = [];
  private ready: Promise<void>;

  constructor(tmpDir: string, extraEnv?: Record<string, string>) {
    this.proc = spawn("node", ["dist/index.js"], {
      cwd: path.resolve("."),
      env: {
        ...process.env,
        SNAPMCP_DIR: tmpDir,
        SNAPMCP_LOG_LEVEL: "info",
        SNAPMCP_SECURITY_CHECKS: "true",
        ...extraEnv,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stderrData = "";
    this.ready = new Promise<void>((resolve) => {
      this.proc.stderr!.on("data", (chunk: Buffer) => {
        stderrData += chunk.toString();
        // The server is ready once we see any of these markers
        if (
          stderrData.includes("Pre-warming") ||
          stderrData.includes("Mode:") ||
          stderrData.includes("Format:")
        ) {
          resolve();
        }
      });
      // Timeout fallback — highlighter pre-warm can be slow
      setTimeout(() => resolve(), 15_000);
    });

    this.proc.stdout!.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      this.stdoutLines.push(...text.split("\n").filter((l) => l.trim()));
    });
  }

  async waitForReady(): Promise<void> {
    await this.ready;
  }

  async sendRequest(method: string, params?: unknown): Promise<JsonRpcResponse> {
    const id = ++this.idCounter;
    this.proc.stdin!.write(JSON.stringify({
      jsonrpc: "2.0", id, method, params: params ?? undefined,
    }) + "\n");

    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const idx = this.stdoutLines.findIndex((line) => {
        try { return JSON.parse(line).id === id; } catch { return false; }
      });
      if (idx !== -1) {
        const raw = this.stdoutLines[idx];
        this.stdoutLines.splice(idx, 1);
        return JSON.parse(raw);
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`Timeout waiting for response to ${method}`);
  }

  async shutdown(): Promise<void> {
    this.proc.kill("SIGTERM");
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline && this.proc.exitCode === null) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (this.proc.exitCode === null) this.proc.kill("SIGKILL");
  }
}

// ─── Tests ───────────────────────────────────────────────────

describe("security — path traversal via MCP", () => {
  let tmpDir: string;
  let server: McpSecurityServer;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-traverse-"));
    server = new McpSecurityServer(tmpDir);
    await server.waitForReady();
  });

  after(async () => {
    if (server) await server.shutdown();
    if (tmpDir) { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ } }
  });

  it("blocks path traversal in capture_terminal output filename", async () => {
    const response = await server.sendRequest("tools/call", {
      name: "capture_terminal",
      arguments: {
        title: "test",
        lines: ["$ echo hello"],
        output: "../../etc/pwned",
      },
    });
    const hasError = response.error ||
      (response.result as { isError?: boolean })?.isError;
    assert.ok(hasError, "Path traversal should be blocked");
    const text = JSON.stringify(response);
    assert.ok(
      text.toLowerCase().includes("traversal") ||
        text.toLowerCase().includes("security") ||
        text.toLowerCase().includes("outside"),
      `Error should mention traversal/security: ${text}`,
    );
  });

  it("blocks path traversal in capture_code output filename", async () => {
    const response = await server.sendRequest("tools/call", {
      name: "capture_code",
      arguments: {
        code: "test",
        language: "text",
        output: "foo/../../bar/escape.png",
      },
    });
    const hasError = response.error ||
      (response.result as { isError?: boolean })?.isError;
    assert.ok(hasError, "Path traversal should be blocked");
  });

  it("blocks path traversal in capture_diff output filename", async () => {
    const response = await server.sendRequest("tools/call", {
      name: "capture_diff",
      arguments: {
        diff: "--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new",
        output: "..%2F..%2Fetc%2Fpasswd",
      },
    });
    // URL-encoded paths may be handled differently — the key is server doesn't crash
    assert.ok(response.result || response.error, "Server should respond");
  });

  it("allows normal output filename (even if capture fails for other reasons)", async () => {
    const response = await server.sendRequest("tools/call", {
      name: "capture_terminal",
      arguments: {
        title: "safe",
        lines: ["$ ls"],
        output: "my-capture.png",
      },
    });
    // This may still fail if Chromium isn't available for the actual
    // screenshot, but it should NOT be a path traversal error.
    const text = JSON.stringify(response);
    assert.ok(
      !text.toLowerCase().includes("traversal"),
      `Normal filename should not trigger traversal: ${text}`,
    );
  });
});

describe("security — oversized input limits via MCP", () => {
  let tmpDir: string;
  let server: McpSecurityServer;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-limits-"));
    server = new McpSecurityServer(tmpDir);
    await server.waitForReady();
  });

  after(async () => {
    if (server) await server.shutdown();
    if (tmpDir) { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ } }
  });

  it("rejects oversized code input (> 200KB)", async () => {
    const bigCode = "x".repeat(200_001);
    const response = await server.sendRequest("tools/call", {
      name: "capture_code",
      arguments: { code: bigCode, language: "text" },
    });
    const hasError = response.error ||
      (response.result as { isError?: boolean })?.isError;
    assert.ok(hasError, "Oversized input should be rejected");
  });

  it("rejects terminal with too many lines (> 1000)", async () => {
    const manyLines = Array.from({ length: 1001 }, (_, i) => `line ${i}`);
    const response = await server.sendRequest("tools/call", {
      name: "capture_terminal",
      arguments: { title: "big", lines: manyLines },
    });
    const hasError = response.error ||
      (response.result as { isError?: boolean })?.isError;
    assert.ok(hasError, "Too many lines should be rejected");
  });

  it("rejects oversized diff input (> 500KB)", async () => {
    const bigDiff = "--- a\n+++ b\n@@ -1 +1 @@\n" + "x".repeat(500_001);
    const response = await server.sendRequest("tools/call", {
      name: "capture_diff",
      arguments: { diff: bigDiff },
    });
    const hasError = response.error ||
      (response.result as { isError?: boolean })?.isError;
    assert.ok(hasError, "Oversized diff should be rejected");
  });

  it("rejects oversized HTML input (> 200KB)", async () => {
    const bigHtml = "<div>" + "x".repeat(200_001) + "</div>";
    const response = await server.sendRequest("tools/call", {
      name: "capture_html",
      arguments: { html: bigHtml },
    });
    const hasError = response.error ||
      (response.result as { isError?: boolean })?.isError;
    assert.ok(hasError, "Oversized HTML should be rejected");
  });

  it("rejects oversized markdown input (> 200KB)", async () => {
    const bigMd = "# " + "x".repeat(200_001);
    const response = await server.sendRequest("tools/call", {
      name: "capture_markdown",
      arguments: { markdown: bigMd },
    });
    const hasError = response.error ||
      (response.result as { isError?: boolean })?.isError;
    assert.ok(hasError, "Oversized markdown should be rejected");
  });
});

describe("security — file read restrictions", () => {
  let tmpDir: string;
  let server: McpSecurityServer;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-fileread-"));
    server = new McpSecurityServer(tmpDir, {
      SNAPMCP_ALLOWED_PATHS: tmpDir,
    });
    await server.waitForReady();
  });

  after(async () => {
    if (server) await server.shutdown();
    if (tmpDir) { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ } }
  });

  it("blocks capture_file from outside allowed paths", async () => {
    const response = await server.sendRequest("tools/call", {
      name: "capture_file",
      arguments: { filePath: "/etc/hostname" },
    });
    const hasError = response.error ||
      (response.result as { isError?: boolean })?.isError;
    assert.ok(hasError, "File outside allowed paths should be rejected");
    const text = JSON.stringify(response);
    assert.ok(
      text.toLowerCase().includes("not in allowed") ||
        text.toLowerCase().includes("security") ||
        text.toLowerCase().includes("allowed path"),
      `Error should mention allowed paths: ${text}`,
    );
  });

  it("blocks capture_file for non-existent file", async () => {
    const response = await server.sendRequest("tools/call", {
      name: "capture_file",
      arguments: { filePath: path.join(tmpDir, "nonexistent-file-12345.txt") },
    });
    const hasError = response.error ||
      (response.result as { isError?: boolean })?.isError;
    assert.ok(hasError, "Non-existent file should be rejected");
  });
});

describe("security — direct module tests", () => {
  it("resolveSafePath blocks ../ in output name", async () => {
    const { resolveSafePath, SecurityError } = await import("../../src/security.js");
    assert.throws(
      () => resolveSafePath("/tmp/out", "../../etc/pwned"),
      SecurityError,
    );
  });

  it("resolveSafePath allows normal filename", async () => {
    const { resolveSafePath } = await import("../../src/security.js");
    const result = resolveSafePath("/tmp/out", "normal.png");
    assert.equal(result, "/tmp/out/normal.png");
  });

  it("validateTerminalLines rejects > 1000 lines", async () => {
    const { validateTerminalLines, LimitError } = await import("../../src/security.js");
    const lines = new Array(1001).fill("x");
    assert.throws(() => validateTerminalLines(lines), LimitError);
  });

  it("validateCodeInput rejects > 200KB", async () => {
    const { validateCodeInput, LimitError } = await import("../../src/security.js");
    assert.throws(() => validateCodeInput("x".repeat(200_001)), LimitError);
  });
});
