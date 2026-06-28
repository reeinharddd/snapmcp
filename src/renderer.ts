/**
 * snapmcp renderer — HTML templates + Playwright screenshot engine.
 *
 * All capture types funnel through here: build HTML → screenshot with Playwright.
 * Security checks applied before rendering.
 *
 * Templates:
 *  - framedTemplate    → glass window frame + title bar + body (terminal, code, diff)
 *  - documentTemplate  → clean document wrapper (markdown)
 *  - rawHtmlTemplate   → minimal wrapper for raw HTML snippets
 *
 * New visual options:
 *  - Window chrome (macOS traffic lights) — configurable
 *  - Glassmorphism title bar (blur + gradient)
 *  - Drop-shadow levels (none/soft/medium/strong)
 *  - Border radius, padding, badge footer
 */

import playwright from "playwright";
import { marked } from "marked";
import path from "path";
import fs from "fs";
import type { SnapConfig } from "./config.js";
import {
  resolveSafePath,
  validateTerminalLines,
  validateCodeInput,
  validateMarkdownInput,
  validateDiffInput,
  validateHtmlInput,
  validateFileRead,
  type FileReadPolicy,
} from "./security.js";
import { highlightCode } from "./highlighter.js";
import { detectChrome, ChromeProfile } from './browser.js';
import { TerminalColors, terminalColorsToThemeOverrides } from './terminal.js';

/* ─── Theme color definitions ─────────────────────────────── */

export interface ThemeColors {
  bg: string;
  titleBg: string;
  text: string;
  green: string;
  blue: string;
  yellow: string;
  orange: string;
  red: string;
  gray: string;
  cyan: string;
  font: string;
  fontSize: string;
  lineHeight: string;
}

/**
 * Visual rendering options for framedTemplate.
 * Controls chrome decorations independently of SnapConfig.
 */
export interface ScreenshotOptions {
  windowChrome: boolean;
  shadow: string;
  borderRadius: number;
  padding: number;
}

/**
 * Type-safe options for Playwright page.screenshot() calls.
 * Replaces raw `Record<string, unknown>` + `as any` pattern.
 */
export interface PageScreenshotOptions {
  type?: 'png' | 'jpeg';
  fullPage?: boolean;
  omitBackground?: boolean;
  clip?: { x: number; y: number; width: number; height: number };
}

