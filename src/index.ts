/**
 * snapmcp v2 — All-in-one MCP server for visual captures.
 *
 * Tools (8 total):
 *  capture_terminal  → synthetic terminal output       → PNG/JPEG
 *  capture_code      → syntax-highlighted code          → PNG/JPEG
 *  capture_browser   → URL screenshot                   → PNG/JPEG
 *  capture_file      → file → syntax highlighting       → PNG/JPEG
 *  capture_markdown  → rendered markdown document       → PNG/JPEG
 *  capture_html      → arbitrary HTML snippet           → PNG/JPEG
 *  capture_diff      → git diff colorization            → PNG/JPEG
 *  capture_pdf       → URL → PDF document
 *
 * Configuration via SNAPMCP_* env vars (see README or src/config.ts).
 *
 * Security features:
 *  - Path traversal prevention on all output filenames
 *  - Input size limits on all tools
 *  - File read validation (size, allowed paths)
 *  - Chromium sandbox detection at startup
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
import { resolveSafePath, checkChromiumSandbox } from "./security.js";
import { getHighlighter } from "./highlighter.js";

const VERSION = "2.1.0";

// ─── CLI helpers ─────────────────────────────────────────────
function showHelp(): void {
  console.error(`
  snapmcp v${VERSION} — All-in-one MCP server for visual captures

  USAGE
    snapmcp                    Start MCP server (stdio)
    snapmcp --help             Show this help
    snapmcp --version          Show version
    snapmcp --setup            Install Chromium + create output dir

  TOOLS (8)
    capture_terminal   Synthetic terminal output
    capture_code       Syntax-highlighted code (50+ langs, 27 themes)
    capture_browser    URL screenshots (full page or viewport)
    capture_file       File → auto-detected language → screenshot
    capture_markdown   Rendered markdown document
    capture_html       Arbitrary HTML snippet
    capture_diff       Git diffs with +/- colorization
    capture_pdf        URL → PDF document

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

  DOCS: https://github.com/erik/snapmcp
`);
}

function showVersion(): void {
  console.error(`snapmcp v${VERSION}`);
}

async function runSetup(): Promise<void> {
  const { execSync } = await import("node:child_process");
  const fs = await import("node:fs");
  const path = await import("node:path");

  console.error("\n  snapmcp — Setup\n");

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
  fs.mkdirSync(path.resolve(outDir), { recursive: true });
  console.error(`  ✓ Output directory: ${path.resolve(outDir)}`);

  console.error("\n  Ready! Run: snapmcp\n");
}

// ─── Banner ─────────────────────────────────────────────────
const BANNER = `
  ┌────────────────────────────────┬
  │  snapmcp v2.1  —  8 tools     │
  │  27 themes · GLASS terminal   │
  │  PNG / JPEG / PDF             │
  └────────────────────────────────┘
`;

// ─── Configuration ─────────────────────────────────────────
const config = loadConfig();
const OUTPUT_DIR = path.resolve(config.outputDir);
ensureOutputDir(OUTPUT_DIR);

// ─── Server setup ─────────────────────────────────────────
const server = new McpServer({
  name: "snapmcp",
  version: "2.1.0",
  description:
    "All-in-one visual captures: terminal, code, browser, markdown, HTML, diffs, files, and PDF — via Playwright",
});

// ─── Helpers ────────────────────────────────────────────────
const ext = () => formatExt(config.format);

function outPath(prefix: string, name?: string): string {
  if (name) {
    // Security: prevent path traversal in user-provided filenames
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

// ─── Tool 2: Code ───────────────────────────────────────────
server.tool(
  "capture_code",
  "Generate a syntax-highlighted code screenshot using Shiki (50+ languages).",
  {
    code: z.string().min(1).describe("Source code to render"),
    language: z.string().default("text").describe("Programming language for highlighting"),
    title: z.string().default("code").describe("Window title"),
    output: z.string().optional().describe("Output filename (default: auto-generated)"),
  },
  async ({ code, language, title, output }) => {
    try {
      const p = outPath("code", output);
      await captureCode(code, language, title, p, config);
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
      const p = outPath("browser", output);
      await captureBrowser(url, p, fullPage, width, height, config);
      return ok(p);
    } catch (e) {
      return fail(e);
    }
  },
);

// ─── Tool 4: File ───────────────────────────────────────────
server.tool(
  "capture_file",
  "Read a file and generate a syntax-highlighted screenshot based on its extension.",
  {
    filePath: z.string().min(1).describe("Absolute path to the file to capture"),
    output: z.string().optional().describe("Output filename (default: auto-generated)"),
  },
  async ({ filePath: fp, output }) => {
    try {
      const p = outPath("file", output);
      await captureFile(fp, p, config);
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
      const filename = output || `pdf-${Date.now()}.pdf`;
      const p = resolveSafePath(OUTPUT_DIR, filename);
      await capturePdf(url, p, fullPage, width, height, config);
      return ok(p);
    } catch (e) {
      return fail(e);
    }
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

  // Security checks at startup
  if (config.securityChecks) {
    const sandboxStatus = checkChromiumSandbox();
    if (!sandboxStatus.sandboxEnabled) {
      console.error(sandboxStatus.message);
    }
  }

  // Pre-warm the Shiki highlighter (loads WASM and grammars)
  try {
    await getHighlighter();
  } catch (err) {
    console.error("⚠️  Failed to pre-warm syntax highlighter:", err);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`${BANNER}`);
  console.error(`  Mode:     stdio`);
  console.error(`  Format:   ${config.format}${config.format === "jpeg" ? ` (q${config.quality})` : ""}`);
  console.error(`  Output:   ${OUTPUT_DIR}`);
  console.error(`  Theme:    ${config.theme}`);
  console.error(`  Chrome:   ${config.windowChrome ? "on" : "off"} · Shadow: ${config.shadow} · Radius: ${config.borderRadius}px`);
  console.error(`  Security: ${config.securityChecks ? "enabled" : "disabled"}`);

  process.on("SIGINT", async () => {
    await closeBrowser();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await closeBrowser();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
