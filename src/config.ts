/**
 * Unified configuration for snapmcp.
 * All options come from SNAPMCP_* environment variables with sensible defaults.
 */

import { detectTerminalTheme, detectTerminalColors, TerminalColors, terminalColorsToThemeOverrides } from './terminal.js';

export type OutputFormat = "png" | "jpeg";
export type ShadowLevel = "none" | "soft" | "medium" | "strong";

export interface SnapConfig {
  /** Output directory for generated files */
  outputDir: string;
  /** Image format: png (lossless) or jpeg (smaller, configurable quality) */
  format: OutputFormat;
  /** JPEG quality 1-100 (only applies when format=jpeg) */
  quality: number;
  /** Shiki theme name for syntax highlighting */
  theme: string;
  /** Font family for terminal/code/document captures */
  font: string;
  /** Font size for terminal/code/document captures */
  fontSize: string;
  /** Browser navigation timeout in milliseconds */
  timeout: number;
  /** Device pixel ratio (2 = retina) */
  deviceScale: number;
  /** Max files in output dir before auto-clean (0 = no limit) */
  cleanupMax: number;
  /** Minimum log level: error | warn | info | debug */
  logLevel: string;
  /** Allowed paths for capture_file (semicolon-separated, empty = all) */
  allowedPaths: string[];
  /** Max file size for capture_file in bytes */
  maxFileSize: number;
  /** Enable startup security checks */
  securityChecks: boolean;
  /* ── Visual options ── */
  /** Padding inside the capture viewport (px) */
  padding: number;
  /** Window drop-shadow level */
  shadow: ShadowLevel;
  /** Show macOS-style window chrome (traffic lights + title bar) */
  windowChrome: boolean;
  /** Border radius of the capture window (px) */
  borderRadius: number;
  /** Show subtle "snapmcp" badge in the footer */
  badge: boolean;
  /* ── Browser options ── */
  /** Path to a custom Chrome/Chromium executable */
  chromeExecutable?: string;
  /** Chrome release channel: stable, beta, dev, canary */
  chromeChannel?: string;
  /** Chrome profile directory name */
  chromeProfile?: string;
  /** Auto-detected terminal colors (overrides theme defaults) */
  terminalColors?: Partial<{
    bg: string;
    text: string;
    green: string;
    red: string;
    blue: string;
    yellow: string;
    cyan: string;
    gray: string;
    orange: string;
    font: string;
    fontSize: string;
  }>;
}

const DEFAULTS: SnapConfig = {
  outputDir: "./captures",
  format: "png",
  quality: 90,
  theme: "dark-plus",
  font: "'Ubuntu Mono', 'Cascadia Code', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: "14px",
  timeout: 30_000,
  deviceScale: 2,
  cleanupMax: 0,
  logLevel: "info",
  allowedPaths: [],
  maxFileSize: 5_000_000,
  securityChecks: true,
  padding: 32,
  shadow: "none",
  windowChrome: false,
  borderRadius: 0,
  badge: false,
};

export function loadConfig(): SnapConfig {
  const allowedPathsRaw = env("ALLOWED_PATHS", "");
  const config: SnapConfig = {
    outputDir: env("DIR", DEFAULTS.outputDir),
    format: env("FORMAT", DEFAULTS.format) === "jpeg" ? "jpeg" : "png",
    quality: clamp(envInt("QUALITY", DEFAULTS.quality), 1, 100),
    theme: env("THEME", detectTerminalTheme().theme), /* THEME: auto-detected */
    font: env("FONT", DEFAULTS.font),
    fontSize: env("FONT_SIZE", DEFAULTS.fontSize),
    timeout: Math.max(1000, envInt("TIMEOUT", DEFAULTS.timeout)),
    deviceScale: Math.max(1, envInt("DEVICE_SCALE", DEFAULTS.deviceScale)),
    cleanupMax: Math.max(0, envInt("CLEANUP_MAX", DEFAULTS.cleanupMax)),
    logLevel: env("LOG_LEVEL", DEFAULTS.logLevel),
    allowedPaths: allowedPathsRaw
      ? allowedPathsRaw.split(";").map((p) => p.trim()).filter(Boolean)
      : [],
    maxFileSize: Math.max(1024, envInt("MAX_FILE_SIZE", DEFAULTS.maxFileSize)),
    securityChecks: envBool("SECURITY_CHECKS", DEFAULTS.securityChecks),
    padding: Math.max(0, envInt("PADDING", DEFAULTS.padding)),
    shadow: parseShadow(env("SHADOW", DEFAULTS.shadow)),
    windowChrome: envBool("WINDOW_CHROME", DEFAULTS.windowChrome),
    borderRadius: Math.max(0, Math.min(32, envInt("BORDER_RADIUS", DEFAULTS.borderRadius))),
    badge: envBool("BADGE", DEFAULTS.badge),
  };

  const terminalColors = detectTerminalColors();
  if (terminalColors) {
    config.terminalColors = terminalColorsToThemeOverrides(terminalColors);
  }

  return config;
}

export const THEME_LIST = [
  "dark-plus",
  "dracula",
  "github-dark",
  "github-dark-dimmed",
  "github-light",
  "monokai",
  "nord",
  "one-dark-pro",
  "one-light",
  "poimandres",
  "solarized-dark",
  "solarized-light",
  "vitesse-dark",
  "vitesse-light",
  "min-dark",
  "min-light",
  "tokyo-night",
  "ayu-dark",
  "ayu-light",
  "catppuccin-mocha",
  "catppuccin-latte",
  "rose-pine",
  "rose-pine-dawn",
  "rose-pine-moon",
  "slack-dark",
  "slack-ochin",
  "snazzy-light",
] as const;

/* ── Helpers ── */

function env(key: string, fallback: string): string {
  return process.env[`SNAPMCP_${key}`] ?? fallback;
}

function envInt(key: string, fallback: number): number {
  const v = process.env[`SNAPMCP_${key}`];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[`SNAPMCP_${key}`];
  if (v === undefined) return fallback;
  return v === "1" || v === "true" || v === "yes";
}

function parseShadow(v: string): ShadowLevel {
  const valid: ShadowLevel[] = ["none", "soft", "medium", "strong"];
  return valid.includes(v as ShadowLevel) ? (v as ShadowLevel) : "soft";
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** File extension for the configured output format */
export function formatExt(format: OutputFormat): string {
  return format === "jpeg" ? "jpg" : "png";
}
