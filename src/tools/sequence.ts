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

export function registerSequenceTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.tool(
    "capture_sequence",
    "Capture each step of a process as individual files + optional compiled GIF.",
    {
      steps: z.array(z.object({
        type: z.enum(["terminal", "code", "file", "browser", "markdown", "diff", "html"]),
        params: z.record(z.string(), z.any()).describe("Parameters for the capture type"),
        stepNumber: z.number().int().min(1).optional().describe("Step number label"),
        label: z.string().optional().describe("Label for this step"),
      })).min(1).max(60),
      compileGif: z.boolean().default(false).describe("Compile frames into an animated GIF"),
      frameDelay: z.number().int().min(10).max(5000).default(800).describe("Frame delay in ms"),
      loop: z.boolean().default(true).describe("Whether the GIF loops"),
      output: z.string().optional().describe("Output directory (default: SNAPMCP_DIR)"),
    },
    async ({ steps, compileGif, frameDelay, loop, output }) => {
      try {
        const OUTPUT_DIR = config.outputDir;
        const results: { stepNumber?: number; label?: string; type: string; path: string }[] = [];
        
        for (const step of steps) {
          const prefix = step.type;
          const p = path.join(OUTPUT_DIR, `${prefix}-${Date.now()}.${config.format === "jpeg" ? "jpg" : "png"}`);
          
          switch (step.type) {
            case "terminal": {
              const { title, lines } = step.params as { title?: string; lines?: string[] };
              await captureTerminal(title || "step", lines || [], p, config);
              break;
            }
            case "code": {
              const { code, language, title } = step.params as { code?: string; language?: string; title?: string };
              await captureCode(code || "", language || "text", title || "step", p, config);
              break;
            }
            case "file": {
              const { filePath } = step.params as { filePath?: string };
              await captureFile(filePath || "", p, config);
              break;
            }
            case "browser": {
              const { url, fullPage, width, height } = step.params as { url?: string; fullPage?: boolean; width?: number; height?: number };
              await captureBrowser(url || "about:blank", p, fullPage || false, width || 1280, height || 800, config);
              break;
            }
            case "markdown": {
              const { markdown, title } = step.params as { markdown?: string; title?: string };
              await captureMarkdown(markdown || "", title || "step", p, config);
              break;
            }
            case "html": {
              const { html, title } = step.params as { html?: string; title?: string };
              await captureHtml(html || "", title || "step", p, config);
              break;
            }
            case "diff": {
              const { diff } = step.params as { diff?: string };
              await captureDiff(diff || "", p, config);
              break;
            }
          }
          
          results.push({ stepNumber: step.stepNumber, label: step.label, type: step.type, path: p });
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
