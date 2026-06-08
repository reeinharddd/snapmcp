import { describe, it } from "node:test";
import assert from "node:assert";
import { loadConfig, formatExt } from "../src/config.js";

describe("loadConfig", () => {
  it("returns defaults when no env vars are set", () => {
    // Save and clear env
    const saved = { ...process.env };
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("SNAPMCP_")) delete process.env[key];
    }

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

    // Restore
    Object.assign(process.env, saved);
  });

  it("reads SNAPMCP_FORMAT=jpeg", () => {
    process.env.SNAPMCP_FORMAT = "jpeg";
    const cfg = loadConfig();
    assert.equal(cfg.format, "jpeg");
    delete process.env.SNAPMCP_FORMAT;
  });

  it("clamps quality to 1-100", () => {
    process.env.SNAPMCP_QUALITY = "999";
    assert.equal(loadConfig().quality, 100);
    process.env.SNAPMCP_QUALITY = "0";
    assert.equal(loadConfig().quality, 1);
    delete process.env.SNAPMCP_QUALITY;
  });

  it("clamps timeout minimum to 1000", () => {
    process.env.SNAPMCP_TIMEOUT = "100";
    assert.equal(loadConfig().timeout, 1000);
    delete process.env.SNAPMCP_TIMEOUT;
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
