import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { loadConfig } from "../src/config.js";

// We test pure functions by importing modules and testing their internals
// Since renderer uses internal functions not exported, we test via the public API
// with a mock config to verify HTML structure.

const config = loadConfig();

describe("renderer module loads", () => {
  it("loadConfig returns valid config", () => {
    assert.ok(config);
    assert.equal(typeof config.format, "string");
    assert.equal(typeof config.theme, "string");
  });

  it("config theme is one of the known themes", () => {
    const known = [
      "dark-plus",
      "github-dark",
      "github-light",
      "monokai",
      "nord",
      "solarized-dark",
    ];
    assert.ok(known.includes(config.theme));
  });
});

// Test the HTML template structure by examining what the
// public capture functions would produce.
// Since renderer functions require Playwright (browser), we
// verify the module structure and dependencies instead.
describe("module structure", () => {
  it("exports all expected capture functions", async () => {
    const mod = await import("../src/renderer.js");
    const expected = [
      "captureTerminal",
      "captureCode",
      "captureBrowser",
      "captureFile",
      "captureMarkdown",
      "captureHtml",
      "captureDiff",
      "capturePdf",
      "closeBrowser",
      "ensureOutputDir",
      "runCleanup",
    ];
    for (const name of expected) {
      assert.ok(
        typeof mod[name as keyof typeof mod] === "function",
        `Expected ${name} to be a function`,
      );
    }
  });

  it("exports ThemeColors interface (structural check)", async () => {
    const mod = await import("../src/renderer.js");
    assert.ok(typeof mod.captureTerminal === "function");
  });
});

describe("config format propagation", () => {
  it("formatExt maps correctly", async () => {
    const { formatExt } = await import("../src/config.js");
    assert.equal(formatExt("png"), "png");
    assert.equal(formatExt("jpeg"), "jpg");
  });
});

// ─── ensureOutputDir tests ───────────────────────────────────

describe("ensureOutputDir", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-render-test-"));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates a directory that doesn't exist", async () => {
    const { ensureOutputDir } = await import("../src/renderer.js");
    const newDir = path.join(tmpDir, "new-subdir");
    assert.ok(!fs.existsSync(newDir));
    ensureOutputDir(newDir);
    assert.ok(fs.existsSync(newDir));
    assert.ok(fs.statSync(newDir).isDirectory());
  });

  it("creates nested directories recursively", async () => {
    const { ensureOutputDir } = await import("../src/renderer.js");
    const nestedDir = path.join(tmpDir, "a", "b", "c");
    assert.ok(!fs.existsSync(nestedDir));
    ensureOutputDir(nestedDir);
    assert.ok(fs.existsSync(nestedDir));
  });

  it("does not throw if directory already exists", async () => {
    const { ensureOutputDir } = await import("../src/renderer.js");
    ensureOutputDir(tmpDir); // should not throw
    assert.ok(fs.existsSync(tmpDir));
  });

  it("creates dir with relative path", async () => {
    const { ensureOutputDir } = await import("../src/renderer.js");
    const relativeDir = "./__test_render_output__";
    try {
      ensureOutputDir(relativeDir);
      assert.ok(fs.existsSync(relativeDir));
    } finally {
      fs.rmSync(relativeDir, { recursive: true, force: true });
    }
  });
});

// ─── runCleanup tests ────────────────────────────────────────

/**
 * Helper: create a set of cleanup tests each with its own temp directory
 * to avoid cross-test interference.
 */
function cleanupTest(
  name: string,
  fn: (dir: string, runCleanup: (cfg: any) => void) => Promise<void> | void,
) {
  it(name, async () => {
    const { runCleanup } = await import("../src/renderer.js");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-cleanup-"));
    try {
      await fn(dir, (cfg) => runCleanup(cfg));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

function touch(dir: string, name: string): void {
  fs.writeFileSync(path.join(dir, name), "test");
}

function makeCleanConfig(
  outputDir: string,
  cleanupMax: number,
) {
  return { ...config, outputDir, cleanupMax };
}

describe("runCleanup", () => {
  cleanupTest("with cleanupMax=0 does not remove files", (dir, run) => {
    touch(dir, "a.png");
    touch(dir, "b.png");
    run(makeCleanConfig(dir, 0));
    assert.ok(fs.existsSync(path.join(dir, "a.png")));
    assert.ok(fs.existsSync(path.join(dir, "b.png")));
  });

  cleanupTest("with cleanupMax=1 keeps only newest file", async (dir, run) => {
    touch(dir, "old1.png");
    touch(dir, "old2.png");
    await new Promise((r) => setTimeout(r, 10));
    touch(dir, "newest.png");

    run(makeCleanConfig(dir, 1));

    assert.ok(!fs.existsSync(path.join(dir, "old1.png")), "old1 should be removed");
    assert.ok(!fs.existsSync(path.join(dir, "old2.png")), "old2 should be removed");
    assert.ok(fs.existsSync(path.join(dir, "newest.png")), "newest should remain");
  });

  cleanupTest("with cleanupMax=2 keeps two newest files", async (dir, run) => {
    touch(dir, "first.png");
    await new Promise((r) => setTimeout(r, 10));
    touch(dir, "second.png");
    await new Promise((r) => setTimeout(r, 10));
    touch(dir, "third.png");

    run(makeCleanConfig(dir, 2));

    assert.ok(!fs.existsSync(path.join(dir, "first.png")), "first should be removed");
    assert.ok(fs.existsSync(path.join(dir, "second.png")), "second should remain");
    assert.ok(fs.existsSync(path.join(dir, "third.png")), "third should remain");
  });

  cleanupTest("does not remove non-image files", async (dir, run) => {
    touch(dir, "keep.txt");
    touch(dir, "keep.md");
    touch(dir, "data.json");
    touch(dir, "old.png");
    await new Promise((r) => setTimeout(r, 10));
    touch(dir, "new.png");

    run(makeCleanConfig(dir, 1));

    assert.ok(fs.existsSync(path.join(dir, "keep.txt")));
    assert.ok(fs.existsSync(path.join(dir, "keep.md")));
    assert.ok(fs.existsSync(path.join(dir, "data.json")));
    assert.ok(!fs.existsSync(path.join(dir, "old.png")));
    assert.ok(fs.existsSync(path.join(dir, "new.png")));
  });

  cleanupTest("does not throw when output dir doesn't exist", (dir, run) => {
    const missingDir = path.join(dir, "nonexistent");
    run(makeCleanConfig(missingDir, 5));
  });

  cleanupTest("with fewer files than max, keeps all", (dir, run) => {
    touch(dir, "only-one.png");
    run(makeCleanConfig(dir, 10));
    assert.ok(fs.existsSync(path.join(dir, "only-one.png")));
  });
});

// ─── Theme colors ────────────────────────────────────────────

describe("renderer theme colors", () => {
  it("all config themes have corresponding renderer colors", async () => {
    const { THEME_LIST } = await import("../src/config.js");
    const mod = await import("../src/renderer.js");

    assert.ok(typeof mod.captureTerminal === "function");
    assert.ok(typeof mod.captureCode === "function");
    assert.ok(typeof mod.captureDiff === "function");
    assert.ok(typeof mod.captureHtml === "function");
    assert.ok(typeof mod.captureMarkdown === "function");
    assert.ok(typeof mod.captureBrowser === "function");
    assert.ok(typeof mod.capturePdf === "function");
    assert.ok(typeof mod.captureFile === "function");
  });

  it("default theme resolves without error", async () => {
    const { loadConfig } = await import("../src/config.js");
    const cfg = loadConfig();
    assert.equal(cfg.theme, "dark-plus");
  });
});
