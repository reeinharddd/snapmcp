/**
 * Brand tokens for snapmcp.
 * Single source of truth for all brand-derived values.
 * Imported at build time from brand/tokens/snapmcp-tokens.json.
 * Runtime override via SNAPMCP_BRAND_TOKENS_PATH.
 */

import fs from "node:fs";
import path from "node:path";

interface BrandColors {
  brand: { primary: string; secondary: string; tertiary: string; gradient: string };
  neutral: { black: string; dark: string; medium: string; gray: string; light: string; lighter: string; white: string };
  semantic: { success: string; warning: string; error: string; info: string; debug: string };
}

interface BrandTokens {
  version: string;
  description?: string;
  ascii?: string;
  colors: BrandColors;
  typography: {
    fontStack: { mono: string; ui: string; display: string };
    sizes: Record<string, string>;
    weights: Record<string, number>;
    lineHeights: Record<string, string>;
  };
  shadows: {
    none: string; soft: string; medium: string; strong: string; glow: string;
  };
  badge: { text: string; opacity: number; fontSize: string };
  windowChrome: {
    trafficLight: { red: string; yellow: string; green: string };
  };
}

function loadTokens(): BrandTokens {
  const overridePath = process.env.SNAPMCP_BRAND_TOKENS_PATH;
  const tokenPath = overridePath
    ? path.resolve(overridePath)
    : path.resolve(import.meta.dirname, "../brand/tokens/snapmcp-tokens.json");
  try {
    const raw = fs.readFileSync(tokenPath, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed.snapmcp as BrandTokens;
  } catch {
    // Fallback hardcoded tokens if file not found
    return fallbackTokens();
  }
}

function fallbackTokens(): BrandTokens {
  return {
    version: "1.0.0",
    ascii: "\n  ╔═══════════════════════════════════════════╗\n  ║              snapmcp  v2.2.0              ║\n  ║    Precision captures for AI agents       ║\n  ╚═══════════════════════════════════════════╝",
    colors: {
      brand: { primary: "#00d4aa", secondary: "#0099ff", tertiary: "#7c4dff", gradient: "linear-gradient(135deg, #00d4aa 0%, #0099ff 50%, #7c4dff 100%)" },
      neutral: { black: "#0d0d12", dark: "#1a1a2e", medium: "#2a2a3e", gray: "#6b6b80", light: "#a0a0b8", lighter: "#d0d0e0", white: "#e8e8f0" },
      semantic: { success: "#28c93f", warning: "#ffbd2e", error: "#ff5f57", info: "#0099ff", debug: "#7c4dff" },
    },
    typography: {
      fontStack: { mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Ubuntu Mono', 'Consolas', monospace", ui: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", display: "'JetBrains Mono', 'Fira Code', monospace" },
      sizes: { xs: "11px", sm: "12px", base: "13px", md: "14px", lg: "16px", xl: "20px", "2xl": "28px", "3xl": "36px" },
      weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
      lineHeights: { tight: "1.2", normal: "1.5", relaxed: "1.6", loose: "1.8" },
    },
    shadows: { none: "none", soft: "0 4px 24px rgba(0,0,0,.3)", medium: "0 8px 48px rgba(0,0,0,.45)", strong: "0 16px 72px rgba(0,0,0,.6)", glow: "0 0 20px rgba(0,212,170,0.2)" },
    badge: { text: "snapmcp", opacity: 0.35, fontSize: "11px" },
    windowChrome: { trafficLight: { red: "#ff5f57", yellow: "#ffbd2e", green: "#28c93f" } },
  };
}

export const BRAND = loadTokens();

/* ── Brand helpers ── */

/** Brand primary gradient CSS value. */
export function brandGradient(): string {
  return BRAND.colors.brand.gradient;
}

/** Brand primary color (teal). */
export function brandPrimary(): string {
  return BRAND.colors.brand.primary;
}

/** Brand secondary color (blue). */
export function brandSecondary(): string {
  return BRAND.colors.brand.secondary;
}

/** CSS for macOS traffic light dots (red, yellow, green). */
export function trafficLightCss(): string {
  const t = BRAND.windowChrome.trafficLight;
  return [
    `.dot.red{background:radial-gradient(circle at 35% 35%,#ff7b72,${t.red})}`,
    `.dot.yellow{background:radial-gradient(circle at 35% 35%,#ffd166,${t.yellow})}`,
    `.dot.green{background:radial-gradient(circle at 35% 35%,#3ddc84,${t.green})}`,
  ].join("\n");
}

/** CSS for the snapmcp footer badge dot (brand gradient). */
export function badgeDotCss(): string {
  return `background:${BRAND.colors.brand.gradient}`;
}

/** CSS box-shadow value for a given shadow level. */
export function brandShadowCss(level: string): string {
  const shadows = BRAND.shadows as Record<string, string>;
  return shadows[level] ?? shadows.soft;
}

/** Lighten a hex color by a percentage (0-1). */
export function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * amount));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
