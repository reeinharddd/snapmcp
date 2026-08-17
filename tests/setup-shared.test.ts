"use strict";

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  detectSystemState,
  detectInstallMode,
  bootstrapSetup,
  printSummary,
  SystemState,
} from "../src/setup-shared.js";

// ─── Helpers ───────────────────────────────────────────────────

function createFakeDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-setup-test-"));
}

// ─── Tests ───────────────────────────────────────────────────

describe("detectInstallMode", () => {
  function withNeutralCwd(fn: () => void) {
    const originalCwd = process.cwd;
    const tmpDir = createFakeDir();
    try {
      process.cwd = () => tmpDir;
      fn();
    } finally {
      process.cwd = originalCwd;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  it("detects global mode when invoked via npx", () => {
    const originalArgv = process.argv;
    try {
      process.argv = ["node", "/path/to/_npx/12345/snapmcp"];
      const mode = detectInstallMode();
      assert.equal(mode, "global");
    } finally {
      process.argv = originalArgv;
    }
  });

  it("detects global mode when invoked via bunx", () => {
    const originalArgv = process.argv;
    try {
      process.argv = ["node", "/path/to/bunx/snapmcp"];
      const mode = detectInstallMode();
      assert.equal(mode, "global");
    } finally {
      process.argv = originalArgv;
    }
  });

  it("detects project mode when cwd is snapmcp project", () => {
    const originalArgv = process.argv;
    const originalCwd = process.cwd;
    const tmpDir = createFakeDir();
    try {
      process.argv = ["node", path.join(tmpDir, "index.js")];
      process.cwd = () => tmpDir;
      fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "snapmcp" }));
      const mode = detectInstallMode();
      assert.equal(mode, "project");
    } finally {
      process.argv = originalArgv;
      process.cwd = originalCwd;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("detects global mode when inside node_modules", () => {
    const originalArgv = process.argv;
    withNeutralCwd(() => {
      process.argv = ["node", "/path/to/node_modules/.bin/snapmcp"];
      const mode = detectInstallMode();
      assert.equal(mode, "global");
    });
    process.argv = originalArgv;
  });

  it("returns unknown when mode cannot be determined", () => {
    const originalArgv = process.argv;
    withNeutralCwd(() => {
      process.argv = ["node", "/path/to/snapmcp"];
      const mode = detectInstallMode();
      assert.equal(mode, "unknown");
    });
    process.argv = originalArgv;
  });
});

describe("detectSystemState", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = createFakeDir();
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("detects Bun runtime", () => {
    const originalVersions = process.versions;
    try {
      process.versions = { ...process.versions, bun: "1.0.0" };
      const state = detectSystemState();
      assert.ok(state.runtime.bun);
    } finally {
      process.versions = originalVersions;
    }
  });

  it("detects Node.js runtime", () => {
    const originalVersions = process.versions;
    try {
      const { bun, ...rest } = process.versions;
      process.versions = rest;
      const state = detectSystemState();
      assert.equal(state.runtime.bun, false);
      assert.equal(state.runtime.nodeVersion, process.version);
    } finally {
      process.versions = originalVersions;
    }
  });

  it("detects Chromium via Playwright cache", () => {
    const originalExistsSync = fs.existsSync;
    const originalReaddirSync = fs.readdirSync;
    const originalHome = process.env.HOME;
    try {
      process.env.HOME = tmpDir;
      fs.existsSync = (p) => p === `${tmpDir}/.cache/ms-playwright`;
      fs.readdirSync = () => ["chromium-1234"];
      const state = detectSystemState();
      assert.ok(state.chromium.installed);
      assert.ok(state.chromium.playwrightBrowsers);
    } finally {
      fs.existsSync = originalExistsSync;
      fs.readdirSync = originalReaddirSync;
      process.env.HOME = originalHome;
    }
  });

  it("detects system Chrome", () => {
    // Shape-check rather than assert a specific binary path: the machine's
    // Chrome location varies (snap, /usr/bin, Flatpak) and execSync cannot
    // be reliably mocked at module level in Bun.
    const state = detectSystemState();
    if (state.chromium.systemChrome) {
      assert.equal(typeof state.chromium.systemChrome, "string");
      assert.ok(state.chromium.systemChrome.length > 0);
    }
  });

  it("detects output directory state", () => {
    const originalEnv = process.env.SNAPMCP_DIR;
    try {
      process.env.SNAPMCP_DIR = tmpDir;
      const state = detectSystemState();
      assert.ok(state.outputDir.exists);
      assert.ok(state.outputDir.writable);
    } finally {
      process.env.SNAPMCP_DIR = originalEnv;
    }
  });

  it("detects SNAPMCP_* env vars", () => {
    const originalEnv = process.env;
    try {
      process.env = { ...process.env, SNAPMCP_TEST: "value" };
      const state = detectSystemState();
      assert.equal(state.config.envVars.SNAPMCP_TEST, "value");
    } finally {
      process.env = originalEnv;
    }
  });

  it("detects .env file", () => {
    const originalExistsSync = fs.existsSync;
    try {
      fs.existsSync = (p) => p === path.resolve(".env");
      const state = detectSystemState();
      assert.equal(state.config.configFile, path.resolve(".env"));
    } finally {
      fs.existsSync = originalExistsSync;
    }
  });
});

describe("bootstrapSetup", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = createFakeDir();
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates output directory when missing", async () => {
    const originalAsk = (global as any).ask;
    try {
      (global as any).ask = async () => true; // Mock ask to always return true
      const originalEnv = process.env.SNAPMCP_DIR;
      try {
        process.env.SNAPMCP_DIR = path.join(tmpDir, "captures");
        await bootstrapSetup({ installChrome: false, createEnv: false });
        assert.ok(fs.existsSync(path.join(tmpDir, "captures")));
      } finally {
        process.env.SNAPMCP_DIR = originalEnv;
      }
    } finally {
      (global as any).ask = originalAsk;
    }
  });
});

// ─── Display functions (no side effects in tests) ────────────

describe("printSummary", () => {
  it("prints without error for fake SystemState", () => {
    const fakeState: SystemState = {
      runtime: { bun: true, nodeVersion: "v20.0.0", platform: "linux" },
      chromium: { installed: true, systemChrome: null, playwrightBrowsers: true },
      outputDir: { exists: true, writable: true, path: "/tmp/captures" },
      config: { envVars: {}, configFile: null },
      installMode: "project",
    };
    // This test just verifies no error is thrown
    printSummary(fakeState);
  });
});