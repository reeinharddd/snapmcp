import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { captureCode } from "../renderer.js";
import { TOOL_LIMITS } from "../capabilities.js";

interface ToolDeps {
  outPath: (prefix: string, name?: string) => string;
  ok: (path: string) => { content: { type: "text"; text: string }[] };
  fail: (err: unknown) => { content: { type: "text"; text: string }[]; isError: boolean };
  config: import("../config.js").SnapConfig;
}

export function registerCodeTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.tool(
    "capture_code",
    "Generate a syntax-highlighted code screenshot using Shiki (300+ bundled languages and 27 themes). Supports inclusive startLine/endLine ranges and optional window chrome. Ideal for code documentation, tutorials, and sharing snippets with an IDE-like appearance.",
    {
      code: z.string().min(1).max(TOOL_LIMITS.code.maxBytes).describe(`Source code to render. Maximum ${TOOL_LIMITS.code.maxBytes / 1_000}KB.`),
      language: z.string().default("text").describe("Programming language for highlighting. Supports 300+ bundled Shiki languages, including typescript, javascript, python, rust, go, java, c, cpp, csharp, ruby, php, swift, kotlin, sql, json, yaml, markdown, html, css, bash, dockerfile, toml, xml, graphql, and many more. Use 'text' for plain text."),
      title: z.string().max(100).default("code").describe("Window title shown in the title bar (e.g., 'src/main.ts', 'example.py')"),
      startLine: z.number().int().min(1).optional().describe("First line number to show in the gutter (1-indexed). Use with endLine to show a code range."),
      endLine: z.number().int().min(1).optional().describe("Last line number to show in the gutter (1-indexed, inclusive). Must be >= startLine if both provided."),
      output: z.string().optional().describe("Output filename (default: auto-generated as 'code-<timestamp>.png' or '.jpeg' based on SNAPMCP_FORMAT). Include extension to override format."),
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
