import { describe, it } from "node:test";
import assert from "node:assert";
import { loadConfig, formatExt, THEME_LIST } from "../src/config.js";

function withCleanEnv<T>(fn: () => T): T {
  const saved = { ...process.env };
  try {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("SNAPMCP_")) delete process.env[key];
    }
    return fn();
  } finally {
    Object.assign(process.env, saved);
  }
}

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[`SNAPMCP_${key}`];
  } else {
    process.env[`SNAPMCP_${key}`] = value;
  }
}

describe("loadConfig", () => {
  it("returns defaults when no env vars are set", () => {
    withCleanEnv(() => {
      const cfg = loadConfig();

      assert.equal(cfg.outputDir, "./snapshots");
      assert.equal(cfg.format, "png");
      assert.equal(cfg.quality, 90);
      assert.equal(cfg.theme, "dark-plus");
      assert.equal(cfg.fontSize, "14px");
      assert.equal(cfg.timeout, 30000);
      assert.equal(cfg.deviceScale, 2);
      assert.equal(cfg.cleanupMax, 0);
      assert.equal(cfg.logLevel, "info");
      assert.deepEqual(cfg.allowedPaths, []);
      assert.equal(cfg.maxFileSize, 5_000_000);
      assert.equal(cfg.securityChecks, true);
      assert.equal(cfg.padding, 32);
      assert.equal(cfg.shadow, "soft");
      assert.equal(cfg.windowChrome, true);
      assert.equal(cfg.borderRadius, 8);
      assert.equal(cfg.badge, false);
    });
  });

  it("reads SNAPMCP_FORMAT=jpeg", () => {
    setEnv("FORMAT", "jpeg");
    try {
      assert.equal(loadConfig().format, "jpeg");
    } finally {
      setEnv("FORMAT", undefined);
    }
  });

  it("reads SNAPMCP_DIR", () => {
    setEnv("DIR", "/custom/path");
    try {
      assert.equal(loadConfig().outputDir, "/custom/path");
    } finally {
      setEnv("DIR", undefined);
    }
  });

  it("reads SNAPMCP_THEME", () => {
    setEnv("THEME", "nord");
    try {
      assert.equal(loadConfig().theme, "nord");
    } finally {
      setEnv("THEME", undefined);
    }
  });

  it("reads SNAPMCP_FONT_SIZE", () => {
    setEnv("FONT_SIZE", "16px");
    try {
      assert.equal(loadConfig().fontSize, "16px");
    } finally {
      setEnv("FONT_SIZE", undefined);
    }
  });

  it("reads SNAPMCP_LOG_LEVEL", () => {
    setEnv("LOG_LEVEL", "debug");
    try {
      assert.equal(loadConfig().logLevel, "debug");
    } finally {
      setEnv("LOG_LEVEL", undefined);
    }
  });

  it("reads SNAPMCP_DEVICE_SCALE", () => {
    setEnv("DEVICE_SCALE", "3");
    try {
      assert.equal(loadConfig().deviceScale, 3);
    } finally {
      setEnv("DEVICE_SCALE", undefined);
    }
  });

  it("reads SNAPMCP_TIMEOUT", () => {
    setEnv("TIMEOUT", "5000");
    try {
      assert.equal(loadConfig().timeout, 5000);
    } finally {
      setEnv("TIMEOUT", undefined);
    }
  });

  it("reads SNAPMCP_PADDING", () => {
    setEnv("PADDING", "48");
    try {
      assert.equal(loadConfig().padding, 48);
    } finally {
      setEnv("PADDING", undefined);
    }
  });

  it("reads SNAPMCP_SHADOW", () => {
    setEnv("SHADOW", "strong");
    try {
      assert.equal(loadConfig().shadow, "strong");
    } finally {
      setEnv("SHADOW", undefined);
    }
  });

  it("reads SNAPMCP_WINDOW_CHROME", () => {
    setEnv("WINDOW_CHROME", "false");
    try {
      assert.equal(loadConfig().windowChrome, false);
    } finally {
      setEnv("WINDOW_CHROME", undefined);
    }
  });

  it("reads SNAPMCP_BORDER_RADIUS", () => {
    setEnv("BORDER_RADIUS", "16");
    try {
      assert.equal(loadConfig().borderRadius, 16);
    } finally {
      setEnv("BORDER_RADIUS", undefined);
    }
  });

  it("reads SNAPMCP_BADGE", () => {
    setEnv("BADGE", "true");
    try {
      assert.equal(loadConfig().badge, true);
    } finally {
      setEnv("BADGE", undefined);
    }
  });

  it("reads SNAPMCP_CLEANUP_MAX", () => {
    setEnv("CLEANUP_MAX", "10");
    try {
      assert.equal(loadConfig().cleanupMax, 10);
    } finally {
      setEnv("CLEANUP_MAX", undefined);
    }
  });

  it("reads SNAPMCP_MAX_FILE_SIZE", () => {
    setEnv("MAX_FILE_SIZE", "1048576");
    try {
      assert.equal(loadConfig().maxFileSize, 1048576);
    } finally {
      setEnv("MAX_FILE_SIZE", undefined);
    }
  });

  it("reads SNAPMCP_SECURITY_CHECKS", () => {
    setEnv("SECURITY_CHECKS", "false");
    try {
      assert.equal(loadConfig().securityChecks, false);
    } finally {
      setEnv("SECURITY_CHECKS", undefined);
    }
  });

  // ─── Boolean parsing ────────────────────────────────────────

  it('parses SNAPMCP_WINDOW_CHROME="1" as true', () => {
    setEnv("WINDOW_CHROME", "1");
    try {
      assert.equal(loadConfig().windowChrome, true);
    } finally {
      setEnv("WINDOW_CHROME", undefined);
    }
  });

  it('parses SNAPMCP_WINDOW_CHROME="true" as true', () => {
    setEnv("WINDOW_CHROME", "true");
    try {
      assert.equal(loadConfig().windowChrome, true);
    } finally {
      setEnv("WINDOW_CHROME", undefined);
    }
  });

  it('parses SNAPMCP_WINDOW_CHROME="yes" as true', () => {
    setEnv("WINDOW_CHROME", "yes");
    try {
      assert.equal(loadConfig().windowChrome, true);
    } finally {
      setEnv("WINDOW_CHROME", undefined);
    }
  });

  it('parses SNAPMCP_WINDOW_CHROME="0" as false', () => {
    setEnv("WINDOW_CHROME", "0");
    try {
      assert.equal(loadConfig().windowChrome, false);
    } finally {
      setEnv("WINDOW_CHROME", undefined);
    }
  });

  it('parses SNAPMCP_WINDOW_CHROME="false" as false', () => {
    setEnv("WINDOW_CHROME", "false");
    try {
      assert.equal(loadConfig().windowChrome, false);
    } finally {
      setEnv("WINDOW_CHROME", undefined);
    }
  });

  it('parses SNAPMCP_WINDOW_CHROME="no" as false', () => {
    setEnv("WINDOW_CHROME", "no");
    try {
      assert.equal(loadConfig().windowChrome, false);
    } finally {
      setEnv("WINDOW_CHROME", undefined);
    }
  });

  it('parses SNAPMCP_WINDOW_CHROME="" as false', () => {
    setEnv("WINDOW_CHROME", "");
    try {
      assert.equal(loadConfig().windowChrome, false);
    } finally {
      setEnv("WINDOW_CHROME", undefined);
    }
  });

  it("parses SNAPMCP_BADGE as boolean (same function path)", () => {
    setEnv("BADGE", "1");
    try {
      assert.equal(loadConfig().badge, true);
    } finally {
      setEnv("BADGE", undefined);
    }
  });

  // ─── parseShadow ────────────────────────────────────────────

  it('parses SNAPMCP_SHADOW="none" as none', () => {
    setEnv("SHADOW", "none");
    try {
      assert.equal(loadConfig().shadow, "none");
    } finally {
      setEnv("SHADOW", undefined);
    }
  });

  it('parses SNAPMCP_SHADOW="soft" as soft', () => {
    setEnv("SHADOW", "soft");
    try {
      assert.equal(loadConfig().shadow, "soft");
    } finally {
      setEnv("SHADOW", undefined);
    }
  });

  it('parses SNAPMCP_SHADOW="medium" as medium', () => {
    setEnv("SHADOW", "medium");
    try {
      assert.equal(loadConfig().shadow, "medium");
    } finally {
      setEnv("SHADOW", undefined);
    }
  });

  it('parses SNAPMCP_SHADOW="strong" as strong', () => {
    setEnv("SHADOW", "strong");
    try {
      assert.equal(loadConfig().shadow, "strong");
    } finally {
      setEnv("SHADOW", undefined);
    }
  });

  it('parses SNAPMCP_SHADOW="invalid" as soft (fallback)', () => {
    setEnv("SHADOW", "invalid");
    try {
      assert.equal(loadConfig().shadow, "soft");
    } finally {
      setEnv("SHADOW", undefined);
    }
  });

  // ─── formatExt ──────────────────────────────────────────────

  it('formatExt("png") returns "png"', () => {
    assert.equal(formatExt("png"), "png");
  });

  it('formatExt("jpeg") returns "jpg"', () => {
    assert.equal(formatExt("jpeg"), "jpg");
  });

  // ─── Clamping: borderRadius ─────────────────────────────────

  it("clamps borderRadius 0 → 0", () => {
    setEnv("BORDER_RADIUS", "0");
    try {
      assert.equal(loadConfig().borderRadius, 0);
    } finally {
      setEnv("BORDER_RADIUS", undefined);
    }
  });

  it("clamps borderRadius 32 → 32", () => {
    setEnv("BORDER_RADIUS", "32");
    try {
      assert.equal(loadConfig().borderRadius, 32);
    } finally {
      setEnv("BORDER_RADIUS", undefined);
    }
  });

  it("clamps borderRadius 50 → 32 (max)", () => {
    setEnv("BORDER_RADIUS", "50");
    try {
      assert.equal(loadConfig().borderRadius, 32);
    } finally {
      setEnv("BORDER_RADIUS", undefined);
    }
  });

  it("clamps borderRadius -5 → 0 (min)", () => {
    setEnv("BORDER_RADIUS", "-5");
    try {
      assert.equal(loadConfig().borderRadius, 0);
    } finally {
      setEnv("BORDER_RADIUS", undefined);
    }
  });

  // ─── Clamping: quality ──────────────────────────────────────

  it("clamps quality 1 → 1", () => {
    setEnv("QUALITY", "1");
    try {
      assert.equal(loadConfig().quality, 1);
    } finally {
      setEnv("QUALITY", undefined);
    }
  });

  it("clamps quality 100 → 100", () => {
    setEnv("QUALITY", "100");
    try {
      assert.equal(loadConfig().quality, 100);
    } finally {
      setEnv("QUALITY", undefined);
    }
  });

  it("clamps quality 999 → 100", () => {
    setEnv("QUALITY", "999");
    try {
      assert.equal(loadConfig().quality, 100);
    } finally {
      setEnv("QUALITY", undefined);
    }
  });

  it("clamps quality 0 → 1", () => {
    setEnv("QUALITY", "0");
    try {
      assert.equal(loadConfig().quality, 1);
    } finally {
      setEnv("QUALITY", undefined);
    }
  });

  // ─── Clamping: timeout ──────────────────────────────────────

  it("clamps timeout minimum to 1000", () => {
    setEnv("TIMEOUT", "100");
    try {
      assert.equal(loadConfig().timeout, 1000);
    } finally {
      setEnv("TIMEOUT", undefined);
    }
  });

  it("keeps timeout 50000 as-is", () => {
    setEnv("TIMEOUT", "50000");
    try {
      assert.equal(loadConfig().timeout, 50000);
    } finally {
      setEnv("TIMEOUT", undefined);
    }
  });

  // ─── Clamping: deviceScale ──────────────────────────────────

  it("clamps deviceScale 0 → 1", () => {
    setEnv("DEVICE_SCALE", "0");
    try {
      assert.equal(loadConfig().deviceScale, 1);
    } finally {
      setEnv("DEVICE_SCALE", undefined);
    }
  });

  it("clamps deviceScale -1 → 1", () => {
    setEnv("DEVICE_SCALE", "-1");
    try {
      assert.equal(loadConfig().deviceScale, 1);
    } finally {
      setEnv("DEVICE_SCALE", undefined);
    }
  });

  // ─── Clamping: padding ──────────────────────────────────────

  it("clamps padding -10 → 0", () => {
    setEnv("PADDING", "-10");
    try {
      assert.equal(loadConfig().padding, 0);
    } finally {
      setEnv("PADDING", undefined);
    }
  });

  // ─── ALLOWED_PATHS ──────────────────────────────────────────

  it("parses semicolon-separated ALLOWED_PATHS", () => {
    setEnv("ALLOWED_PATHS", "/tmp;/var/log;/home/user");
    try {
      assert.deepEqual(loadConfig().allowedPaths, ["/tmp", "/var/log", "/home/user"]);
    } finally {
      setEnv("ALLOWED_PATHS", undefined);
    }
  });

  it("parses ALLOWED_PATHS with trailing spaces", () => {
    setEnv("ALLOWED_PATHS", "/tmp ; /var/log");
    try {
      assert.deepEqual(loadConfig().allowedPaths, ["/tmp", "/var/log"]);
    } finally {
      setEnv("ALLOWED_PATHS", undefined);
    }
  });

  it("parses empty ALLOWED_PATHS as empty array", () => {
    setEnv("ALLOWED_PATHS", "");
    try {
      assert.deepEqual(loadConfig().allowedPaths, []);
    } finally {
      setEnv("ALLOWED_PATHS", undefined);
    }
  });

  it("default ALLOWED_PATHS is empty array", () => {
    withCleanEnv(() => {
      assert.deepEqual(loadConfig().allowedPaths, []);
    });
  });

  // ─── Clamping: cleanupMax ───────────────────────────────────

  it("clamps cleanupMax -1 → 0", () => {
    setEnv("CLEANUP_MAX", "-1");
    try {
      assert.equal(loadConfig().cleanupMax, 0);
    } finally {
      setEnv("CLEANUP_MAX", undefined);
    }
  });

  // ─── Clamping: maxFileSize ──────────────────────────────────

  it("clamps maxFileSize 0 → 1024", () => {
    setEnv("MAX_FILE_SIZE", "0");
    try {
      assert.equal(loadConfig().maxFileSize, 1024);
    } finally {
      setEnv("MAX_FILE_SIZE", undefined);
    }
  });

  it("clamps maxFileSize 1 → 1024", () => {
    setEnv("MAX_FILE_SIZE", "1");
    try {
      assert.equal(loadConfig().maxFileSize, 1024);
    } finally {
      setEnv("MAX_FILE_SIZE", undefined);
    }
  });

  // ─── Non-numeric envInt ─────────────────────────────────────

  it("non-numeric QUALITY falls back to default", () => {
    setEnv("QUALITY", "abc");
    try {
      assert.equal(loadConfig().quality, 90);
    } finally {
      setEnv("QUALITY", undefined);
    }
  });
});

describe("formatExt", () => {
  it('returns "png" for png format', () => {
    assert.equal(formatExt("png"), "png");
  });

  it('returns "jpg" for jpeg format', () => {
    assert.equal(formatExt("jpeg"), "jpg");
  });
});

describe("THEME_LIST", () => {
  it("has at least 20 themes", () => {
    assert.ok(THEME_LIST.length >= 20, `Expected >=20, got ${THEME_LIST.length}`);
  });

  it("all themes are unique", () => {
    const unique = new Set(THEME_LIST);
    assert.equal(unique.size, THEME_LIST.length, "Duplicate themes found");
  });

  it("includes dark-plus (the default)", () => {
    assert.ok(THEME_LIST.includes("dark-plus"));
  });

  it("includes popular themes", () => {
    const popular = ["dracula", "nord", "monokai", "github-dark", "solarized-dark", "tokyo-night"];
    for (const name of popular) {
      assert.ok(THEME_LIST.includes(name), `Missing theme: ${name}`);
    }
  });
});