const THEMES: Record<string, ThemeColors> = {
  /* ── Default / Classic ── */
  "dark-plus": {
    bg: "#1e1e1e", titleBg: "#121212", text: "#d4d4d4",
    green: "#4ec947", blue: "#569cd6", yellow: "#dcdcaa",
    orange: "#ce9178", red: "#f44747", gray: "#808080", cyan: "#4ec9b0",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },
  "github-dark": {
    bg: "#0d1117", titleBg: "#161b22", text: "#c9d1d9",
    green: "#3fb950", blue: "#58a6ff", yellow: "#d29922",
    orange: "#db6d28", red: "#f85149", gray: "#8b949e", cyan: "#39c5cf",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },
  "github-dark-dimmed": {
    bg: "#22272e", titleBg: "#1c2128", text: "#adbac7",
    green: "#57ab5a", blue: "#539bf5", yellow: "#c69026",
    orange: "#cc6b2c", red: "#e5534b", gray: "#768390", cyan: "#39c5cf",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },
  "github-light": {
    bg: "#ffffff", titleBg: "#f6f8fa", text: "#24292f",
    green: "#1a7f37", blue: "#0969da", yellow: "#9a6700",
    orange: "#bd561d", red: "#cf222e", gray: "#656d76", cyan: "#0550ae",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },
  monokai: {
    bg: "#272822", titleBg: "#1e1f1c", text: "#f8f8f2",
    green: "#a6e22e", blue: "#66d9ef", yellow: "#e6db74",
    orange: "#fd971f", red: "#f92672", gray: "#75715e", cyan: "#a1efe4",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },
  nord: {
    bg: "#2e3440", titleBg: "#242933", text: "#d8dee9",
    green: "#a3be8c", blue: "#81a1c1", yellow: "#ebcb8b",
    orange: "#d08770", red: "#bf616a", gray: "#616e88", cyan: "#88c0d0",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },
  "solarized-dark": {
    bg: "#002b36", titleBg: "#001e26", text: "#839496",
    green: "#859900", blue: "#268bd2", yellow: "#b58900",
    orange: "#cb4b16", red: "#dc322f", gray: "#586e75", cyan: "#2aa198",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },
  "solarized-light": {
    bg: "#fdf6e3", titleBg: "#eee8d5", text: "#657b83",
    green: "#859900", blue: "#268bd2", yellow: "#b58900",
    orange: "#cb4b16", red: "#dc322f", gray: "#93a1a1", cyan: "#2aa198",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },

  /* ── Dracula ── */
  dracula: {
    bg: "#282a36", titleBg: "#1e1f29", text: "#f8f8f2",
    green: "#50fa7b", blue: "#8be9fd", yellow: "#f1fa8c",
    orange: "#ffb86c", red: "#ff5555", gray: "#6272a4", cyan: "#8be9fd",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },

  /* ── One Dark Pro ── */
  "one-dark-pro": {
    bg: "#282c34", titleBg: "#21252b", text: "#abb2bf",
    green: "#98c379", blue: "#61afef", yellow: "#e5c07b",
    orange: "#d19a66", red: "#e06c75", gray: "#5c6370", cyan: "#56b6c2",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },
  "one-light": {
    bg: "#fafafa", titleBg: "#f0f0f0", text: "#383a42",
    green: "#50a14f", blue: "#4078f2", yellow: "#c18401",
    orange: "#d19a66", red: "#e45649", gray: "#a0a1a7", cyan: "#0184bc",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },

  /* ── Tokyo Night ── */
  "tokyo-night": {
    bg: "#1a1b26", titleBg: "#14151e", text: "#a9b1d6",
    green: "#73daca", blue: "#7aa2f7", yellow: "#e0af68",
    orange: "#ff9e64", red: "#f7768e", gray: "#565f89", cyan: "#7dcfff",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },

  /* ── Catppuccin ── */
  "catppuccin-mocha": {
    bg: "#1e1e2e", titleBg: "#181825", text: "#cdd6f4",
    green: "#a6e3a1", blue: "#89b4fa", yellow: "#f9e2af",
    orange: "#fab387", red: "#f38ba8", gray: "#6c7086", cyan: "#94e2d5",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },
  "catppuccin-latte": {
    bg: "#eff1f5", titleBg: "#e6e9ef", text: "#4c4f69",
    green: "#40a02b", blue: "#1e66f5", yellow: "#df8e1d",
    orange: "#fe640b", red: "#d20f39", gray: "#9ca0b0", cyan: "#04a5e5",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },

  /* ── Ayu ── */
  "ayu-dark": {
    bg: "#0a0e14", titleBg: "#0d1017", text: "#b3b1ad",
    green: "#c2d94c", blue: "#53bdfa", yellow: "#ffe6b3",
    orange: "#ff8f40", red: "#f07178", gray: "#5c6773", cyan: "#95e6cb",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },
  "ayu-light": {
    bg: "#fafafa", titleBg: "#f3f3f3", text: "#5c6166",
    green: "#86b300", blue: "#36a3d9", yellow: "#f2ae49",
    orange: "#fa8d3e", red: "#f07178", gray: "#a6a6a6", cyan: "#4cbf99",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },

  /* ── Vitesse ── */
  "vitesse-dark": {
    bg: "#121212", titleBg: "#1a1a1a", text: "#dbd7ca",
    green: "#4e9a06", blue: "#4c9a91", yellow: "#c8a96e",
    orange: "#ce8d47", red: "#c55848", gray: "#7a7a7a", cyan: "#4c9a91",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },
  "vitesse-light": {
    bg: "#ffffff", titleBg: "#f5f5f5", text: "#393a34",
    green: "#1e754e", blue: "#296aa3", yellow: "#9a6b3a",
    orange: "#b8652a", red: "#c84838", gray: "#999999", cyan: "#296aa3",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },

  /* ── Min ── */
  "min-dark": {
    bg: "#1f1f1f", titleBg: "#2a2a2a", text: "#b2b2b2",
    green: "#7ec699", blue: "#8cc7f0", yellow: "#d4c96e",
    orange: "#d49a6a", red: "#f07070", gray: "#777777", cyan: "#8cc7f0",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },
  "min-light": {
    bg: "#ffffff", titleBg: "#f0f0f0", text: "#333333",
    green: "#4a8c5c", blue: "#4078c0", yellow: "#9a6b3a",
    orange: "#a05a2c", red: "#c0392b", gray: "#999999", cyan: "#4078c0",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },

  /* ── Poimandres ── */
  poimandres: {
    bg: "#1b1e28", titleBg: "#141620", text: "#e4f0fb",
    green: "#5de4c7", blue: "#89ddff", yellow: "#f8f8f2",
    orange: "#d4bfff", red: "#d0679d", gray: "#767c9d", cyan: "#89ddff",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },

  /* ── Rose Pine ── */
  "rose-pine": {
    bg: "#191724", titleBg: "#13111e", text: "#e0def4",
    green: "#31748f", blue: "#9ccfd8", yellow: "#f6c177",
    orange: "#ebbcba", red: "#eb6f92", gray: "#6e6a86", cyan: "#c4a7e7",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },
  "rose-pine-moon": {
    bg: "#232136", titleBg: "#1c1a29", text: "#e0def4",
    green: "#3e8fb0", blue: "#9ccfd8", yellow: "#f6c177",
    orange: "#ea9a97", red: "#eb6f92", gray: "#6e6a86", cyan: "#c4a7e7",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },
  "rose-pine-dawn": {
    bg: "#faf4ed", titleBg: "#f0e9e1", text: "#575279",
    green: "#286983", blue: "#56949f", yellow: "#ea9d34",
    orange: "#d7827e", red: "#b4637a", gray: "#9893a5", cyan: "#907aa9",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },

  /* ── Slack themes ── */
  "slack-dark": {
    bg: "#1a1d21", titleBg: "#131518", text: "#d1d2d3",
    green: "#6ec97c", blue: "#6eb1e0", yellow: "#e5a639",
    orange: "#e5894a", red: "#e35d5d", gray: "#696c70", cyan: "#6ec9c9",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },
  "slack-ochin": {
    bg: "#1a1d23", titleBg: "#14171c", text: "#b7bcc8",
    green: "#7ec699", blue: "#7aa2f7", yellow: "#e5c07b",
    orange: "#d19a66", red: "#e55555", gray: "#606570", cyan: "#56b6c2",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },

  /* ── Snazzy Light ── */
  "snazzy-light": {
    bg: "#fafafa", titleBg: "#f0f0f0", text: "#282a36",
    green: "#50ad6a", blue: "#268bd2", yellow: "#b58900",
    orange: "#cb4b16", red: "#e05555", gray: "#a0a0a0", cyan: "#2aa198",
    font: "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace",
    fontSize: "14px", lineHeight: "1.6",
  },
};

