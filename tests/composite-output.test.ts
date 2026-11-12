import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "../src/config.js";
import { registerBatchTool } from "../src/tools/batch.js";
import { registerSequenceTool } from "../src/tools/sequence.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

type ToolResult = {
  content?: Array<{ text?: string }>;
  isError?: boolean;
};

function registerFakeTool(
  register: (server: McpServer, deps: ReturnType<typeof makeDeps>) => void,
  config: ReturnType<typeof loadConfig>,
): ToolHandler {
  let handler: ToolHandler | undefined;
  const server = {
    registerTool(
      _name: string,
      _config: unknown,
      callback: ToolHandler,
    ): void {
      handler = callback;
    },
  } as unknown as McpServer;

  register(server, makeDeps(config));
  assert.ok(handler, "Expected the tool registration to install a handler");
  return handler;
}

function makeDeps(config: ReturnType<typeof loadConfig>) {
  return {
    outPath: (_prefix: string, _name?: string): string => {
      throw new Error("outPath should not be reached for an invalid composite output");
    },
    ok: (value: string) => ({
      content: [{ type: "text" as const, text: value }],
    }),
    fail: (error: unknown) => ({
      content: [{
        type: "text" as const,
        text: error instanceof Error ? error.message : String(error),
      }],
      isError: true,
    }),
    config,
  };
}

describe("composite tool output confinement", () => {
  let root: string;
  let outputDir: string;
  let config: ReturnType<typeof loadConfig>;

  before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-composite-output-"));
    outputDir = path.join(root, "captures");
    fs.mkdirSync(outputDir);
    config = {
      ...loadConfig(),
      outputDir,
      allowedPaths: [outputDir],
      ssrfProtection: false,
    };
  });

  after(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("blocks traversal in capture_batch output directories", async () => {
    const handler = registerFakeTool(registerBatchTool, config);
    for (const output of ["../escape", "nested/../../escape", "..%2Fescape"]) {
      const result = await handler({
        captures: [{ type: "terminal", title: "test", lines: ["$ echo safe"] }],
        output,
      }) as ToolResult;

      assert.equal(result.isError, true, `Expected composite output to fail: ${output}`);
      assert.match(result.content?.[0]?.text ?? "", /traversal|outside|security/i);
    }
  });

  it("blocks traversal in capture_sequence output directories", async () => {
    const handler = registerFakeTool(registerSequenceTool, config);
    const result = await handler({
      steps: [{ type: "terminal", title: "test", lines: ["$ echo safe"] }],
      output: "../escape",
    }) as ToolResult;

    assert.equal(result.isError, true);
    assert.match(result.content?.[0]?.text ?? "", /traversal|outside|security/i);
  });

  it("blocks a symlinked composite output directory that escapes SNAPMCP_DIR", (t) => {
    const outside = path.join(root, "outside");
    fs.mkdirSync(outside);
    const link = path.join(outputDir, "linked-output");
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
        return;
      }
      throw error;
    }

    const handler = registerFakeTool(registerBatchTool, config);
    return handler({
      captures: [{ type: "terminal", title: "test", lines: ["$ echo safe"] }],
      output: "linked-output",
    }).then((result) => {
      const toolResult = result as ToolResult;
      assert.equal(toolResult.isError, true);
      assert.match(toolResult.content?.[0]?.text ?? "", /symlink|outside|security/i);
    });
  });
});
