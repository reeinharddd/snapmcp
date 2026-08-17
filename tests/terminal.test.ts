import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { mock } from "bun:test";

// Mock node:child_process BEFORE importing the module under test so the
// execSync used inside src/terminal.js is intercepted (bun registry mock).
const execSyncResults = new Map<string, string | Error>();
mock.module("node:child_process", () => ({
  execSync: (cmd: string) => {
    const found = execSyncResults.get(cmd);
    if (found instanceof Error) throw found;
    if (found !== undefined) return found;
    throw new Error("Command not mocked");
  },
}));

const { detectTerminalTheme, detectTerminalColors, resetTerminalColorsCache, isDarkTheme } = await import("../src/terminal.js");

const originalHomedir = os.homedir;
const originalPlatformOfOs = os.platform;

function setPlatform(p: NodeJS.Platform) {
  Object.defineProperty(process, "platform", { value: p });
  Object.defineProperty(os, "platform", { value: () => p, configurable: true });
}

function restorePlatform(original: NodeJS.Platform) {
  Object.defineProperty(process, "platform", { value: original });
  Object.defineProperty(os, "platform", { value: originalPlatformOfOs, configurable: true });
}

describe("detectTerminalTheme", () => {
  let originalPlatform: NodeJS.Platform;
  let originalEnv: NodeJS.ProcessEnv;

  before(() => {
    originalPlatform = process.platform;
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    execSyncResults.clear();
    delete process.env.COLORFGBG;
    delete process.env.TERM;
  });

  after(() => {
    restorePlatform(originalPlatform);
    process.env = originalEnv;
    execSyncResults.clear();
  });

  it("should use COLORFGBG when fg=15 bg=0 (black background → dark)", () => {
    process.env.COLORFGBG = "15;0";
    const result = detectTerminalTheme();
    assert.equal(result.theme, "dark-plus");
    assert.equal(result.isDark, true);
    assert.equal(result.source, "colorFgBg");
  });

  it("should use COLORFGBG when fg=0 bg=7 (white background → light)", () => {
    process.env.COLORFGBG = "0;7";
    const result = detectTerminalTheme();
    assert.equal(result.theme, "github-light");
    assert.equal(result.isDark, false);
    assert.equal(result.source, "colorFgBg");
  });

  it("should fall back when COLORFGBG is invalid", () => {
    process.env.COLORFGBG = "invalid";
    const result = detectTerminalTheme();
    assert.equal(result.theme, "dark-plus");
    assert.equal(result.isDark, true);
    assert.equal(result.source, "fallback");
  });

  it("should use TERM=linux for light theme", () => {
    process.env.TERM = "linux";
    const result = detectTerminalTheme();
    assert.equal(result.theme, "github-light");
    assert.equal(result.isDark, false);
    assert.equal(result.source, "termEnv");
  });

  it("should detect gsettings color-scheme on Linux", () => {
    setPlatform("linux");
    delete process.env.COLORFGBG;
    delete process.env.TERM;
    execSyncResults.set(
      "gsettings get org.gnome.desktop.interface color-scheme",
      "'prefer-dark'",
    );
    const result = detectTerminalTheme();
    assert.equal(result.theme, "dark-plus");
    assert.equal(result.isDark, true);
    assert.equal(result.source, "os-gsettings-color-scheme");
  });

  it("should detect gsettings gtk-theme on Linux", () => {
    setPlatform("linux");
    delete process.env.COLORFGBG;
    delete process.env.TERM;
    execSyncResults.set(
      "gsettings get org.gnome.desktop.interface gtk-theme",
      "'Adwaita-dark'",
    );
    const result = detectTerminalTheme();
    assert.equal(result.theme, "dark-plus");
    assert.equal(result.isDark, true);
    assert.equal(result.source, "os-gsettings-gtk-theme");
  });

  it("should detect dconf on Linux", () => {
    setPlatform("linux");
    delete process.env.COLORFGBG;
    delete process.env.TERM;
    execSyncResults.set(
      "dconf read /org/gnome/desktop/interface/color-scheme",
      "'prefer-dark'",
    );
    const result = detectTerminalTheme();
    assert.equal(result.theme, "dark-plus");
    assert.equal(result.isDark, true);
    assert.equal(result.source, "os-dconf");
  });

  it("should detect GTK4 settings.ini on Linux", () => {
    setPlatform("linux");
    delete process.env.COLORFGBG;
    delete process.env.TERM;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-test-"));
    const gtkDir = path.join(tmpDir, ".config", "gtk-4.0");
    fs.mkdirSync(gtkDir, { recursive: true });
    fs.writeFileSync(
      path.join(gtkDir, "settings.ini"),
      "[Settings]\ngtk-application-prefer-dark-theme=1",
    );

    Object.defineProperty(os, "homedir", { value: () => tmpDir, configurable: true });

    try {
      const result = detectTerminalTheme();
      assert.equal(result.theme, "dark-plus");
      assert.equal(result.isDark, true);
      assert.equal(result.source, "os-gtk-ini");
    } finally {
      Object.defineProperty(os, "homedir", { value: originalHomedir, configurable: true });
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should detect macOS dark mode", () => {
    setPlatform("darwin");
    delete process.env.COLORFGBG;
    delete process.env.TERM;
    execSyncResults.set("defaults read -g AppleInterfaceStyle", "Dark");
    const result = detectTerminalTheme();
    assert.equal(result.theme, "dark-plus");
    assert.equal(result.isDark, true);
    assert.equal(result.source, "os-macos-defaults");
  });

  it("should detect Windows dark mode", () => {
    setPlatform("win32");
    delete process.env.COLORFGBG;
    delete process.env.TERM;
    execSyncResults.set(
      "reg query HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize /v AppsUseLightTheme",
      "AppsUseLightTheme    REG_DWORD    0x0",
    );
    const result = detectTerminalTheme();
    assert.equal(result.theme, "dark-plus");
    assert.equal(result.isDark, true);
    assert.equal(result.source, "os-windows-registry");
  });

  it("should use custom fallback theme", () => {
    const result = detectTerminalTheme("github-light");
    assert.equal(result.theme, "github-light");
    assert.equal(result.isDark, false);
    assert.equal(result.source, "fallback");
  });
});

describe("isDarkTheme", () => {
  it("should return true for dark themes", () => {
    assert.equal(isDarkTheme("dark-plus"), true);
    assert.equal(isDarkTheme("monokai"), true);
    assert.equal(isDarkTheme("my-dark-theme"), true);
  });

  it("should return false for light themes", () => {
    assert.equal(isDarkTheme("github-light"), false);
    assert.equal(isDarkTheme("solarized-light"), false);
    assert.equal(isDarkTheme("my-light-theme"), false);
  });
});

describe("detectTerminalColors", () => {
  let tmpDir: string;
  let originalPlatform: NodeJS.Platform;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-colors-test-"));
    originalPlatform = process.platform;
  });

  beforeEach(() => {
    resetTerminalColorsCache();
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    resetTerminalColorsCache();
    restorePlatform(originalPlatform);
    execSyncResults.clear();
  });

  it("should detect kitty colors", () => {
    // Force "not linux" so process-tree detection is skipped; kitty.conf is
    // read via os.homedir() which we override to a temp dir.
    setPlatform("darwin");
    const kittyDir = path.join(tmpDir, ".config", "kitty");
    fs.mkdirSync(kittyDir, { recursive: true });
    fs.writeFileSync(
      path.join(kittyDir, "kitty.conf"),
      "background #121212\nforeground #e0e0e0\ncolor0 #000000\ncolor1 #ff0000",
    );

    Object.defineProperty(os, "homedir", { value: () => tmpDir, configurable: true });
    resetTerminalColorsCache();

    try {
      const result = detectTerminalColors();
      assert.ok(result);
      assert.equal(result?.bg, "#121212");
      assert.equal(result?.fg, "#e0e0e0");
      assert.equal(result?.source, "kitty");
    } finally {
      Object.defineProperty(os, "homedir", { value: originalHomedir, configurable: true });
    }
  });

  it("should detect alacritty colors", () => {
    setPlatform("darwin");
    const colorTmp = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-alacritty-test-"));
    const alacrittyDir = path.join(colorTmp, ".config", "alacritty");
    fs.mkdirSync(alacrittyDir, { recursive: true });
    fs.writeFileSync(
      path.join(alacrittyDir, "alacritty.yml"),
      "colors:\n  primary:\n    background: '#121212'\n    foreground: '#e0e0e0'\n  normal:\n    black: '#000000'\n    red: '#ff0000'",
    );

    Object.defineProperty(os, "homedir", { value: () => colorTmp, configurable: true });
    resetTerminalColorsCache();

    try {
      const result = detectTerminalColors();
      assert.ok(result);
      assert.equal(result?.bg, "#121212");
      assert.equal(result?.fg, "#e0e0e0");
      assert.equal(result?.source, "alacritty");
    } finally {
      Object.defineProperty(os, "homedir", { value: originalHomedir, configurable: true });
      fs.rmSync(colorTmp, { recursive: true, force: true });
    }
  });

  it("should detect COLORFGBG colors", () => {
    setPlatform("darwin");
    Object.defineProperty(os, "homedir", { value: originalHomedir, configurable: true });
    const originalColorFgBg = process.env.COLORFGBG;
    process.env.COLORFGBG = "7;0";
    resetTerminalColorsCache();

    try {
      const result = detectTerminalColors();
      assert.ok(result);
      assert.equal(result?.bg, "#000000");
      assert.equal(result?.fg, "#e5e5e5");
      assert.equal(result?.source, "colorFgBg");
    } finally {
      process.env.COLORFGBG = originalColorFgBg;
    }
  });

  it("should cache results", () => {
    setPlatform("darwin");
    const originalColorFgBg = process.env.COLORFGBG;
    process.env.COLORFGBG = "7;0";
    resetTerminalColorsCache();

    try {
      const result1 = detectTerminalColors();
      const result2 = detectTerminalColors();
      assert.strictEqual(result1, result2);
    } finally {
      process.env.COLORFGBG = originalColorFgBg;
    }
  });

  it("should reset cache", () => {
    setPlatform("darwin");
    const originalColorFgBg = process.env.COLORFGBG;
    process.env.COLORFGBG = "7;0";

    try {
      const result1 = detectTerminalColors();
      resetTerminalColorsCache();
      const result2 = detectTerminalColors();
      assert.notStrictEqual(result1, result2);
    } finally {
      process.env.COLORFGBG = originalColorFgBg;
    }
  });
});