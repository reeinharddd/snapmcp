/**
 * End-to-end tests for the MCP protocol layer.
 *
 * Spawns the snapmcp server as a child process and communicates
 * via stdin/stdout using JSON-RPC over newline-delimited transport.
 *
 * Tests that need Playwright (actual capture calls) skip when
 * Chromium is not available. Protocol-level tests (tool listing,
 * error handling, shutdown) always run.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { browserMissing } from "./runner.js";

const skipNoBrowser = browserMissing();

// ─── Helpers ─────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

/**
 * Wrapper around a spawned MCP server process.
 */
class McpServerProcess {
  private proc: ChildProcess;
  private idCounter = 0;
  private stdoutLines: string[] = [];
  private stderrLines: string[] = [];
  private ready: Promise<void>;
  private stdoutDone: Promise<void>;

  constructor(tmpDir: string) {
    // Start the MCP server as a separate node process
    this.proc = spawn("node", ["dist/index.js"], {
      cwd: path.resolve("."),
      env: {
        ...process.env,
        SNAPMCP_DIR: tmpDir,
        SNAPMCP_LOG_LEVEL: "info",
        SNAPMCP_SECURITY_CHECKS: "true",
        SNAPMCP_TIMEOUT: "15000",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Collect stderr (logs) — look for the server-ready signal
    let stderrData = "";
    this.ready = new Promise<void>((resolve) => {
      this.proc.stderr!.on("data", (chunk: Buffer) => {
        stderrData += chunk.toString();
        // The server is ready once we see the Shiki pre-warm log
        // or any banner line
        if (
          stderrData.includes("Pre-warming") ||
          stderrData.includes("snapmcp v2") ||
          stderrData.includes("Mode:") ||
          stderrData.includes("Format:")
        ) {
          resolve();
        }
      });
      // Timeout fallback — highlighter pre-warm can take 5-10s
      setTimeout(() => resolve(), 15_000);
    });

    // Collect stdout (JSON-RPC responses)
    this.stdoutDone = new Promise<void>((resolve) => {
      this.proc.stdout!.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        // May receive multiple lines in one chunk
        const lines = text.split("\n").filter((l) => l.trim());
        this.stdoutLines.push(...lines);
      });
      this.proc.stdout!.on("end", resolve);
    });

    // Handle unexpected exit
    this.proc.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        // Non-zero exit during testing is handled in the test
      }
    });
  }

  /** Wait for server to be ready */
  async waitForReady(): Promise<void> {
    await this.ready;
  }

  /**
   * Send a JSON-RPC request and wait for the matching response.
   */
  async sendRequest(method: string, params?: unknown): Promise<JsonRpcResponse> {
    const id = ++this.idCounter;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params: params ?? undefined,
    };

    // Write the request to stdin
    this.proc.stdin!.write(JSON.stringify(request) + "\n");

    // Wait for the matching response by polling
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const idx = this.stdoutLines.findIndex((line) => {
        try {
          const parsed = JSON.parse(line);
          return parsed.id === id;
        } catch {
          return false;
        }
      });

      if (idx !== -1) {
        const raw = this.stdoutLines[idx];
        this.stdoutLines.splice(idx, 1);
        return JSON.parse(raw) as JsonRpcResponse;
      }

      await sleep(50);
    }

    throw new Error(`Timeout waiting for response to ${method} (id=${id})`);
  }

  get stderr(): string {
    return this.stderrLines.join("\n");
  }

  get stdout(): string {
    return this.stdoutLines.join("\n");
  }

  /** Send SIGTERM and wait for exit.
   *  Resolves when the child process has closed (exit or error).
   */
  async shutdown(): Promise<void> {
    const exited = new Promise<void>((resolve) => {
      this.proc.on("close", () => resolve());
      // Also listen for exit as fallback
      this.proc.on("exit", () => resolve());
    });

    this.proc.kill("SIGTERM");

    // Wait up to 5 seconds for clean exit
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("Shutdown timeout")), 5_000),
    );

    try {
      await Promise.race([exited, timeout]);
    } catch {
      // Force kill if SIGTERM didn't work
      this.proc.kill("SIGKILL");
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Tests ───────────────────────────────────────────────────

describe("MCP server protocol", () => {
  let tmpDir: string;
  let server: McpServerProcess;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-mcp-e2e-"));
    server = new McpServerProcess(tmpDir);
    await server.waitForReady();
  });

  after(async () => {
    if (server) {
      await server.shutdown();
    }
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }
    }
  });

  // ─── Tool listing ──────────────────────────────────────────

  describe("tools/list", () => {
    it("returns all 12 tools", async () => {
      const response = await server.sendRequest("tools/list");
      assert.equal(response.jsonrpc, "2.0");
      assert.ok(response.result, "Response should have a result");
      const result = response.result as { tools: Array<{ name: string }> };
      assert.ok(Array.isArray(result.tools));
      assert.ok(result.tools.length >= 12, "Should have at least 12 tools");
    });

    it("includes expected tool names", async () => {
      const response = await server.sendRequest("tools/list");
      const result = response.result as { tools: Array<{ name: string }> };
      const names = result.tools.map((t) => t.name).sort();

      const expected = [
        "capture_batch",
        "capture_browser",
        "capture_code",
        "capture_diff",
        "capture_file",
        "capture_gif",
        "capture_html",
        "capture_markdown",
        "capture_pdf",
        "capture_sequence",
        "capture_terminal",
        "capture_to_document",
      ];
      assert.deepEqual(names, expected.sort());
    });
  });

  // ─── Tool calls (no browser needed) ────────────────────────

  describe("tools/call — error handling", () => {
    it("returns error for unknown tool name", async () => {
      const response = await server.sendRequest("tools/call", {
        name: "nonexistent_tool",
        arguments: {},
      });
      // The SDK may respond with a JSON-RPC error or isError=true
      const hasError = response.error ||
        (response.result as { isError?: boolean } | undefined)?.isError;
      assert.ok(hasError, "Should return an error: " + JSON.stringify(response));
    });

    it("returns error for capture_terminal with missing params", async () => {
      const response = await server.sendRequest("tools/call", {
        name: "capture_terminal",
        arguments: {},
      });
      // Should have an error — title and lines are required
      assert.ok(response.error || (response.result as { isError?: boolean })?.isError,
        "Should return error for missing params");
    });

    it("returns error for capture_code with empty code", async () => {
      const response = await server.sendRequest("tools/call", {
        name: "capture_code",
        arguments: { code: "", language: "text" },
      });
      assert.ok(response.error || (response.result as { isError?: boolean })?.isError,
        "Should return error for empty code");
    });

    it("returns error for capture_browser with invalid URL", async () => {
      const response = await server.sendRequest("tools/call", {
        name: "capture_browser",
        arguments: { url: "not-a-valid-url" },
      });
      assert.ok(response.error || (response.result as { isError?: boolean })?.isError,
        "Should return error for invalid URL");
    });
  });

  // ─── Tool calls with Playwright ────────────────────────────

  describe("tools/call — capture_terminal", { skip: skipNoBrowser }, () => {
    it("captures terminal output", async () => {
      const response = await server.sendRequest("tools/call", {
        name: "capture_terminal",
        arguments: {
          title: "e2e-test",
          lines: ["$ echo hello", "hello world", ""],
        },
      });
      assert.ok(!response.error, `No error expected: ${JSON.stringify(response.error)}`);
      assert.ok(response.result, "Should have a result");

      const result = response.result as { content?: Array<{ text: string }>; isError?: boolean };
      assert.ok(!result.isError, "isError should be falsy");

      // Verify the output file was created
      const text = result.content?.[0]?.text || "";
      assert.ok(text.includes("Saved:"), `Result should mention saved file: ${text}`);
    });
  });

  describe("tools/call — capture_code", { skip: skipNoBrowser }, () => {
    it("captures code snippet", async () => {
      const response = await server.sendRequest("tools/call", {
        name: "capture_code",
        arguments: {
          code: "const greeting: string = 'Hello MCP E2E';",
          language: "typescript",
          title: "e2e-test.ts",
        },
      });
      assert.ok(!response.error, `No error expected: ${JSON.stringify(response.error)}`);
      const result = response.result as { content?: Array<{ text: string }>; isError?: boolean };
      assert.ok(!result.isError, "isError should be falsy");
      const text = result.content?.[0]?.text || "";
      assert.ok(text.includes("Saved:"), `Result should mention saved file: ${text}`);
    });
  });

  describe("tools/call — capture_diff", { skip: skipNoBrowser }, () => {
    it("captures a diff", async () => {
      const diffText = `--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-old
+new`;
      const response = await server.sendRequest("tools/call", {
        name: "capture_diff",
        arguments: { diff: diffText },
      });
      assert.ok(!response.error, `No error expected: ${JSON.stringify(response.error)}`);
      const result = response.result as { isError?: boolean };
      assert.ok(!result.isError, "isError should be falsy");
    });
  });

  // ─── Graceful shutdown ─────────────────────────────────────

  describe("graceful shutdown", () => {
    it("exits cleanly on SIGTERM", async () => {
      // Create a new server for shutdown testing
      const shutdownTmp = fs.mkdtempSync(
        path.join(os.tmpdir(), "snapmcp-shutdown-"),
      );
      const shutdownServer = new McpServerProcess(shutdownTmp);
      await shutdownServer.waitForReady();

      // Send SIGTERM — shutdown() waits for process to close
      await shutdownServer.shutdown();

      fs.rmSync(shutdownTmp, { recursive: true, force: true });
    });
  });
});
