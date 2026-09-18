import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  captureTerminal, captureCode, captureFile,
  captureBrowser, captureMarkdown, captureHtml, captureDiff
} from "../renderer.js";
import { runCleanup } from "../renderer.js";
import path from "path";

interface ToolDeps {
  outPath: (prefix: string, name?: string) => string;
  ok: (path: string) => { content: { type: "text"; text: string }[] };
  fail: (err: unknown) => { content: { type: "text"; text: string }[]; isError: boolean };
  config: import("../config.js").SnapConfig;
}

// Discriminated union for capture parameters - replaces black-box z.record(z.string(), z.any())
const TerminalParams = z.object({
  title: z.string().max(100).optional().describe("Window title (default: 'terminal')"),
  lines: z.array(z.string()).min(1).max(1000).describe("Lines to render. Prefix with '$ ' for prompts."),
});

const CodeParams = z.object({
  code: z.string().min(1).max(200_000).describe("Source code to render"),
  language: z.string().default("text").describe("Programming language (typescript, python, rust, go, etc.)"),
  title: z.string().max(100).optional().describe("Window title (default: 'code')"),
  startLine: z.number().int().min(1).optional().describe("First line number (1-indexed)"),
  endLine: z.number().int().min(1).optional().describe("Last line number (1-indexed, inclusive)"),
});

const FileParams = z.object({
  filePath: z.string().min(1).describe("Absolute path to file (must be in SNAPMCP_ALLOWED_PATHS)"),
  startLine: z.number().int().min(1).optional().describe("First line number (1-indexed)"),
  endLine: z.number().int().min(1).optional().describe("Last line number (1-indexed, inclusive)"),
});

const BrowserParams = z.object({
  url: z.string().url().describe("URL to capture (http/https, SSRF protected)"),
  fullPage: z.boolean().default(false).describe("Capture full scrollable page"),
  width: z.number().int().min(320).max(3840).default(1280).describe("Viewport width (px)"),
  height: z.number().int().min(240).max(4096).default(800).describe("Viewport height (px)"),
});

const MarkdownParams = z.object({
  markdown: z.string().min(1).max(200_000).describe("Markdown content (GFM supported)"),
  title: z.string().max(100).optional().describe("Document title (default: 'document')"),
});

const HtmlParams = z.object({
  html: z.string().min(1).max(200_000).describe("HTML content (external resources blocked)"),
  title: z.string().max(100).optional().describe("Description for logging (default: 'html')"),
});

const DiffParams = z.object({
  diff: z.string().min(1).max(500_000).describe("Unified diff content (git diff format)"),
});

const CaptureParams = z.discriminatedUnion("type", [
  TerminalParams.extend({ type: z.literal("terminal") }),
  CodeParams.extend({ type: z.literal("code") }),
  FileParams.extend({ type: z.literal("file") }),
  BrowserParams.extend({ type: z.literal("browser") }),
  MarkdownParams.extend({ type: z.literal("markdown") }),
  HtmlParams.extend({ type: z.literal("html") }),
  DiffParams.extend({ type: z.literal("diff") }),
]);

export function registerBatchTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.tool(
    "capture_batch",
    "Capture multiple items in a single call. Each capture is processed sequentially with its own parameters. Use for batch documentation generation (e.g., capture terminal output, code file, and browser screenshot together). Maximum 10 captures per call.",
    {
      captures: z.array(CaptureParams).min(1).max(10).describe("Array of captures to process. Each capture specifies its type and type-specific parameters."),
      output: z.string().optional().describe("Output directory (default: SNAPMCP_DIR). Captures saved as individual files."),
    },
    async ({ captures, output }) => {
      try {
        const OUTPUT_DIR = output ? path.resolve(config.outputDir, output) : config.outputDir;
        const results: { type: string; path: string; caption?: string }[] = [];

        for (const cap of captures) {
          const prefix = cap.type;
          const p = path.join(OUTPUT_DIR, `${prefix}-${Date.now()}.${config.format === "jpeg" ? "jpg" : "png"}`);

          switch (cap.type) {
            case "terminal": {
              await captureTerminal(cap.title || "terminal", cap.lines, p, config);
              break;
            }
            case "code": {
              await captureCode(cap.code, cap.language, cap.title || "code", p, config, cap.startLine, cap.endLine);
              break;
            }
            case "file": {
              await captureFile(cap.filePath, p, config, cap.startLine, cap.endLine);
              break;
            }
            case "browser": {
              await captureBrowser(cap.url, p, cap.fullPage, cap.width, cap.height, config);
              break;
            }
            case "markdown": {
              await captureMarkdown(cap.markdown, cap.title || "document", p, config);
              break;
            }
            case "html": {
              await captureHtml(cap.html, cap.title || "html", p, config);
              break;
            }
            case "diff": {
              await captureDiff(cap.diff, p, config);
              break;
            }
          }

          results.push({ type: cap.type, path: p });
        }

        runCleanup(config);

        const summary = results.map(r => `  ${r.type}: ${r.path}`).join("\n");
        return ok(`✅ Batch complete (${results.length} captures):\n${summary}`);
      } catch (e) {
        return fail(e);
      }
    },
  );
}