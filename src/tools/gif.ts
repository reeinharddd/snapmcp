import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
  captureTerminal, captureCode, captureFile, 
  captureBrowser, captureMarkdown, captureHtml, captureDiff 
} from "../renderer.js";
import { createGif, type GifFrame } from "../gif.js"
import { resolveSafePath } from "../security.js";
import { runCleanup } from "../renderer.js";
import path from "path";

interface ToolDeps {
  outPath: (prefix: string, name?: string) => string;
  ok: (path: string) => { content: { type: "text"; text: string }[] };
  fail: (err: unknown) => { content: { type: "text"; text: string }[]; isError: boolean };
  config: import("../config.js").SnapConfig;
}

export function registerGifTool(server: McpServer, { outPath, ok, fail, config }: ToolDeps): void {
  server.tool(
    "capture_gif",
    "Create an animated GIF from sequential captures.",
    {
      title: z.string().default("animation").describe("Name for the GIF"),
      captures: z.array(z.object({
        type: z.enum(["terminal", "code", "file", "browser", "markdown", "diff", "html"]),
        params: z.record(z.string(), z.any()).describe("Parameters for the capture type"),
        label: z.string().optional().describe("Optional label for the capture"),
      })).min(2).max(60),
      frameDelay: z.number().int().min(10).max(5000).default(800).describe("Frame delay in ms"),
      loop: z.boolean().default(true).describe("Whether the GIF loops"),
      output: z.string().optional().describe("Output filename for the GIF"),
    },
    async ({ title, captures, frameDelay, loop, output }) => {
      try {
        // Capture each frame
        const framePaths: string[] = [];
        for (const cap of captures) {
          const prefix = cap.type;
          const p = path.join(config.outputDir, `${prefix}-${Date.now()}.${config.format === "jpeg" ? "jpg" : "png"}`);
          
          switch (cap.type) {
            case "terminal": {
              const { title, lines } = cap.params as { title?: string; lines?: string[] };
              await captureTerminal(title || "frame", lines || [], p, config);
              break;
            }
            case "code": {
              const { code, language, title } = cap.params as { code?: string; language?: string; title?: string };
              await captureCode(code || "", language || "text", title || "frame", p, config);
              break;
            }
            case "file": {
              const { filePath } = cap.params as { filePath?: string };
              await captureFile(filePath || "", p, config);
              break;
            }
            case "browser": {
              const { url, fullPage, width, height } = cap.params as { url?: string; fullPage?: boolean; width?: number; height?: number };
              await captureBrowser(url || "about:blank", p, fullPage || false, width || 1280, height || 800, config);
              break;
            }
            case "markdown": {
              const { markdown, title } = cap.params as { markdown?: string; title?: string };
              await captureMarkdown(markdown || "", title || "frame", p, config);
              break;
            }
            case "html": {
              const { html, title } = cap.params as { html?: string; title?: string };
              await captureHtml(html || "", title || "frame", p, config);
              break;
            }
            case "diff": {
              const { diff } = cap.params as { diff?: string };
              await captureDiff(diff || "", p, config);
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
          delay: Math.round(frameDelay / 10),
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
