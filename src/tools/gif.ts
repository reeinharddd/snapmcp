import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  captureTerminal, captureCode, captureFile,
  captureBrowser, captureMarkdown, captureHtml, captureDiff
} from "../renderer.js";
import { createGif, type GifFrame } from "../gif.js";
import { resolveSafePath } from "../security.js";
import { runCleanup } from "../renderer.js";
import path from "path";

interface ToolDeps {
  outPath: (prefix: string, name?: string) => string;
  ok: (path: string) => { content: { type: "text"; text: string }[] };
  fail: (err: unknown) => { content: { type: "text"; text: string }[]; isError: boolean };
  config: import("../config.js").SnapConfig;
}

// Reuse the same discriminated union from batch tool
const TerminalParams = z.object({
  title: z.string().max(100).optional().describe("Window title (default: 'frame')"),
  lines: z.array(z.string()).min(1).max(1000).describe("Lines to render. Prefix with '$ ' for prompts."),
});

const CodeParams = z.object({
  code: z.string().min(1).max(200_000).describe("Source code to render"),
  language: z.string().default("text").describe("Programming language (typescript, python, rust, go, etc.)"),
  title: z.string().max(100).optional().describe("Window title (default: 'frame')"),
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
  title: z.string().max(100).optional().describe("Document title (default: 'frame')"),
});

const HtmlParams = z.object({
  html: z.string().min(1).max(200_000).describe("HTML content (external resources blocked)"),
  title: z.string().max(100).optional().describe("Description for logging (default: 'frame')"),
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

export function registerGifTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.tool(
    "capture_gif",
    "Create an animated GIF from sequential captures. Each frame is captured with full type-specific parameters, then compiled into a GIF. Use for animated tutorials, before/after comparisons, step-by-step demonstrations. Maximum 60 frames, maximum canvas 8192x8192.",
    {
      title: z.string().max(100).default("animation").describe("Name for the GIF (used in default filename)"),
      captures: z.array(CaptureParams).min(2).max(60).describe("Array of frames to capture. Each frame specifies its capture type and type-specific parameters. Minimum 2, maximum 60 frames."),
      frameDelay: z.number().int().min(10).max(5000).default(800).describe("Frame delay in milliseconds (10-5000). Default 800ms."),
      loop: z.boolean().default(true).describe("Whether the GIF loops infinitely (true) or plays once (false)"),
      output: z.string().optional().describe("Output filename (default: auto-generated as '<title>-<timestamp>.gif'). Must end in .gif"),
    },
    async ({ title, captures, frameDelay, loop, output }) => {
      try {
        const framePaths: string[] = [];

        for (const cap of captures) {
          const prefix = cap.type;
          const p = path.join(config.outputDir, `${prefix}-${Date.now()}.${config.format === "jpeg" ? "jpg" : "png"}`);

          switch (cap.type) {
            case "terminal": {
              await captureTerminal(cap.title || "frame", cap.lines, p, config);
              break;
            }
            case "code": {
              await captureCode(cap.code, cap.language, cap.title || "frame", p, config, cap.startLine, cap.endLine);
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
              await captureMarkdown(cap.markdown, cap.title || "frame", p, config);
              break;
            }
            case "html": {
              await captureHtml(cap.html, cap.title || "frame", p, config);
              break;
            }
            case "diff": {
              await captureDiff(cap.diff, p, config);
              break;
            }
          }
          framePaths.push(p);
        }

        // Compile into GIF
        const gifOutput = output
          ? resolveSafePath(config.outputDir, output)
          : path.join(config.outputDir, `${title}-${Date.now()}.gif`);

        const frames: GifFrame[] = framePaths.map(fp => ({
          filePath: fp,
          delay: Math.round(frameDelay / 10), // gifenc uses centiseconds
        }));
        const result = await createGif(frames, gifOutput, { loop });

        runCleanup(config);
        return ok(result);
      } catch (e) {
        return fail(e);
      }
    },
  );
}