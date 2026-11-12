import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  captureTerminal, captureCode, captureFile,
  captureBrowser, captureMarkdown, captureHtml, captureDiff
} from "../renderer.js";
import { createGif, type GifFrame } from "../gif.js";
import { runCleanup } from "../renderer.js";
import {
  createOutputPath,
  resolveNamedOutput,
  resolveOutputDirectory,
} from "../output.js";
import fs from "node:fs";
import path from "node:path";
import { TOOL_LIMITS } from "../capabilities.js";
import { describeFile, gifOutputShape, structuredResult } from "../results.js";
import type { ToolDeps } from "./deps.js";

// Reuse the same discriminated union from batch tool
const TerminalParams = z.object({
  title: z.string().max(100).optional().describe("Window title (default: 'frame')"),
  lines: z.array(z.string()).min(1).max(TOOL_LIMITS.terminal.maxLines).describe("Lines to render. Prefix with '$ ' for prompts."),
});

const CodeParams = z.object({
  code: z.string().min(1).max(TOOL_LIMITS.code.maxBytes).describe("Source code to render"),
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
  width: z.number().int().min(TOOL_LIMITS.browser.minWidth).max(TOOL_LIMITS.browser.maxWidth).default(1280).describe("Viewport width (px)"),
  height: z.number().int().min(TOOL_LIMITS.browser.minHeight).max(TOOL_LIMITS.browser.maxHeight).default(800).describe("Viewport height (px)"),
});

const MarkdownParams = z.object({
  markdown: z.string().min(1).max(TOOL_LIMITS.markdown.maxBytes).describe("Markdown content (GFM supported)"),
  title: z.string().max(100).optional().describe("Document title (default: 'frame')"),
});

const HtmlParams = z.object({
  html: z.string().min(1).max(TOOL_LIMITS.html.maxBytes).describe("HTML content (external resources blocked)"),
  title: z.string().max(100).optional().describe("Description for logging (default: 'frame')"),
});

const DiffParams = z.object({
  diff: z.string().min(1).max(TOOL_LIMITS.diff.maxBytes).describe("Unified diff content (git diff format)"),
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

export function registerGifTool(server: McpServer, { fail, config }: ToolDeps): void {
  server.registerTool(
    "capture_gif",
    {
      title: "Capture an animated GIF",
      description: `Create an animated GIF from ${TOOL_LIMITS.gif.minFrames}-${TOOL_LIMITS.gif.maxFrames} sequential captures. Frames are rendered as PNG, compiled into a GIF, and removed after encoding. loop=true repeats forever; loop=false plays once. Maximum canvas ${TOOL_LIMITS.gif.maxDimension}x${TOOL_LIMITS.gif.maxDimension}.`,
      inputSchema: {
        title: z.string().max(100).default("animation").describe("Name for the GIF (used in default filename)"),
        captures: z.array(CaptureParams).min(TOOL_LIMITS.gif.minFrames).max(TOOL_LIMITS.gif.maxFrames).describe(`Array of frames to capture. Each frame specifies its capture type and type-specific parameters. Minimum ${TOOL_LIMITS.gif.minFrames}, maximum ${TOOL_LIMITS.gif.maxFrames} frames.`),
        frameDelay: z.number().int().min(TOOL_LIMITS.gif.minFrameDelayMs).max(TOOL_LIMITS.gif.maxFrameDelayMs).default(800).describe(`Frame delay in milliseconds for GIF (${TOOL_LIMITS.gif.minFrameDelayMs}-${TOOL_LIMITS.gif.maxFrameDelayMs}). Default 800ms.`),
        loop: z.boolean().default(true).describe("Whether the GIF loops infinitely (true) or plays once (false)"),
        output: z.string().optional().describe("Output filename (default: auto-generated as '<title>-<timestamp>.gif'). Must end in .gif"),
      },
      outputSchema: gifOutputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ title, captures, frameDelay, loop, output }) => {
      try {
        const outputDir = resolveOutputDirectory(config.outputDir);
        const frameDir = fs.mkdtempSync(path.join(outputDir, ".snapmcp-gif-"));
        const framePaths: string[] = [];
        const renderConfig = { ...config, format: "png" as const };

        try {
          for (const cap of captures) {
            const prefix = cap.type;
            const p = createOutputPath(config.outputDir, frameDir, prefix, "png");

            switch (cap.type) {
              case "terminal": {
                await captureTerminal(cap.title || "frame", cap.lines, p, renderConfig);
                break;
              }
              case "code": {
                await captureCode(cap.code, cap.language, cap.title || "frame", p, renderConfig, cap.startLine, cap.endLine);
                break;
              }
              case "file": {
                await captureFile(cap.filePath, p, renderConfig, cap.startLine, cap.endLine);
                break;
              }
              case "browser": {
                await captureBrowser(cap.url, p, cap.fullPage, cap.width, cap.height, renderConfig);
                break;
              }
              case "markdown": {
                await captureMarkdown(cap.markdown, cap.title || "frame", p, renderConfig);
                break;
              }
              case "html": {
                await captureHtml(cap.html, cap.title || "frame", p, renderConfig);
                break;
              }
              case "diff": {
                await captureDiff(cap.diff, p, renderConfig);
                break;
              }
            }
            framePaths.push(p);
          }

          const gifOutput = output
            ? resolveNamedOutput(config.outputDir, output, [".gif"])
            : createOutputPath(config.outputDir, outputDir, title, "gif");

          const frames: GifFrame[] = framePaths.map((filePath) => ({
            filePath,
            delay: frameDelay,
          }));
          const result = await createGif(frames, gifOutput, { loop });

          runCleanup(config);

          const descriptor = describeFile(result);
          return structuredResult(
            { ...descriptor, frames: captures.length },
            `✅ Saved: ${descriptor.path} (${captures.length} frames)`,
          );
        } finally {
          for (const filePath of framePaths) {
            try { fs.unlinkSync(filePath); } catch { /* already removed */ }
          }
          try { fs.rmdirSync(frameDir); } catch { /* best-effort cleanup */ }
        }
      } catch (e) {
        return fail(e);
      }
    },
  );
}
