import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  captureTerminal, captureCode, captureFile,
  captureBrowser, captureMarkdown, captureHtml, captureDiff
} from "../renderer.js";
import { createGif, type GifFrame } from "../gif.js";
import { runCleanup } from "../renderer.js";
import { createOutputPath, resolveOutputDirectory } from "../output.js";
import { TOOL_LIMITS } from "../capabilities.js";

interface ToolDeps {
  outPath: (prefix: string, name?: string) => string;
  ok: (path: string) => { content: { type: "text"; text: string }[] };
  fail: (err: unknown) => { content: { type: "text"; text: string }[]; isError: boolean };
  config: import("../config.js").SnapConfig;
}

// Common fields for all step types
const StepCommon = {
  stepNumber: z.number().int().min(1).optional().describe("Step number label (auto-assigned if omitted)"),
  label: z.string().max(100).optional().describe("Optional label for this step"),
};

// Discriminated union for step parameters - include common fields in each variant
const TerminalParams = z.object({
  type: z.literal("terminal"),
  title: z.string().max(100).optional().describe("Window title (default: 'step')"),
  lines: z.array(z.string()).min(1).max(TOOL_LIMITS.terminal.maxLines).describe("Lines to render. Prefix with '$ ' for prompts."),
  ...StepCommon,
});

const CodeParams = z.object({
  type: z.literal("code"),
  code: z.string().min(1).max(TOOL_LIMITS.code.maxBytes).describe("Source code to render"),
  language: z.string().default("text").describe("Programming language (typescript, python, rust, go, etc.)"),
  title: z.string().max(100).optional().describe("Window title (default: 'step')"),
  startLine: z.number().int().min(1).optional().describe("First line number (1-indexed)"),
  endLine: z.number().int().min(1).optional().describe("Last line number (1-indexed, inclusive)"),
  ...StepCommon,
});

const FileParams = z.object({
  type: z.literal("file"),
  filePath: z.string().min(1).describe("Absolute path to file (must be in SNAPMCP_ALLOWED_PATHS)"),
  startLine: z.number().int().min(1).optional().describe("First line number (1-indexed)"),
  endLine: z.number().int().min(1).optional().describe("Last line number (1-indexed, inclusive)"),
  ...StepCommon,
});

const BrowserParams = z.object({
  type: z.literal("browser"),
  url: z.string().url().describe("URL to capture (http/https, SSRF protected)"),
  fullPage: z.boolean().default(false).describe("Capture full scrollable page"),
  width: z.number().int().min(TOOL_LIMITS.browser.minWidth).max(TOOL_LIMITS.browser.maxWidth).default(1280).describe("Viewport width (px)"),
  height: z.number().int().min(TOOL_LIMITS.browser.minHeight).max(TOOL_LIMITS.browser.maxHeight).default(800).describe("Viewport height (px)"),
  ...StepCommon,
});

const MarkdownParams = z.object({
  type: z.literal("markdown"),
  markdown: z.string().min(1).max(TOOL_LIMITS.markdown.maxBytes).describe("Markdown content (GFM supported)"),
  title: z.string().max(100).optional().describe("Document title (default: 'step')"),
  ...StepCommon,
});

const HtmlParams = z.object({
  type: z.literal("html"),
  html: z.string().min(1).max(TOOL_LIMITS.html.maxBytes).describe("HTML content (external resources blocked)"),
  title: z.string().max(100).optional().describe("Description for logging (default: 'step')"),
  ...StepCommon,
});

const DiffParams = z.object({
  type: z.literal("diff"),
  diff: z.string().min(1).max(TOOL_LIMITS.diff.maxBytes).describe("Unified diff content (git diff format)"),
  ...StepCommon,
});

const StepSchema = z.discriminatedUnion("type", [
  TerminalParams, CodeParams, FileParams, BrowserParams,
  MarkdownParams, HtmlParams, DiffParams,
]);

export function registerSequenceTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.tool(
    "capture_sequence",
    `Capture ordered process steps as individual image files and optionally compile them into a GIF. Each step has typed capture parameters plus stepNumber and label. When GIF output is requested, frames are rendered as PNG. Maximum ${TOOL_LIMITS.sequence.maxSteps} steps.`,
    {
      steps: z.array(StepSchema).min(1).max(TOOL_LIMITS.sequence.maxSteps).describe("Array of steps to capture. Each step specifies its capture type, type-specific parameters, plus optional stepNumber and label."),
      compileGif: z.boolean().default(false).describe("Compile frames into an animated GIF (requires at least 2 steps)"),
      frameDelay: z.number().int().min(TOOL_LIMITS.gif.minFrameDelayMs).max(TOOL_LIMITS.gif.maxFrameDelayMs).default(800).describe(`Frame delay in milliseconds for GIF (${TOOL_LIMITS.gif.minFrameDelayMs}-${TOOL_LIMITS.gif.maxFrameDelayMs}). Default 800ms.`),
      loop: z.boolean().default(true).describe("Whether the GIF loops infinitely"),
      output: z.string().optional().describe("Output directory (default: SNAPMCP_DIR). Steps saved as individual files, GIF as sequence-<timestamp>.gif"),
    },
    async ({ steps, compileGif, frameDelay, loop, output }) => {
      try {
        if (compileGif && steps.length < 2) {
          throw new Error("compileGif requires at least 2 steps");
        }

        const outputDir = resolveOutputDirectory(config.outputDir, output);
        const renderConfig = compileGif ? { ...config, format: "png" as const } : config;
        const extension = renderConfig.format === "jpeg" ? "jpg" : "png";
        const results: { stepNumber?: number; label?: string; type: string; path: string }[] = [];

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const prefix = step.type;
          const p = createOutputPath(config.outputDir, outputDir, prefix, extension);

          switch (step.type) {
            case "terminal": {
              await captureTerminal(step.title || "step", step.lines, p, renderConfig);
              break;
            }
            case "code": {
              await captureCode(step.code, step.language, step.title || "step", p, renderConfig, step.startLine, step.endLine);
              break;
            }
            case "file": {
              await captureFile(step.filePath, p, renderConfig, step.startLine, step.endLine);
              break;
            }
            case "browser": {
              await captureBrowser(step.url, p, step.fullPage, step.width, step.height, renderConfig);
              break;
            }
            case "markdown": {
              await captureMarkdown(step.markdown, step.title || "step", p, renderConfig);
              break;
            }
            case "html": {
              await captureHtml(step.html, step.title || "step", p, renderConfig);
              break;
            }
            case "diff": {
              await captureDiff(step.diff, p, renderConfig);
              break;
            }
          }

          results.push({
            stepNumber: step.stepNumber ?? (i + 1),
            label: step.label,
            type: step.type,
            path: p,
          });
        }

        // Optionally compile into GIF
        let gifPath: string | undefined;
        if (compileGif && results.length >= 2) {
          gifPath = createOutputPath(config.outputDir, outputDir, "sequence", "gif");
          const frames: GifFrame[] = results.map((result) => ({
            filePath: result.path,
            delay: frameDelay,
          }));
          await createGif(frames, gifPath, { loop });
        }

        runCleanup(config);

        const summary = results.map(r =>
          `  ${r.label ? `[${r.label}] ` : ""}${r.stepNumber ? `Step ${r.stepNumber}: ` : ""}${r.type}: ${r.path}`
        ).join("\n");

        const gifNote = gifPath ? `\n  GIF compiled: ${gifPath}` : "";
        return ok(`✅ Sequence complete (${results.length} steps):\n${summary}${gifNote}`);
      } catch (e) {
        return fail(e);
      }
    },
  );
}