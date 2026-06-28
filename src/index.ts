/**
 * snapmcp v2 — All-in-one MCP server for visual captures.
 *
 * Tools (12 total):
 *  capture_terminal      → synthetic terminal output           → PNG/JPEG
 *  capture_code          → syntax-highlighted code              → PNG/JPEG
 *  capture_browser       → URL screenshot                       → PNG/JPEG
 *  capture_file          → file → syntax highlighting           → PNG/JPEG
 *  capture_markdown      → rendered markdown document           → PNG/JPEG
 *  capture_html          → arbitrary HTML snippet               → PNG/JPEG
 *  capture_diff          → git diff colorization                → PNG/JPEG
 *  capture_pdf           → URL → PDF document
 *  capture_batch         → multi-capture batch                  → PNG/JPEG
 *  capture_sequence      → step-by-step sequence + GIF          → PNG/GIF
 *  capture_gif           → animated GIF from captures           → GIF
 *  capture_to_document   → document with embedded captures      → MD/HTML/PDF
 *
 * CLI commands:
 *  snapmcp init          → interactive setup wizard
 *  snapmcp doctor        → system diagnostics
 *  snapmcp test          → test capture verification
 *
 * Configuration via SNAPMCP_* env vars (see README or src/config.ts).
 *
 * Security features:
 *  - Path traversal prevention on all output filenames
 *  - Input size limits on all tools
 *  - File read validation (size, allowed paths)
 *  - Chromium sandbox detection at startup
 *  - SSRF protection on URL-based tools
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "path";
import { loadConfig, formatExt } from "./config.js";
import {
  captureTerminal,
  captureCode,
  captureBrowser,
  captureFile,
  captureMarkdown,
  captureHtml,
  captureDiff,
  capturePdf,
  closeBrowser,
  ensureOutputDir,
  runCleanup,
} from "./renderer.js";
import { resolveSafePath, checkChromiumSandbox, validateUrl, SecurityError } from "./security.js";
import { getHighlighter } from "./highlighter.js";
import { logger, setLogLevel, AuditEventType, closeAuditLog } from "./logger.js";
import { createGif, type GifFrame } from "./gif.js";
import { createDocument, type DocumentSection, type DocumentFormat } from "./document.js";
import { cliInit, cliDoctor, cliTest } from "./cli.js";
import { BRAND, brandPrimary, brandSecondary, brandGradient } from "./brand.js";
import { detectChrome, logChromeStatus, type DetectedChrome } from "./browser.js";

const VERSION = "2.2.0";

// ─── Param interfaces (replace as any) ─────────────────────
interface TerminalCaptureParams { title?: string; lines?: string[]; }
interface CodeCaptureParams { code?: string; language?: string; title?: string; }
interface BrowserCaptureParams { url?: string; fullPage?: boolean; width?: number; height?: number; }
interface FileCaptureParams { filePath?: string; }
interface MarkdownCaptureParams { markdown?: string; title?: string; }
interface HtmlCaptureParams { html?: string; title?: string; }
interface DiffCaptureParams { diff?: string; }

// ─── CLI helpers ─────────────────────────────────────────────
function showHelp(): void {
  console.error(`
  ╔═══════════════════════════════════════════╗
  ║  ⬡ snapmcp v${VERSION}                     ║
  ║  Precision captures for AI agents         ║
  ╚═══════════════════════════════════════════╝

  USAGE
    snapmcp                    Start MCP server (stdio)
    snapmcp --help             Show this help
    snapmcp --version          Show version
    snapmcp --setup            Install Chromium + create output dir
    snapmcp init               Interactive setup wizard
    snapmcp doctor             System diagnostics
    snapmcp test               Run test capture

  TOOLS (12)
    capture_terminal     Synthetic terminal output (27 themes)
    capture_code         Syntax-highlighted code (50+ langs)
    capture_browser      URL screenshots (full page or viewport)
    capture_file         File → auto-detected language → screenshot
    capture_markdown     Rendered markdown document
    capture_html         Arbitrary HTML snippet
    capture_diff         Git diffs with +/- colorization
    capture_pdf          URL → PDF document
    capture_batch        Multi-capture batch (up to 10)
    capture_sequence     Step-by-step sequence + optional GIF
    capture_gif          Animated GIF from 2-60 captures
    capture_to_document  Document (MD/HTML/PDF) with embedded captures

  CLI
    init                 Interactive setup wizard
    doctor               System diagnostics
    test                 Run test capture (verifies everything works)

  CONFIG (env vars)
    SNAPMCP_DIR              Output directory (default: ./snapshots)
    SNAPMCP_FORMAT           png | jpeg
    SNAPMCP_QUALITY          JPEG quality 1-100
    SNAPMCP_THEME            27 themes: dark-plus, dracula, nord, catppuccin-mocha, tokyo-night...
    SNAPMCP_PADDING          Inner padding px (default: 32)
    SNAPMCP_SHADOW           none | soft | medium | strong
    SNAPMCP_WINDOW_CHROME    true/false — macOS traffic lights
    SNAPMCP_BORDER_RADIUS    0-32 px
    SNAPMCP_BADGE            true/false — snapmcp footer badge
    SNAPMCP_SECURITY_CHECKS  true/false — path traversal, size limits, etc.

  EXAMPLES
    SNAPMCP_THEME=dracula SNAPMCP_FORMAT=jpeg snapmcp
    SNAPMCP_WINDOW_CHROME=false SNAPMCP_SHADOW=strong snapmcp

  DOCS: https://github.com/reeinharddd/snapmcp
`);
}

function showVersion(): void {
  console.error(`⬡ snapmcp v${VERSION}`);
}

async function runSetup(): Promise<void> {
  const { execSync } = await import("node:child_process");
  const fs = await import("node:fs");
  const pt = await import("node:path");

  console.error("\n  ⬡ snapmcp — Setup\n");

  // Install Chromium
  console.error("  → Installing Chromium...");
  try {
    execSync("bunx playwright install chromium", { stdio: "inherit", timeout: 120_000 });
    console.error("  ✓ Chromium installed");
  } catch {
    console.error("  ✗ Chromium install failed. Try: npx playwright install chromium");
  }

  // Create output dir
  const outDir = process.env.SNAPMCP_DIR || "./snapshots";
  fs.mkdirSync(pt.resolve(outDir), { recursive: true });
  console.error(`  ✓ Output directory: ${pt.resolve(outDir)}`);

  console.error("\n  Ready! Run: snapmcp\n");
}

// ─── Banner ─────────────────────────────────────────────────
const BANNER = `
  ┌──────────────────────────────────┬
  │  ⬡ snapmcp v2.2  —  12 tools  │
  │  27 themes · GIF · Documents   │
  │  PNG / JPEG / PDF / GIF / MD   │
  │  precision captures for AI      │
  └──────────────────────────────────┘
`;

// ─── ANSI helpers for brand-colored output ─────────────────
const ansiPri = (t: string) => `\x1b[38;2;0;212;170m${t}\x1b[0m`;
const ansiSec = (t: string) => `\x1b[38;2;0;153;255m${t}\x1b[0m`;
const ansiBold = (t: string) => `\x1b[1m${t}\x1b[0m`;

// ─── Configuration ─────────────────────────────────────────
const config = loadConfig();
setLogLevel(config.logLevel as import("./logger.js").LogLevel);
const OUTPUT_DIR = path.resolve(config.outputDir);
ensureOutputDir(OUTPUT_DIR);

// Chrome status at startup
const chromeDetected = detectChrome();
logChromeStatus(chromeDetected);

// ─── Server setup ─────────────────────────────────────────
const server = new McpServer({
  name: "SnapMCP",
  version: "2.2.0",
  description:
    "All-in-one visual captures: terminal, code, browser, markdown, HTML, diffs, files, and PDF — via Playwright",
});

// ─── Helpers ────────────────────────────────────────────────
const ext = () => formatExt(config.format);

function outPath(prefix: string, name?: string): string {
  if (name) {
    return resolveSafePath(OUTPUT_DIR, name);
  }
  return path.join(OUTPUT_DIR, `${prefix}-${Date.now()}.${ext()}`);
}

function ok(path: string): { content: { type: "text"; text: string }[] } {
  runCleanup(config);
  return { content: [{ type: "text", text: `✅ Saved: ${path}` }] };
}

function fail(err: unknown): {
  content: { type: "text"; text: string }[];
  isError: boolean;
} {
  const msg = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text", text: `❌ ${msg}` }], isError: true };
}

// ─── Tool 1: Terminal ──────────────────────────────────────
server.tool(
  "capture_terminal",
  "Generate a styled terminal screenshot from text lines. Prefix with '$ ' for command prompts.",
  {
    title: z.string().min(1).describe("Window title shown in the terminal title bar"),
    lines: z
      .array(z.string())
      .min(1)
      .describe("Lines to render. '$ ' prefix = command prompt, others = output"),
    output: z.string().optional().describe("Output filename (default: auto-generated)"),
  },
  async ({ title, lines, output }) => {
    try {
      const p = outPath("terminal", output);
      await captureTerminal(title, lines, p, config);
      return ok(p);
    } catch (e) {
      return fail(e);
    }
  },
);

// ─── Tool 2: Code ── with line range support ────────────────
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

// ─── Tool 3: Browser ────────────────────────────────────────
server.tool(
  "capture_browser",
  "Take a screenshot of a URL using headless Chromium.",
  {
    url: z.string().url().describe("URL to capture"),
    fullPage: z.boolean().default(false).describe("Capture full scrollable page"),
    width: z.number().int().min(320).max(3840).default(1280).describe("Viewport width (px)"),
    height: z.number().int().min(240).max(4096).default(800).describe("Viewport height (px)"),
    output: z.string().optional().describe("Output filename (default: auto-generated)"),
  },
  async ({ url, fullPage, width, height, output }) => {
    try {
      validateUrl(url);
      const p = outPath("browser", output);
      await captureBrowser(url, p, fullPage, width, height, config);
      logger.audit({ event: AuditEventType.CaptureBrowser, severity: "info", detail: `URL: ${url}`, source: "capture_browser" });
      return ok(p);
    } catch (e) {
      return fail(e);
    }
  },
);

// ─── Tool 4: File ── with line range support ────────────────
server.tool(
  "capture_file",
  "Read a file and generate a syntax-highlighted screenshot based on its extension.",
  {
    filePath: z.string().min(1).describe("Absolute path to the file to capture"),
    startLine: z.number().int().min(1).optional().describe("First line number to capture (1-indexed, inclusive)"),
    endLine: z.number().int().min(1).optional().describe("Last line number to capture (1-indexed, inclusive)"),
    output: z.string().optional().describe("Output filename (default: auto-generated)"),
  },
  async ({ filePath: fp, startLine, endLine, output }) => {
    try {
      const p = outPath("file", output);
      await captureFile(fp, p, config, startLine, endLine);
      return ok(p);
    } catch (e) {
      return fail(e);
    }
  },
);

// ─── Tool 5: Markdown ───────────────────────────────────────
server.tool(
  "capture_markdown",
  "Render Markdown as a styled document screenshot.",
  {
    markdown: z.string().min(1).describe("Markdown content to render"),
    title: z.string().default("document").describe("Document title"),
    output: z.string().optional().describe("Output filename (default: auto-generated)"),
  },
  async ({ markdown, title, output }) => {
    try {
      const p = outPath("markdown", output);
      await captureMarkdown(markdown, title, p, config);
      return ok(p);
    } catch (e) {
      return fail(e);
    }
  },
);

// ─── Tool 6: HTML ───────────────────────────────────────────
server.tool(
  "capture_html",
  "Render arbitrary HTML as a screenshot.",
  {
    html: z.string().min(1).describe("HTML content to render"),
    title: z.string().default("html").describe("Description (for logging)"),
    output: z.string().optional().describe("Output filename (default: auto-generated)"),
  },
  async ({ html, title, output }) => {
    try {
      const p = outPath("html", output);
      await captureHtml(html, title, p, config);
      return ok(p);
    } catch (e) {
      return fail(e);
    }
  },
);

// ─── Tool 7: Diff ───────────────────────────────────────────
server.tool(
  "capture_diff",
  "Render a git diff with color-coded additions and deletions.",
  {
    diff: z.string().min(1).describe("Diff content (git diff / unified diff format)"),
    output: z.string().optional().describe("Output filename (default: auto-generated)"),
  },
  async ({ diff, output }) => {
    try {
      const p = outPath("diff", output);
      await captureDiff(diff, p, config);
      return ok(p);
    } catch (e) {
      return fail(e);
    }
  },
);

// ─── Tool 8: PDF ────────────────────────────────────────────
server.tool(
  "capture_pdf",
  "Convert a URL to a PDF document using headless Chromium.",
  {
    url: z.string().url().describe("URL to convert to PDF"),
    fullPage: z.boolean().default(true).describe("Include all content"),
    width: z.number().int().min(320).max(3840).default(1280).describe("Viewport width"),
    height: z.number().int().min(240).max(4096).default(800).describe("Viewport height"),
    output: z.string().optional().describe("Output filename (default: auto-generated)"),
  },
  async ({ url, fullPage, width, height, output }) => {
    try {
      validateUrl(url);
      const filename = output || `pdf-${Date.now()}.pdf`;
      const p = resolveSafePath(OUTPUT_DIR, filename);
      await capturePdf(url, p, fullPage, width, height, config);
      logger.audit({ event: AuditEventType.CapturePdf, severity: "info", detail: `URL: ${url}`, source: "capture_pdf" });
      return ok(p);
    } catch (e) {
      return fail(e);
    }
  },
);

// ─── Tool 9: Batch ──────────────────────────────────────────
server.tool(
  "capture_batch",
  "Capture multiple items in a single call. Each capture is processed sequentially.",
  {
    captures: z.array(z.object({
      type: z.enum(["terminal", "code", "file", "browser", "markdown", "html", "diff"]),
      params: z.record(z.string(), z.any()).describe("Parameters for the capture type"),
      caption: z.string().optional().describe("Optional caption/label for the capture"),
    })).min(1).max(10),
    output: z.string().optional().describe("Output directory (default: SNAPMCP_DIR)"),
  },
  async ({ captures, output }) => {
    try {
      const results: { type: string; path: string; caption?: string }[] = [];

      for (const cap of captures) {
        const prefix = cap.type;
        const p = path.join(OUTPUT_DIR, `${prefix}-${Date.now()}.${ext()}`);

        switch (cap.type) {
          case "terminal": {
            const { title, lines } = cap.params as TerminalCaptureParams;
            await captureTerminal(title || "terminal", lines || [], p, config);
            break;
          }
          case "code": {
            const { code, language, title } = cap.params as CodeCaptureParams;
            await captureCode(code || "", language || "text", title || "code", p, config);
            break;
          }
          case "file": {
            const { filePath } = cap.params as FileCaptureParams;
            await captureFile(filePath || "", p, config);
            break;
          }
          case "browser": {
            const { url, fullPage, width, height } = cap.params as BrowserCaptureParams;
            await captureBrowser(url || "about:blank", p, fullPage || false, width || 1280, height || 800, config);
            break;
          }
          case "markdown": {
            const { markdown, title } = cap.params as MarkdownCaptureParams;
            await captureMarkdown(markdown || "", title || "document", p, config);
            break;
          }
          case "html": {
            const { html, title } = cap.params as HtmlCaptureParams;
            await captureHtml(html || "", title || "html", p, config);
            break;
          }
          case "diff": {
            const { diff } = cap.params as DiffCaptureParams;
            await captureDiff(diff || "", p, config);
            break;
          }
        }

        results.push({ type: cap.type, path: p, caption: cap.caption });
      }

      runCleanup(config);

      const summary = results.map(r =>
        `  ${r.caption ? `[${r.caption}] ` : ""}${r.type}: ${r.path}`
      ).join("\n");

      return { content: [{ type: "text", text: `✅ Batch complete (${results.length} captures):\n${summary}` }] };
    } catch (e) {
      return fail(e);
    }
  },
);

// ─── Tool 10: Sequence ──────────────────────────────────────
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
      const results: { stepNumber?: number; label?: string; type: string; path: string }[] = [];

      for (const step of steps) {
        const prefix = step.type;
        const p = path.join(OUTPUT_DIR, `${prefix}-${Date.now()}.${ext()}`);

        switch (step.type) {
          case "terminal": {
            const { title, lines } = step.params as TerminalCaptureParams;
            await captureTerminal(title || "step", lines || [], p, config);
            break;
          }
          case "code": {
            const { code, language, title } = step.params as CodeCaptureParams;
            await captureCode(code || "", language || "text", title || "step", p, config);
            break;
          }
          case "file": {
            const { filePath } = step.params as FileCaptureParams;
            await captureFile(filePath || "", p, config);
            break;
          }
          case "browser": {
            const { url, fullPage, width, height } = step.params as BrowserCaptureParams;
            await captureBrowser(url || "about:blank", p, fullPage || false, width || 1280, height || 800, config);
            break;
          }
          case "markdown": {
            const { markdown, title } = step.params as MarkdownCaptureParams;
            await captureMarkdown(markdown || "", title || "step", p, config);
            break;
          }
          case "html": {
            const { html, title } = step.params as HtmlCaptureParams;
            await captureHtml(html || "", title || "step", p, config);
            break;
          }
          case "diff": {
            const { diff } = step.params as DiffCaptureParams;
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
          delay: Math.round(frameDelay / 10), // ms → centiseconds
        }));
        await createGif(frames, gifPath);
      }

      runCleanup(config);

      const summary = results.map(r =>
        `  ${r.label ? `[${r.label}] ` : ""}${r.stepNumber ? `Step ${r.stepNumber}: ` : ""}${r.type}: ${r.path}`
      ).join("\n");

      const gifNote = gifPath ? `\n  GIF compiled: ${gifPath}` : "";
      return { content: [{ type: "text", text: `✅ Sequence complete (${results.length} steps):\n${summary}${gifNote}` }] };
    } catch (e) {
      return fail(e);
    }
  },
);

// ─── Tool 11: GIF ────────────────────────────────────────────
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
        const p = path.join(OUTPUT_DIR, `${prefix}-${Date.now()}.${ext()}`);

        switch (cap.type) {
          case "terminal": {
            const { title: t, lines } = cap.params as TerminalCaptureParams;
            await captureTerminal(t || "frame", lines || [], p, config);
            break;
          }
          case "code": {
            const { code, language, title: t } = cap.params as CodeCaptureParams;
            await captureCode(code || "", language || "text", t || "frame", p, config);
            break;
          }
          case "file": {
            const { filePath } = cap.params as FileCaptureParams;
            await captureFile(filePath || "", p, config);
            break;
          }
          case "browser": {
            const { url, fullPage, width, height } = cap.params as BrowserCaptureParams;
            await captureBrowser(url || "about:blank", p, fullPage || false, width || 1280, height || 800, config);
            break;
          }
          case "markdown": {
            const { markdown, title: t } = cap.params as MarkdownCaptureParams;
            await captureMarkdown(markdown || "", t || "frame", p, config);
            break;
          }
          case "html": {
            const { html, title: t } = cap.params as HtmlCaptureParams;
            await captureHtml(html || "", t || "frame", p, config);
            break;
          }
          case "diff": {
            const { diff } = cap.params as DiffCaptureParams;
            await captureDiff(diff || "", p, config);
            break;
          }
        }
        framePaths.push(p);
      }

      // Compile into GIF
      const gifOutput = output
        ? resolveSafePath(OUTPUT_DIR, output)
        : path.join(OUTPUT_DIR, `${title}-${Date.now()}.gif`);

      const frames: GifFrame[] = framePaths.map(fp => ({
        filePath: fp,
        delay: Math.round(frameDelay / 10), // ms → centiseconds
      }));
      const result = await createGif(frames, gifOutput, { loop });

      runCleanup(config);
      return ok(result);
    } catch (e) {
      return fail(e);
    }
  },
);

// ─── Tool 12: Document ───────────────────────────────────────
server.tool(
  "capture_to_document",
  "Create a document (Markdown/HTML/PDF) with embedded step-by-step captures.",
  {
    title: z.string().min(1).describe("Document title"),
    captures: z.array(z.object({
      type: z.enum(["terminal", "code", "file", "browser", "markdown", "html", "diff"]),
      params: z.record(z.string(), z.any()).describe("Parameters for the capture type"),
      caption: z.string().optional().describe("Caption for this capture"),
    })).min(1).max(30),
    format: z.enum(["markdown", "html", "pdf"]).default("markdown").describe("Output document format"),
    includeTimestamps: z.boolean().default(false).describe("Include timestamps in document"),
    output: z.string().optional().describe("Output filename (default: auto-generated)"),
  },
  async ({ title, captures, format, includeTimestamps, output }) => {
    try {
      // First capture all steps as images
      const capturedPaths: { imagePath: string; caption?: string }[] = [];

      for (const cap of captures) {
        const prefix = cap.type;
        const p = path.join(OUTPUT_DIR, `${prefix}-${Date.now()}.${ext()}`);

        switch (cap.type) {
          case "terminal": {
            const { title: t, lines } = cap.params as TerminalCaptureParams;
            await captureTerminal(t || "step", lines || [], p, config);
            break;
          }
          case "code": {
            const { code, language, title: t } = cap.params as CodeCaptureParams;
            await captureCode(code || "", language || "text", t || "step", p, config);
            break;
          }
          case "file": {
            const { filePath } = cap.params as FileCaptureParams;
            await captureFile(filePath || "", p, config);
            break;
          }
          case "browser": {
            const { url, fullPage, width, height } = cap.params as BrowserCaptureParams;
            await captureBrowser(url || "about:blank", p, fullPage || false, width || 1280, height || 800, config);
            break;
          }
          case "markdown": {
            const { markdown, title: t } = cap.params as MarkdownCaptureParams;
            await captureMarkdown(markdown || "", t || "step", p, config);
            break;
          }
          case "html": {
            const { html, title: t } = cap.params as HtmlCaptureParams;
            await captureHtml(html || "", t || "step", p, config);
            break;
          }
          case "diff": {
            const { diff } = cap.params as DiffCaptureParams;
            await captureDiff(diff || "", p, config);
            break;
          }
        }
        capturedPaths.push({ imagePath: p, caption: cap.caption });
      }

      // Build document sections from captured images
      const sections: DocumentSection[] = capturedPaths.map(cp => ({
        imagePath: cp.imagePath,
        caption: cp.caption,
      }));

      const docExt = format === "markdown" ? "md" : format === "html" ? "html" : "pdf";
      const docOutput = output
        ? resolveSafePath(OUTPUT_DIR, output)
        : path.join(OUTPUT_DIR, `document-${Date.now()}.${docExt}`);

      await createDocument(
        { title, sections, format: format as DocumentFormat, includeTimestamps, outputPath: docOutput },
        config,
      );

      runCleanup(config);
      return { content: [{ type: "text", text: `✅ Document saved: ${docOutput} (${captures.length} captures, ${format})` }] };
    } catch (e) {
      return fail(e);
    }
  },
);

// ─── Tool 13: Hint ───────────────────────────────────────────
server.tool(
  "snapmcp-hint",
  "Return a helpful hint about configuring and using snapmcp.",
  {
    topic: z.string().optional().describe("Optional topic: init, doctor, browser, themes, output"),
  },
  async ({ topic }) => {
    const hints: Record<string, string> = {
      init: "Run `snapmcp init` to configure output directory, theme, and browser profile interactively.",
      doctor: "Run `snapmcp doctor` to diagnose your system setup and verify all dependencies.",
      browser: "Set SNAPMCP_CHROME_EXECUTABLE to your Chrome/Chromium path to use your real browser profile for captures.",
      themes: "Set SNAPMCP_THEME to one of 27 themes: dracula, nord, catppuccin-mocha, tokyo-night, and more.",
      output: "Set SNAPMCP_DIR to control where captures are saved (default: ./snapshots).",
    };

    const generic = "Need help configuring snapmcp? Run `snapmcp init` to set up your output directory, terminal theme, and browser profile interactively.";
    const text = topic && hints[topic] ? hints[topic] : generic;

    return { content: [{ type: "text", text }] };
  },
);

// ─── Startup ────────────────────────────────────────────────
async function main() {
  // CLI argument handling (before MCP server starts)
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    process.exit(0);
  }
  if (args.includes("--version") || args.includes("-v")) {
    showVersion();
    process.exit(0);
  }
  if (args.includes("--setup")) {
    await runSetup();
    process.exit(0);
  }

  // CLI commands (non-MCP mode)
  if (args.includes("init")) {
    await cliInit(config);
    process.exit(0);
  }
  if (args.includes("doctor")) {
    const result = await cliDoctor(config);
    process.exit(result.status === "ok" ? 0 : 1);
  }
  if (args.includes("test")) {
    await cliTest(config);
    process.exit(0);
  }

  // Security checks at startup
  if (config.securityChecks) {
    const sandboxStatus = checkChromiumSandbox();
    if (!sandboxStatus.sandboxEnabled) {
      logger.warn(sandboxStatus.message);
    }
  }

  // Pre-warm the Shiki highlighter (loads WASM and grammars)
  try {
    logger.info("Pre-warming syntax highlighter...");
    await getHighlighter();
  } catch (err) {
    logger.warn("Failed to pre-warm syntax highlighter:", err);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Brand-colored startup banner
  if (BRAND.ascii) {
    console.error(ansiBold(BRAND.ascii));
  } else {
    console.error(ansiBold(BANNER));
  }
  const toolList = ["capture_terminal", "capture_code", "capture_browser", "capture_file", "capture_markdown", "capture_html", "capture_diff", "capture_pdf", "capture_batch", "capture_sequence", "capture_gif", "capture_to_document"];
  console.error(ansiPri(`  v${VERSION}`));
  console.error(ansiSec(`  ${toolList.join(" · ")}`));
  logger.info(`  Mode:     stdio`);
  logger.info(`  Format:   ${config.format}${config.format === "jpeg" ? ` (q${config.quality})` : ""}`);
  logger.info(`  Output:   ${OUTPUT_DIR}`);
  logger.info(`  Theme:    ${config.theme}`);
  logger.info(`  GIF:      gifencoder + pngjs · Documents: MD/HTML/PDF`);
  logger.info(`  Chrome:   ${config.windowChrome ? "on" : "off"} · Shadow: ${config.shadow} · Radius: ${config.borderRadius}px`);
  logger.info(`  Security: ${config.securityChecks ? "enabled" : "disabled"}`);
  logger.debug(`  Padding:  ${config.padding}px · Badge: ${config.badge} · Font: ${config.fontSize}`);

  process.on("SIGINT", async () => {
    await closeBrowser();
    closeAuditLog();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await closeBrowser();
    closeAuditLog();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error("FATAL:", err);
  process.exit(1);
});
