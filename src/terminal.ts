/**
 * Terminal theme detection for snapmcp.
 *
 * Detects light/dark terminal theme using environment variables and OS-level
 * dark-mode queries.  Runs synchronously at startup with graceful fallback.
 *
 * Detection priority (first win):
 *   1. SNAPMCP_THEME env var             — explicit override (handled by config.ts, skipped here)
 *   2. $COLORFGBG                        — terminal fg/bg color
 *   3. $TERM                             — "linux" → light
 *   4. OS-level dark mode:
 *      a. gsettings (Linux/GNOME)    — color-scheme property
 *      b. gsettings (Linux/GNOME)    — gtk-theme suffix check
 *      c. dconf (Linux/GNOME)        — color-scheme
 *      d. ~/.config/gtk-4.0/settings.ini (Linux/GTK4)
 *      e. defaults read (macOS)      — AppleInterfaceStyle
 *      f. reg query (Windows)        — AppsUseLightTheme
 *   5. fallbackTheme argument
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/* ── Types ── */

export interface TerminalThemeResult {
  /** Resolved Shiki theme name */
  theme: string;
  /** Whether the resolved theme is a dark variant */
  isDark: boolean;
  /** Which detection method produced the result */
  source: string;
}

/* ── Theme pools (derived from THEME_LIST in config.ts) ── */

const DARK_THEMES = new Set([
  "dark-plus",
  "github-dark",
  "github-dark-dimmed",
  "monokai",
  "nord",
  "solarized-dark",
  "dracula",
  "one-dark-pro",
  "tokyo-night",
  "catppuccin-mocha",
  "vitesse-dark",
  "ayu-dark",
  "min-dark",
  "poimandres",
  "rose-pine",
  "rose-pine-moon",
  "slack-dark",
]);

const LIGHT_THEMES = new Set([
  "github-light",
  "solarized-light",
  "vitesse-light",
  "catppuccin-latte",
  "ayu-light",
  "one-light",
  "min-light",
  "slack-ochin",
  "snazzy-light",
  "rose-pine-dawn",
]);

export function isDarkTheme(theme: string): boolean {
  return DARK_THEMES.has(theme) || (theme.includes("dark") && !LIGHT_THEMES.has(theme));
}

/* ── Detection-sources registry ── */

/**
 * Array of all detection method identifiers tried, in order.
 * Useful for debugging or logging which strategies were attempted.
 */
export const TERMINAL_DETECTION_SOURCES: string[] = [];

/* ── Core detection ── */

/**
 * Detect the terminal's color theme (light / dark) and map it to a
 * Shiki theme name from the snapmcp theme pool.
 *
 * @param fallbackTheme - Theme name to use when no detection method succeeds.
 *                        Defaults to "dark-plus".
 * @returns A {@linkcode TerminalThemeResult} with the resolved theme, whether
 *          it is a dark variant, and the source description.
 */
