import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  captureTerminal, captureCode, captureFile,
  captureBrowser, captureMarkdown, captureHtml, captureDiff
} from "../renderer.js";
import { createGif, type GifFrame } from "../gif.js";
import { runCleanup } from "../renderer.js";
import path from "path";

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
  lines: z.array(z.string()).min(1).max(1000).describe("Lines to render. Prefix with '$ ' for prompts."),
  ...StepCommon,
});

const CodeParams = z.object({
  type: z.literal("code"),
  code: z.string().min(1).max(200_000).describe("Source code to render"),
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
  width: z.number().int().min(320).max(3840).default(1280).describe("Viewport width (px)"),
  height: z.number().int().min(240).max(4096).default(800).describe("Viewport height (px)"),
  ...StepCommon,
});

const MarkdownParams = z.object({
  type: z.literal("markdown"),
  markdown: z.string().min(1).max(200_000).describe("Markdown content (GFM supported)"),
  title: z.string().max(100).optional().describe("Document title (default: 'step')"),
  ...StepCommon,
});

const HtmlParams = z.object({
  type: z.literal("html"),
  html: z.string().min(1).max(200_000).describe("HTML content (external resources blocked)"),
  title: z.string().max(100).optional().describe("Description for logging (default: 'step')"),
  ...StepCommon,
});

const DiffParams = z.object({
  type: z.literal("diff"),
  diff: z.string().min(1).max(500_000).describe("Unified diff content (git diff format)"),
  ...StepCommon,
});

const StepSchema = z.discriminatedUnion("type", [
  TerminalParams, CodeParams, FileParams, BrowserParams,
  MarkdownParams, HtmlParams, DiffParams,
]);

export function registerSequenceTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.tool(
    "capture_sequence",
    "Capture each step of a process as individual image files + optional compiled GIF. Each step has full type-specific parameters plus stepNumber and label for documentation. Use for CI/CD pipeline visualization, deployment steps, tutorial sequences. Maximum 60 steps.",
    {
      steps: z.array(StepSchema).min(1).max(60).describe("Array of steps to capture. Each step specifies its capture type, type-specific parameters, plus optional stepNumber and label."),
      compileGif: z.boolean().default(false).describe("Compile frames into an animated GIF (requires at least 2 steps)"),
      frameDelay: z.number().int().min(10).max(5000).default(800).describe("Frame delay in milliseconds for GIF (10-5000). Default 800ms."),
      loop: z.boolean().default(true).describe("Whether the GIF loops infinitely"),
      output: z.string().optional().describe("Output directory (default: SNAPMCP_DIR). Steps saved as individual files, GIF as sequence-<timestamp>.gif"),
    },
    async ({ steps, compileGif, frameDelay, loop, output }) => {
      try {
        const OUTPUT_DIR = output ? path.resolve(config.outputDir, output) : config.outputDir;
        const results: { stepNumber?: number; label?: string; type: string; path: string }[] = [];

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const prefix = step.type;
          const p = path.join(OUTPUT_DIR, `${prefix}-${Date.now()}.${config.format === "jpeg" ? "jpg" : "png"}`);

          switch (step.type) {
            case "terminal": {
              await captureTerminal(step.title || "step", step.lines, p, config);
              break;
            }
            case "code": {
              await captureCode(step.code, step.language, step.title || "step", p, config, step.startLine, step.endLine);
              break;
            }
            case "file": {
              await captureFile(step.filePath, p, config, step.startLine, step.endLine);
              break;
            }
            case "browser": {
              await captureBrowser(step.url, p, step.fullPage, step.width, step.height, config);
              break;
            }
            case "markdown": {
              await captureMarkdown(step.markdown, step.title || "step", p, config);
              break;
            }
            case "html": {
              await captureHtml(step.html, step.title || "step", p, config);
              break;
            }
            case "diff": {
              await captureDiff(step.diff, p, config);
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
          gifPath = path.join(OUTPUT_DIR, `sequence-${Date.now()}.gif`);
          const frames: GifFrame[] = results.map(r => ({
            filePath: r.path,
            delay: Math.round(frameDelay / 10),
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