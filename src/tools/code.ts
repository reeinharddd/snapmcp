import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { captureCode } from "../renderer.js";

interface ToolDeps {
  outPath: (prefix: string, name?: string) => string;
  ok: (path: string) => { content: { type: "text"; text: string }[] };
  fail: (err: unknown) => { content: { type: "text"; text: string }[]; isError: boolean };
  config: import("../config.js").SnapConfig;
}

export function registerCodeTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.tool(
    "capture_code",
    "Generate a syntax-highlighted code screenshot using Shiki (50+ languages).",
    {
      code: z.string().min(1).describe("Source code to render"),
      language: z.string().default("text").describe("Programming language for highlighting"),
      title: z.string().default("code").describe("Window title"),
      startLine: z.number().int().min(1).optional().describe("First line number to show in the gutter"),
      endLine: z.number().int().min(1).optional().describe("Last line number to show in the gutter"),
      output: z.string().optional().describe("Output filename (default: auto-generated)"),
    },
    async ({ code, language, title, startLine, endLine, output }) => {
      try {
        const p = outPath("code", output);
        await captureCode(code, language, title, p, config, startLine, endLine);
        return ok(p);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