const DEFAULT_THEME = "dark-plus";

const DEFAULT_FONT = "'Ubuntu Mono','Cascadia Code','JetBrains Mono','Fira Code','Consolas',monospace";

function resolveTheme(config: SnapConfig): ThemeColors {
  const theme = { ...(THEMES[config.theme] ?? THEMES[DEFAULT_THEME]!) };
  // Allow user font override via SNAPMCP_FONT
  if (config.font && config.font !== DEFAULT_FONT) {
    theme.font = config.font;
  }
  return theme;
}

/* ── Shadow CSS map ── */

function shadowCss(level: string): string {
  switch (level) {
    case "none":   return "none";
    case "medium": return "0 8px 48px rgba(0,0,0,.45)";
    case "strong": return "0 16px 72px rgba(0,0,0,.6)";
    default:       return "0 4px 24px rgba(0,0,0,.3)"; // soft
  }
}

/* ── HTML helpers ── */

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ── Window frame template (glass design) ── */

function framedTemplate(
  title: string,
  bodyHtml: string,
  theme: ThemeColors,
  config: SnapConfig,
  opts?: ScreenshotOptions,
): string {
  const hasChrome = opts?.windowChrome ?? config.windowChrome;
  const shadow = shadowCss(opts?.shadow ?? config.shadow);
  const br = opts?.borderRadius ?? config.borderRadius;
  const pad = opts?.padding ?? config.padding;
  const showBadge = config.badge;

  const windowChromeHtml = hasChrome
    ? `<div class="title-bar-glass"><div class="dots"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span></div><span class="title-text">${escHtml(title)}</span></div>`
    : "";

  const badgeHtml = showBadge
    ? `<div class="badge"><span class="badge-dot"></span>snapmcp</div>`
    : "";

  if (!hasChrome) {
    // minimal frame — no window chrome, just content
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${theme.bg};font-family:${theme.font};font-size:${theme.fontSize};line-height:${theme.lineHeight};color:${theme.text};width:fit-content;padding:${pad}px}
pre{font-family:${theme.font};font-size:${theme.fontSize};line-height:${theme.lineHeight};margin:0;white-space:pre;tab-size:4}
.line{white-space:pre}
.line-num{font-size:inherit;font-family:inherit}
.empty-line{height:${theme.lineHeight}}
</style></head><body>
${bodyHtml}
</body></html>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${theme.bg};font-family:${theme.font};font-size:${theme.fontSize};line-height:${theme.lineHeight};color:${theme.text};width:fit-content}
.frame{background:${theme.bg};border-radius:${br}px;overflow:hidden;box-shadow:${shadow};width:fit-content;min-width:400px}
.title-bar-glass{background:linear-gradient(180deg,${theme.titleBg} 0%,${theme.bg} 100%);padding:10px 16px;display:flex;align-items:center;gap:10px;user-select:none;border-bottom:1px solid rgba(255,255,255,.06);position:relative;min-height:40px}
.title-bar-glass::after{content:'';position:absolute;inset:0;background:rgba(255,255,255,.03);pointer-events:none}
.dots{display:flex;gap:8px;flex-shrink:0}
.dot{width:12px;height:12px;border-radius:50%;display:inline-block;transition:filter .15s}
.dot.red{background:radial-gradient(circle at 35% 35%,#ff7b72,#ff5f57)}
.dot.yellow{background:radial-gradient(circle at 35% 35%,#ffd166,#ffbd2e)}
.dot.green{background:radial-gradient(circle at 35% 35%,#3ddc84,#28c93f)}
.title-text{color:${theme.gray};font-size:13px;margin-left:4px;white-space:nowrap;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:.3px}
.body{padding:${pad}px ${pad}px ${pad}px;width:fit-content;min-width:100%}
pre{font-family:${theme.font};font-size:${theme.fontSize};line-height:${theme.lineHeight};margin:0;white-space:pre;tab-size:4}
.line{white-space:pre}
.line-num{font-size:inherit;font-family:inherit}
.empty-line{height:${theme.lineHeight}}
.badge{text-align:right;padding:4px 16px 8px;font-size:11px;color:${theme.gray};opacity:.35;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:.5px;user-select:none;display:flex;align-items:center;justify-content:flex-end;gap:6px}
.badge-dot{width:6px;height:6px;border-radius:50%;background:linear-gradient(135deg,#00d4aa,#0099ff,#7c4dff);display:inline-block}
</style></head><body>
<div class="frame">${windowChromeHtml}<div class="body">${bodyHtml}</div>${badgeHtml}</div>
</body></html>`;
}

/* ── Terminal body builder ── */

function renderPrompt(cmd: string, theme: ThemeColors): string {
  return `<pre class="line"><span style="color:${theme.green}">user@host</span><span style="color:${theme.text}">:</span><span style="color:${theme.blue}">~</span><span style="color:${theme.text}">$ </span><span style="color:${theme.yellow}">${escHtml(cmd)}</span></pre>`;
}

function colorizeOutputLine(text: string, theme: ThemeColors): string {
  if (!text.trim()) return `<div class="empty-line">&nbsp;</div>`;
  if (text.startsWith("===")) return `<pre class="line" style="color:${theme.yellow}">${escHtml(text)}</pre>`;
  if (text.includes("[OK]")) return `<pre class="line" style="color:${theme.green}">${escHtml(text)}</pre>`;
  if (/Error|ERROR|❌|FAIL/.test(text)) return `<pre class="line" style="color:${theme.red}">${escHtml(text)}</pre>`;
  if (/CREATE|INSERT|SELECT|UPDATE|DELETE/.test(text)) return `<pre class="line" style="color:${theme.yellow}">${escHtml(text)}</pre>`;
  if (text.startsWith("---")) return `<pre class="line" style="color:${theme.cyan}">${escHtml(text)}</pre>`;
  return `<pre class="line" style="color:${theme.text}">${escHtml(text)}</pre>`;
}

function buildTerminalBody(lines: string[], theme: ThemeColors): string {
  return lines
    .map((line) =>
      line.startsWith("$ ") ? renderPrompt(line.slice(2), theme) : colorizeOutputLine(line, theme),
    )
    .join("\n");
}

/* ── Diff body builder ── */

function buildDiffBody(diffText: string, theme: ThemeColors): string {
  return diffText
    .split("\n")
    .map((line) => {
      if (!line.trim()) return `<div class="empty-line">&nbsp;</div>`;
      if (line.startsWith("diff --git")) return `<pre class="line" style="color:${theme.cyan};font-weight:bold">${escHtml(line)}</pre>`;
      if (line.startsWith("@@")) return `<pre class="line" style="color:${theme.cyan}">${escHtml(line)}</pre>`;
      if (line.startsWith("---") || line.startsWith("+++")) return `<pre class="line" style="color:${theme.gray}">${escHtml(line)}</pre>`;
      if (line.startsWith("+")) return `<pre class="line" style="color:${theme.green};background:rgba(${hexToRgb(theme.green)},0.15)">${escHtml(line)}</pre>`;
      if (line.startsWith("-")) return `<pre class="line" style="color:${theme.red};background:rgba(${hexToRgb(theme.red)},0.15)">${escHtml(line)}</pre>`;
      if (line.startsWith("index ")) return `<pre class="line" style="color:${theme.gray}">${escHtml(line)}</pre>`;
      return `<pre class="line" style="color:${theme.text}">${escHtml(line)}</pre>`;
    })
    .join("\n");
}

/** Naive hex → RGB for rgba() usage in backgrounds */
function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

/* ── Line number injector for Shiki output ── */

function addLineNumbers(highlightedHtml: string, startLine: number, theme: ThemeColors): string {
  // Replace each <span class="line"> with a version that has a line number prefix
  let lineNum = startLine;
  return highlightedHtml.replace(
    /<span class="line">/g,
    () => `<span class="line"><span class="line-num" style="user-select:none;color:${theme.gray};opacity:0.5;display:inline-block;width:3em;text-align:right;padding-right:1.5em;border-right:1px solid ${theme.gray}33;margin-right:1em">${lineNum++}</span>`,
  );
}

/* ── Document template (for markdown) ── */

function documentTemplate(title: string, bodyHtml: string, theme: ThemeColors): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${theme.bg};color:${theme.text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:16px;line-height:1.7;padding:40px;width:fit-content;min-width:400px}
.document{max-width:800px}
h1,h2,h3,h4{color:${theme.blue};margin:1.2em 0 .5em}
h1{font-size:1.8em;border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:.3em}
h2{font-size:1.4em}
h3{font-size:1.2em}
p{margin:.8em 0}
ul,ol{margin:.5em 0;padding-left:1.5em}
li{margin:.3em 0}
code{background:${theme.titleBg};padding:2px 8px;border-radius:4px;font-family:${theme.font};font-size:.88em}
pre{margin:.8em 0;padding:14px 18px;background:${theme.titleBg};border-radius:6px;overflow-x:auto}
pre code{background:none;padding:0}
blockquote{border-left:4px solid ${theme.blue};padding-left:16px;margin:.8em 0;color:${theme.gray}}
table{border-collapse:collapse;margin:.8em 0;width:100%}
th,td{border:1px solid rgba(255,255,255,.12);padding:8px 14px;text-align:left}
th{background:${theme.titleBg};font-weight:600}
tr:nth-child(even){background:rgba(255,255,255,.03)}
hr{border:none;border-top:1px solid rgba(255,255,255,.1);margin:1.5em 0}
a{color:${theme.blue}}
img{max-width:100%;border-radius:6px}
</style></head><body>
<div class="document">${bodyHtml}</div>
</body></html>`;
}

/* ── Raw HTML wrapper ── */

function rawHtmlTemplate(html: string, theme: ThemeColors): string {
  if (/<!DOCTYPE/i.test(html) || /<html/i.test(html)) return html;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${theme.bg};color:${theme.text};font-family:${theme.font};font-size:${theme.fontSize};line-height:${theme.lineHeight};padding:24px;width:fit-content}
</style></head><body>${html}</body></html>`;
}

/* ── Playwright browser singleton ── */

let _browser: playwright.Browser | null = null;

async function getBrowser(config: SnapConfig): Promise<playwright.Browser> {
  if (!_browser) {
    const launchOptions: playwright.LaunchOptions = { headless: true };

    // When chromeExecutable and chromeChannel are configured, use system Chrome
    if (config.chromeExecutable && config.chromeChannel) {
      const chrome = detectChrome();
      if (chrome.found && chrome.executablePath) {
        launchOptions.executablePath = chrome.executablePath;
      }
      // falls back to bundled Chromium if system Chrome not found for that channel
    }

    _browser = await playwright.chromium.launch(launchOptions);
  }
  return _browser;
}

export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

/* ── HTML → screenshot (PNG or JPEG) ── */

async function screenshotHtml(
  html: string,
  outputPath: string,
  config: SnapConfig,
  selector = ".frame",
  minWidth = 400,
): Promise<void> {
  const browser = await getBrowser(config);
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: config.deviceScale,
  });

  try {
    await page.setContent(html, { waitUntil: "networkidle", timeout: config.timeout });

    const box = await page.evaluate(
      ({ sel }) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { width: Math.ceil(r.width), height: Math.ceil(r.height) };
      },
      { sel: selector },
    );

    if (!box) {
      // Fall back to body when selector not found (minimal frame mode)
      const bodyBox = await page.evaluate(() => {
        const b = document.querySelector('body') as HTMLElement | null;
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { width: Math.ceil(r.width), height: Math.ceil(r.height) };
      });
      if (!bodyBox) throw new Error('No captureable element found');
      const pad = config.padding + 8;
      await page.setViewportSize({
        width: Math.max(minWidth, bodyBox.width + pad),
        height: Math.max(600, bodyBox.height + pad),
      });
    } else {
      // Use padding from config (around the frame itself)
      const pad = config.padding + 8;
      await page.setViewportSize({
        width: Math.max(minWidth, box.width + pad),
        height: Math.max(600, box.height + pad),
      });
    }
    await page.waitForTimeout(100);

    // Element to capture: prefer selector, fall back to body
    const el = await page.$(selector) ?? await page.$('body');
    if (!el) throw new Error('No captureable element found');

    const opts: Record<string, unknown> = { path: outputPath };
    if (config.format === "jpeg") {
      opts.type = "jpeg";
      opts.quality = config.quality;
    }
    await el.screenshot(opts as any);
  } finally {
    await page.close();
  }
}

/* ── Browser URL → screenshot ── */

async function screenshotPage(
  url: string,
  outputPath: string,
  fullPage: boolean,
  width: number,
  height: number,
  config: SnapConfig,
): Promise<void> {
  const browser = await getBrowser(config);
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: config.deviceScale,
  });

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: config.timeout });

    const screenshotOpts: PageScreenshotOptions = {
      fullPage,
      ...(config.format === "jpeg" ? { type: "jpeg" as const } : {}),
    };
    await page.screenshot({ path: outputPath, ...screenshotOpts });
  } finally {
    await page.close();
  }
}

/* ── URL → PDF ── */

async function capturePdfInternal(
  url: string,
  outputPath: string,
  _fullPage: boolean,
  width: number,
  height: number,
  config: SnapConfig,
): Promise<string> {
  const browser = await getBrowser(config);
  const page = await browser.newPage({ viewport: { width, height } });

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: config.timeout });
    await page.pdf({ path: outputPath, format: "A4", printBackground: true });
  } finally {
    await page.close();
  }
  return outputPath;
}

/* ── Output directory management ── */

export function ensureOutputDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function enforceCleanup(dir: string, maxFiles: number): void {
  if (maxFiles <= 0) return;
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => /\.(png|jpg|pdf)$/i.test(f))
      .map((f) => ({ name: f, time: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => a.time - b.time);

    if (files.length > maxFiles) {
      for (const f of files.slice(0, files.length - maxFiles)) {
        fs.unlinkSync(path.join(dir, f.name));
      }
    }
  } catch {
    // silently ignore cleanup errors
  }
}

/* ── Markdown → HTML ── */

async function markdownToHtml(markdown: string): Promise<string> {
  return marked.parse(markdown);
}

/* ── File read policy builder ── */

function filePolicy(config: SnapConfig): FileReadPolicy {
  return { maxSize: config.maxFileSize, allowedPaths: config.allowedPaths };
}

/* ── Terminal color normalizer ── */

/**
 * Normalize terminal theme colors for consistent ANSI-compatible output.
 * Ensures all color values are proper 6-digit hex and applies brand-compatible
 * defaults for any missing ANSI color slots.
 */
function normalizeTerminalStyles(theme: ThemeColors): ThemeColors {
  const normalized = { ...theme };

  // Ensure every hex color is a full 6-digit value
  for (const key of Object.keys(normalized) as (keyof ThemeColors)[]) {
    const val = normalized[key];
    if (typeof val === 'string' && val.startsWith('#')) {
      if (val.length === 4) {
        const r = val[1], g = val[2], b = val[3];
        (normalized as Record<string, string>)[key] = `#${r}${r}${g}${g}${b}${b}`;
      }
    }
  }

  return normalized;
}

/* ── Public API ── */

/** Capture terminal-style screenshot from lines of text */
export async function captureTerminal(
  title: string,
  lines: string[],
  outputPath: string,
  config: SnapConfig,
): Promise<string> {
  if (config.securityChecks) validateTerminalLines(lines);
  const theme = resolveTheme(config);

  // Apply real terminal color overrides when available
  if (config.terminalColors) {
    const overrides = config.terminalColors;
    if (overrides.bg) theme.bg = overrides.bg;
    if (overrides.text) theme.text = overrides.text;
    if (overrides.green) theme.green = overrides.green;
    if (overrides.red) theme.red = overrides.red;
    if (overrides.blue) theme.blue = overrides.blue;
    if (overrides.yellow) theme.yellow = overrides.yellow;
    if (overrides.cyan) theme.cyan = overrides.cyan;
    if (overrides.gray) theme.gray = overrides.gray;
    if (overrides.orange) theme.orange = overrides.orange;
    if (overrides.font) theme.font = overrides.font;
    if (overrides.fontSize) theme.fontSize = overrides.fontSize;
  }

  const normalizedTheme = normalizeTerminalStyles(theme);
  const bodyHtml = buildTerminalBody(lines, normalizedTheme);

  const screenshotOpts: ScreenshotOptions = {
    windowChrome: config.windowChrome,
    shadow: config.shadow,
    borderRadius: config.borderRadius,
    padding: config.padding,
  };

  await screenshotHtml(framedTemplate(title, bodyHtml, normalizedTheme, config, screenshotOpts), outputPath, config);
  return outputPath;
}

/** Capture syntax-highlighted code screenshot */
export async function captureCode(
  code: string,
  lang: string,
  title: string,
  outputPath: string,
  config: SnapConfig,
  startLine?: number,
  endLine?: number,
): Promise<string> {
  if (config.securityChecks) validateCodeInput(code);
  const theme = resolveTheme(config);
  const highlighted = await highlightCode(code, lang || "text", config.theme);

  // Add line numbers if startLine is specified
  let bodyHtml = highlighted;
  if (startLine !== undefined) {
    bodyHtml = addLineNumbers(highlighted, startLine, theme);
  }

  const screenshotOpts: ScreenshotOptions = {
    windowChrome: config.windowChrome,
    shadow: config.shadow,
    borderRadius: config.borderRadius,
    padding: config.padding,
  };

  await screenshotHtml(framedTemplate(title, bodyHtml, theme, config, screenshotOpts), outputPath, config);
  return outputPath;
}

/** Capture browser URL screenshot */
export async function captureBrowser(
  url: string,
  outputPath: string,
  fullPage: boolean,
  width: number,
  height: number,
  config: SnapConfig,
): Promise<string> {
  await screenshotPage(url, outputPath, fullPage, width, height, config);
  return outputPath;
}

/** Capture file content as code screenshot */
export async function captureFile(
  filePath: string,
  outputPath: string,
  config: SnapConfig,
  startLine?: number,
  endLine?: number,
): Promise<string> {
  if (config.securityChecks) validateFileRead(filePath, filePolicy(config));

  const code = fs.readFileSync(filePath, "utf-8");
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const langMap: Record<string, string> = {
    py: "python", js: "javascript", ts: "typescript", tsx: "tsx", jsx: "jsx",
    sql: "sql", json: "json", yml: "yaml", md: "markdown", html: "html",
    css: "css", sh: "bash", bash: "bash", zsh: "bash", go: "go",
    c: "c", cpp: "cpp", cs: "csharp", java: "java", rb: "ruby",
    php: "php", rs: "rust", swift: "swift", kt: "kotlin", kts: "kotlin",
    toml: "toml", xml: "xml", txt: "text", dockerfile: "dockerfile",
    tf: "terraform", diff: "diff", patch: "diff",
  };
  const lang = langMap[ext] || "text";
  const lines = code.split("\n");

  // Apply line range slicing
  let slicedCode = code;
  let displayTitle = path.basename(filePath);
  if (startLine !== undefined || endLine !== undefined) {
    const start = startLine ?? 1;
    const end = endLine ?? lines.length;
    if (start < 1 || end > lines.length || start > end) {
      throw new Error(`Invalid line range: ${start}-${end} (file has ${lines.length} lines)`);
    }
    slicedCode = lines.slice(start - 1, end).join("\n");
    displayTitle = `${path.basename(filePath)} (lines ${start}-${end})`;
  }

  return captureCode(slicedCode, lang, displayTitle, outputPath, config, startLine, endLine);
}

/** Capture markdown as a rendered document screenshot */
export async function captureMarkdown(
  markdown: string,
  title: string,
  outputPath: string,
  config: SnapConfig,
): Promise<string> {
  if (config.securityChecks) validateMarkdownInput(markdown);
  const theme = resolveTheme(config);
  const bodyHtml = await markdownToHtml(markdown);
  await screenshotHtml(documentTemplate(title, bodyHtml, theme), outputPath, config, ".document", 400);
  return outputPath;
}

/** Capture arbitrary HTML as a screenshot */
export async function captureHtml(
  html: string,
  _title: string,
  outputPath: string,
  config: SnapConfig,
): Promise<string> {
  if (config.securityChecks) validateHtmlInput(html);
  const theme = resolveTheme(config);
  await screenshotHtml(rawHtmlTemplate(html, theme), outputPath, config, "body", 400);
  return outputPath;
}

/** Capture a git diff with color-coded lines */
export async function captureDiff(
  diffText: string,
  outputPath: string,
  config: SnapConfig,
): Promise<string> {
  if (config.securityChecks) validateDiffInput(diffText);
  const theme = resolveTheme(config);

  const screenshotOpts: ScreenshotOptions = {
    windowChrome: config.windowChrome,
    shadow: config.shadow,
    borderRadius: config.borderRadius,
    padding: config.padding,
  };

  const bodyHtml = buildDiffBody(diffText, theme);
  await screenshotHtml(framedTemplate("diff", bodyHtml, theme, config, screenshotOpts), outputPath, config);
  return outputPath;
}

/** Capture URL as PDF */
export async function capturePdf(
  url: string,
  outputPath: string,
  fullPage: boolean,
  width: number,
  height: number,
  config: SnapConfig,
): Promise<string> {
  return capturePdfInternal(url, outputPath, fullPage, width, height, config);
}

/** Run cleanup on output directory */
export function runCleanup(config: SnapConfig): void {
  enforceCleanup(config.outputDir, config.cleanupMax);
}
