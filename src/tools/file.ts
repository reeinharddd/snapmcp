import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { captureFile } from "../renderer.js";

interface ToolDeps {
  outPath: (prefix: string, name?: string) => string;
  ok: (path: string) => { content: { type: "text"; text: string }[] };
  fail: (err: unknown) => { content: { type: "text"; text: string }[]; isError: boolean };
  config: import("../config.js").SnapConfig;
}

export function registerFileTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.tool(
    "capture_file",
    "Read a file and generate a syntax-highlighted screenshot based on its extension.",
    {
      filePath: z.string().min(1).describe("Absolute path to the file to capture"),
      startLine: z.number().int().min(1).optional().describe("First line number to capture (1-indexed, inclusive)"),
      endLine: z.number().int().min(1).optional().describe("Last line number to capture (1-indexed, inclusive)"),
      output: z.string().optional().describe("Output filename (default: auto-generated)"),
    },
    async ({ filePath, startLine, endLine, output }) => {
      try {
        const p = outPath("file", output);
        await captureFile(filePath, p, config, startLine, endLine);
        return ok(p);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