export function detectTerminalTheme(fallbackTheme = "dark-plus"): TerminalThemeResult {
  // Reset sources on each call
  TERMINAL_DETECTION_SOURCES.length = 0;

  const done = (theme: string, source: string): TerminalThemeResult => {
    const result: TerminalThemeResult = {
      theme,
      isDark: isDarkTheme(theme),
      source,
    };
    return result;
  };

  /* ── 1. COLORFGBG ── */
  TERMINAL_DETECTION_SOURCES.push("colorFgBg");
  const colorFgBg = process.env.COLORFGBG;
  if (colorFgBg) {
    const parts = colorFgBg.split(";");
    const bg = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(bg) && bg >= 0 && bg <= 15) {
      // COLORFGBG is "fg;bg" with xterm color indices: 0=black ... 7=white, 8-15 bright.
      // A light/white background (>= 7) → light theme; a dark background (< 7) → dark theme.
      return done(bg >= 7 ? "github-light" : "dark-plus", "colorFgBg");
    }
  }

  /* ── 2. TERM ── */
  TERMINAL_DETECTION_SOURCES.push("termEnv");
  const term = process.env.TERM;
  if (term === "linux") {
    // Linux virtual console — typically a light (white-on-black) TUI
    // but the high-contrast palette means light theme reads better
    return done("github-light", "termEnv");
  }

  /* ── 3. OS-level dark mode (Linux only) ── */
  if (os.platform() === "linux") {
    // 3a. gsettings color-scheme (GNOME 42+)
    TERMINAL_DETECTION_SOURCES.push("os-gsettings-color-scheme");
    try {
      const out = execSync(
        "gsettings get org.gnome.desktop.interface color-scheme",
        { encoding: "utf-8", timeout: 2000, stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
      if (out === "'prefer-dark'") {
        return done("dark-plus", "os-gsettings-color-scheme");
      }
    } catch {
      // gsettings not available or not GNOME
    }

    // 3b. gsettings gtk-theme (fallback for older GNOME)
    TERMINAL_DETECTION_SOURCES.push("os-gsettings-gtk-theme");
    try {
      const out = execSync(
        "gsettings get org.gnome.desktop.interface gtk-theme",
        { encoding: "utf-8", timeout: 2000, stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
      const themeName = out.replace(/^'|'$/g, "");
      if (themeName.endsWith("-dark") || themeName.endsWith("-Dark")) {
        return done("dark-plus", "os-gsettings-gtk-theme");
      }
    } catch {
      // gsettings not available
    }

    // 3c. dconf read (direct, lower-level)
    TERMINAL_DETECTION_SOURCES.push("os-dconf");
    try {
      const out = execSync(
        "dconf read /org/gnome/desktop/interface/color-scheme",
        { encoding: "utf-8", timeout: 2000, stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
      if (out === "'prefer-dark'") {
        return done("dark-plus", "os-dconf");
      }
    } catch {
      // dconf not available
    }

    // 3d. GTK4 settings.ini
    TERMINAL_DETECTION_SOURCES.push("os-gtk-ini");
    try {
      const gtkIni = path.join(os.homedir(), ".config", "gtk-4.0", "settings.ini");
      if (fs.existsSync(gtkIni)) {
        const raw = fs.readFileSync(gtkIni, "utf-8");
        const match = raw.match(/gtk-application-prefer-dark-theme\s*=\s*(\d)/);
        if (match && match[1] === "1") {
          return done("dark-plus", "os-gtk-ini");
        }
      }
    } catch {
      // ini not readable
    }
  }

  /* ── 3e. macOS dark mode ── */
  if (os.platform() === "darwin") {
    TERMINAL_DETECTION_SOURCES.push("os-macos-defaults");
    try {
      const out = execSync("defaults read -g AppleInterfaceStyle", {
        encoding: "utf-8",
        timeout: 2000,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (out.toLowerCase().includes("dark")) {
        return done("dark-plus", "os-macos-defaults");
      }
    } catch {
      // defaults not available or key missing (light mode)
    }
  }

  /* ── 3f. Windows dark mode ── */
  if (os.platform() === "win32") {
    TERMINAL_DETECTION_SOURCES.push("os-windows-registry");
    try {
      const out = execSync(
        "reg query HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize /v AppsUseLightTheme",
        { encoding: "utf-8", timeout: 2000, stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
      const match = out.match(/AppsUseLightTheme\s+REG_DWORD\s+0x([0-9a-fA-F]+)/);
      if (match) {
        const value = parseInt(match[1], 16);
        if (value === 0) {
          return done("dark-plus", "os-windows-registry");
        }
      }
    } catch {
      // reg query not available or key missing
    }
  }

  /* ── 4. Fallback ── */
  TERMINAL_DETECTION_SOURCES.push("fallback");
  return done(fallbackTheme, "fallback");
}

/* ══════════════════════════════════════════════════════════════
 *  Real terminal color detection
 *
 *  Reads the actual terminal emulator configuration to get
 *  the user's real background, foreground, and ANSI 16-color
 *  palette.  Used by captureTerminal for real-fidelity output.
 *
 *  Strategy: detect which terminal emulator is running by walking
 *  the process tree, then read that emulator's specific config.
 *  Falls back to trying known config paths + COLORFGBG.
 *
 *  Supported emulators (auto-detected by process name):
 *    kitty, gnome-terminal, alacritty, wezterm, xfce4-terminal,
 *    lxterminal, windows-terminal, iterm2
 * ══════════════════════════════════════════════════════════════ */

export interface TerminalColors {
  bg: string;
  fg: string;
  ansi: string[];
  font?: string;
  fontSize?: string;
  source: string;
}

let _colorCache: TerminalColors | null | undefined;

export function resetTerminalColorsCache(): void {
  _colorCache = undefined;
}

export function detectTerminalColors(): TerminalColors | null {
  if (_colorCache !== undefined) return _colorCache;

  const emulator = detectTerminalEmulator();
  _colorCache = readEmulatorConfig(emulator)
    ?? readConfigPaths()
    ?? readColorFgBg()
    ?? null;

  return _colorCache;
}

/* ── Process-tree: detect which terminal emulator is running ── */

function detectTerminalEmulator(): string | null {
  // Walk up the process tree from our PID looking for a terminal emulator.
  // We identify "terminal-ness" by: has a controlling TTY, is not the
  // shell (zsh/bash/fish), and has a recognizable binary name.
  try {
    if (os.platform() !== "linux") return null;
    let pid = process.ppid;
    const visited = new Set<number>();
    for (let i = 0; i < 10 && pid > 1 && !visited.has(pid); i++) {
      visited.add(pid);
      try {
        const comm = fs.readFileSync(`/proc/${pid}/comm`, "utf-8").trim();
        const status = fs.readFileSync(`/proc/${pid}/status`, "utf-8");
        const ttyNr = status.match(/Tty:\s+(\d+)/)?.[1];

        const SHELLS = new Set(["zsh", "bash", "fish", "dash", "sh", "nu"]);
        const TERMINALS = new Set([
          "kitty", "gnome-terminal", "gnome-terminal-", "alacritty",
          "wezterm", "wezterm-gui", "xfce4-terminal", "lxterminal",
          "terminator", "tilix", "urxvt", "st", "xterm", "xterm-kitty",
          "konsole", "kgx", "contour", "foot", "footclient",
        ]);

        if (ttyNr && ttyNr !== "0" && !SHELLS.has(comm) && TERMINALS.has(comm)) {
          return comm;
        }
        if (TERMINALS.has(comm)) return comm;

        pid = parseInt(
          status.match(/PPid:\s+(\d+)/)?.[1] ?? "0", 10,
        );
      } catch {
        break;
      }
    }
  } catch {
    // /proc not available (macOS / Windows)
  }
  return null;
}

/* ── Emulator-specific config readers ── */

type ConfigReader = (emulator: string) => TerminalColors | null;

const EMULATOR_READERS: ConfigReader[] = [
  (e) => (["kitty", "xterm-kitty"].includes(e) ? readKitty() : null),
  (e) => (e.startsWith("gnome-terminal") ? readGnomeTerminal() : null),
  (e) => (e === "alacritty" ? readAlacritty() : null),
  (e) => (e.startsWith("wezterm") ? readWezTerm() : null),
  (e) => (e === "xfce4-terminal" ? readXfce4() : null),
  (e) => (e === "lxterminal" ? readLxterminal() : null),
  (e) => (["xterm", "urxvt", "st", "konsole", "foot", "contour"].includes(e) ? null : null), // known but no config reader yet
];

function readEmulatorConfig(emulator: string | null): TerminalColors | null {
  if (!emulator) return null;
  for (const reader of EMULATOR_READERS) {
    const result = reader(emulator);
    if (result) return result;
  }
  return null;
}

/* ── Generic: try all known config paths ── */

function readConfigPaths(): TerminalColors | null {
  const paths: Array<{ path: string; reader: () => TerminalColors | null }> = [
    { path: "kitty", reader: readKitty },
    { path: "alacritty/toml", reader: readAlacritty },
    { path: "alacritty/yml", reader: readAlacritty },
    { path: "xfce4/terminal", reader: readXfce4 },
    { path: "lxterminal", reader: readLxterminal },
  ];

  for (const { reader } of paths) {
    const result = reader();
    if (result) return result;
  }

  // Gnome Terminal (dconf) — no path to check, always try
  const gnome = readGnomeTerminal();
  if (gnome) return gnome;

  return null;
}

/* ── Color parsers ── */

function hex6(s: string): string | null {
  const m = s.trim().match(/^#?([0-9a-fA-F]{6})$/);
  return m ? `#${m[1].toLowerCase()}` : null;
}

function hexDefault(s: string, fallback: string): string {
  return hex6(s) ?? fallback;
}

/* ── Generic conf parser (key = value, # comments) ── */

function parseConfFile(filePath: string): Record<string, string> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    const cfg: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const sep = t.indexOf(" ");
      if (sep === -1) continue;
      cfg[t.slice(0, sep)] = t.slice(sep + 1).trim();
    }
    return cfg;
  } catch {
    return null;
  }
}

/* ── 1. Kitty ── */

function readKitty(): TerminalColors | null {
  const cfg = parseConfFile(path.join(os.homedir(), ".config", "kitty", "kitty.conf"));
  if (!cfg) return null;
  const bg = hex6(cfg.background ?? "");
  const fg = hex6(cfg.foreground ?? "");
  if (!bg || !fg) return null;
  const ansi: string[] = [];
  for (let i = 0; i <= 15; i++) ansi.push(hexDefault(cfg[`color${i}`] ?? "", i < 8 ? "#555555" : "#aaaaaa"));
  const font = cfg.font_family || undefined;
  const fontSize = cfg.font_size ? `${cfg.font_size}px` : undefined;
  return { bg, fg, ansi, font, fontSize, source: "kitty" };
}

/* ── 2. Gnome Terminal (dconf) ── */

function readGnomeTerminal(): TerminalColors | null {
  if (os.platform() !== "linux") return null;
  try {
    const profile = execSync("dconf read /org/gnome/terminal/legacy/profiles:/default", { encoding: "utf-8", timeout: 2000, stdio: ["ignore", "pipe", "ignore"] }).trim().replace(/^'|'$/g, "");
    if (!profile) return null;
    const base = `/org/gnome/terminal/legacy/profiles:/:${profile}/`;
    const useTheme = execSync(`dconf read ${base}use-theme-colors`, { encoding: "utf-8", timeout: 1000, stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (useTheme === "true") return null;

    const bg = hex6(execSync(`dconf read ${base}background-color`, { encoding: "utf-8", timeout: 1000, stdio: ["ignore", "pipe", "ignore"] }).trim().replace(/^'|'$/g, ""));
    const fg = hex6(execSync(`dconf read ${base}foreground-color`, { encoding: "utf-8", timeout: 1000, stdio: ["ignore", "pipe", "ignore"] }).trim().replace(/^'|'$/g, ""));
    if (!bg || !fg) return null;

    const paletteRaw = execSync(`dconf read ${base}palette`, { encoding: "utf-8", timeout: 1000, stdio: ["ignore", "pipe", "ignore"] }).trim().replace(/^\[|]$/g, "");
    const ansi: string[] = [];
    if (paletteRaw) {
      const parts = paletteRaw.split("),");
      for (let i = 0; i < 16 && i < parts.length; i++) {
        const m = parts[i].match(/rgb\((\d+),\s*(\d+),\s*(\d+)/);
        ansi.push(m ? `#${parseInt(m[1]).toString(16).padStart(2, "0")}${parseInt(m[2]).toString(16).padStart(2, "0")}${parseInt(m[3]).toString(16).padStart(2, "0")}` : (i < 8 ? "#555555" : "#aaaaaa"));
      }
    }
    while (ansi.length < 16) ansi.push(ansi.length < 8 ? "#555555" : "#aaaaaa");

    const fontRaw = execSync(`dconf read ${base}font`, { encoding: "utf-8", timeout: 1000, stdio: ["ignore", "pipe", "ignore"] }).trim().replace(/^'|'$/g, "");
    let font: string | undefined;
    let fontSize: string | undefined;
    if (fontRaw) { const fp = fontRaw.split(" "); font = fp[0] || undefined; if (fp[1]) fontSize = /px$/i.test(fp[1]) ? fp[1] : `${fp[1]}px`; }

    return { bg, fg, ansi, font, fontSize, source: "gnome-terminal" };
  } catch { return null; }
}

/* ── 3. Alacritty (TOML / YAML) ── */

function readAlacritty(): TerminalColors | null {
  for (const file of ["alacritty.toml", "alacritty.yml"]) {
    const p = path.join(os.homedir(), ".config", "alacritty", file);
    if (!fs.existsSync(p)) continue;
    try {
      const raw = fs.readFileSync(p, "utf-8");
      const cfg: Record<string, string> = {};
      for (const line of raw.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const sep = t.indexOf(":");
        if (sep === -1) continue;
        cfg[t.slice(0, sep).trim()] = t.slice(sep + 1).trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
      }
      const bg = hex6(cfg.background ?? cfg["colors.primary.background"] ?? "");
      const fg = hex6(cfg.foreground ?? cfg["colors.primary.foreground"] ?? "");
      if (!bg || !fg) continue;

      const ansiKeys = ["black","red","green","yellow","blue","magenta","cyan","white"];
      const ansi: string[] = [];
      for (const key of ansiKeys) {
        ansi.push(hexDefault(cfg[`colors.normal.${key}`] ?? "", ansi.length < 8 ? "#555555" : "#aaaaaa"));
      }
      for (const key of ansiKeys) {
        ansi.push(hexDefault(cfg[`colors.bright.${key}`] ?? "", ansi.length < 16 ? "#aaaaaa" : "#aaaaaa"));
      }
      return { bg, fg, ansi, source: "alacritty" };
    } catch { continue; }
  }
  return null;
}

/* ── 4. WezTerm (TOML) ── */

function readWezTerm(): TerminalColors | null {
  const paths = [
    path.join(os.homedir(), ".config", "wezterm", "wezterm.lua"),
    path.join(os.homedir(), ".config", "wezterm", "wezterm.toml"),
  ];
  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    try {
      const raw = fs.readFileSync(p, "utf-8");
      // Extract color_xxx = "#xxxxxx" or foreground = "#xxxxxx"
      const colorRE = /(?:foreground|background|color_\w+)\s*[=:]\s*"?(#[0-9a-fA-F]{6})"?/g;
      const colors: string[] = [];
      for (const match of raw.matchAll(colorRE)) {
        colors.push(match[1].toLowerCase());
      }
      // WezTerm has named colors, not indexed. Map what we can.
      const fgRaw = raw.match(/(?:foreground)\s*[=:]\s*"?(#[0-9a-fA-F]{6})"?/i);
      const bgRaw = raw.match(/(?:background)\s*[=:]\s*"?(#[0-9a-fA-F]{6})"?/i);
      const fg = fgRaw ? hex6(fgRaw[1]) : null;
      const bg = bgRaw ? hex6(bgRaw[1]) : null;
      if (!fg || !bg) continue;
      const ansi = Array(16).fill("#aaaaaa");
      return { bg, fg, ansi, source: "wezterm" };
    } catch { continue; }
  }
  return null;
}

/* ── 5. Xfce4 Terminal ── */

function readXfce4(): TerminalColors | null {
  const p = path.join(os.homedir(), ".config", "xfce4", "terminal", "terminalrc");
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const cfg: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const [k, ...v] = line.split("=");
      if (k) cfg[k.trim()] = v.join("=").trim();
    }
    const bg = hex6(cfg.ColorBackground ?? "");
    const fg = hex6(cfg.ColorForeground ?? "");
    if (!bg || !fg) return null;
    const ansiPalette = cfg.ColorPalette ?? "";
    const parts = ansiPalette.split(";");
    const ansi: string[] = [];
    for (let i = 0; i < 16; i++) {
      ansi.push(hexDefault(parts[i] ?? "", i < 8 ? "#555555" : "#aaaaaa"));
    }
    return { bg, fg, ansi, source: "xfce4-terminal" };
  } catch { return null; }
}

/* ── 6. LXTerminal ── */

function readLxterminal(): TerminalColors | null {
  const p = path.join(os.homedir(), ".config", "lxterminal", "lxterminal.conf");
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, "utf-8");
    // INI-style: [general], key=value
    const cfg: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("[") || t.startsWith("#")) continue;
      const sep = t.indexOf("=");
      if (sep === -1) continue;
      cfg[t.slice(0, sep).trim()] = t.slice(sep + 1).trim();
    }
    const bg = hex6(cfg.bgcolor ?? "");
    const fg = hex6(cfg.fgcolor ?? "");
    if (!bg || !fg) return null;
    const ansi: string[] = [];
    const palette = cfg.palette ?? "";
    const parts = palette.split(";");
    for (let i = 0; i < 16; i++) ansi.push(hexDefault(parts[i] ?? "", i < 8 ? "#555555" : "#aaaaaa"));
    return { bg, fg, ansi, source: "lxterminal" };
  } catch { return null; }
}

/* ── 7. Environment fallback ── */

function readColorFgBg(): TerminalColors | null {
  const colorFgBg = process.env.COLORFGBG;
  if (!colorFgBg) return null;
  const parts = colorFgBg.split(";");
  const fgIdx = parseInt(parts[0], 10);
  const bgIdx = parseInt(parts[parts.length - 1], 10);
  if (Number.isNaN(fgIdx) || Number.isNaN(bgIdx)) return null;
  const xtermPalette = [
    "#000000", "#cd0000", "#00cd00", "#cdcd00",
    "#0000cd", "#cd00cd", "#00cdcd", "#e5e5e5",
    "#7f7f7f", "#ff0000", "#00ff00", "#ffff00",
    "#0000ff", "#ff00ff", "#00ffff", "#ffffff",
  ];
  return { bg: xtermPalette[bgIdx] ?? "#000000", fg: xtermPalette[fgIdx] ?? "#e5e5e5", ansi: [...xtermPalette], source: "colorFgBg" };
}

/**
 * Convert TerminalColors into ThemeColors-compatible overrides.
 * Fields not present in TerminalColors keep their theme values.
 */
export function terminalColorsToThemeOverrides(
  tc: TerminalColors,
): Partial<{
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
}> {
  const a = tc.ansi;
  return {
    bg: tc.bg,
    text: tc.fg,
    green: a[2] ?? "#00cd00",
    red: a[1] ?? "#cd0000",
    blue: a[4] ?? "#0000cd",
    yellow: a[3] ?? "#cdcd00",
    cyan: a[6] ?? "#00cdcd",
    gray: a[8] ?? a[7] ?? "#7f7f7f",
    orange: a[11] ?? a[3] ?? "#cdcd00",
    font: tc.font,
    fontSize: tc.fontSize,
  };
}
