import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { mock } from "bun:test";

// Mock node:child_process BEFORE importing the module under test.
// Bun's mock.module intercepts the module registry, so src/browser.js
// sees the mocked execSync even though it imports it directly.
const execSyncMocks = new Map<string, string | Error>();
mock.module("node:child_process", () => ({
  execSync: (cmd: string) => {
    const found = execSyncMocks.get(cmd);
    if (found instanceof Error) throw found;
    if (found !== undefined) return found;
    throw new Error("Command not mocked");
  },
}));

// Import AFTER the mock is registered — bun resolves the registry at import time.
const { detectChrome, getChromeProfileDir, tryPath, tryWhich, detectChromeProfiles } = await import("../src/browser.js");

// Original fs functions for restore
const originalExistsSync = fs.existsSync;
const originalAccessSync = fs.accessSync;
const originalReadFileSync = fs.readFileSync;

function resetFsMocks() {
  fs.existsSync = originalExistsSync;
  fs.accessSync = originalAccessSync;
  fs.readFileSync = originalReadFileSync;
}

describe("detectChrome", () => {
  let originalPlatform: NodeJS.Platform;
  let originalEnv: NodeJS.ProcessEnv;

  before(() => {
    originalPlatform = process.platform;
    originalEnv = { ...process.env };
  });

  after(() => {
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
    });
    process.env = originalEnv;
    resetFsMocks();
    execSyncMocks.clear();
  });

  it("should use SNAPMCP_CHROME_EXECUTABLE when valid", () => {
    process.env.SNAPMCP_CHROME_EXECUTABLE = "/usr/bin/chrome";
    fs.existsSync = () => true;
    fs.accessSync = () => {};

    const result = detectChrome();
    assert.equal(result.found, true);
    assert.equal(result.executablePath, "/usr/bin/chrome");
    assert.equal(result.channel, "chrome");
    assert.ok(Array.isArray(result.profiles));
  });

  it("should fall back when SNAPMCP_CHROME_EXECUTABLE is invalid", () => {
    process.env.SNAPMCP_CHROME_EXECUTABLE = "/invalid/path";
    fs.existsSync = () => false;

    const result = detectChrome();
    assert.equal(result.found, false);
  });

  it("should detect Chrome from platform paths on win32", () => {
    Object.defineProperty(process, "platform", {
      value: "win32",
    });
    fs.existsSync = (p) => p.includes("Google\\Chrome\\Application\\chrome.exe");
    fs.accessSync = () => {};

    const result = detectChrome();
    assert.equal(result.found, true);
    assert.ok(result.executablePath?.includes("chrome.exe"));
    assert.equal(result.channel, "chrome");
  });

  it("should detect Chrome from platform paths on darwin", () => {
    Object.defineProperty(process, "platform", {
      value: "darwin",
    });
    fs.existsSync = (p) => p.includes("Google Chrome.app");
    fs.accessSync = () => {};

    const result = detectChrome();
    assert.equal(result.found, true);
    assert.ok(result.executablePath?.includes("Google Chrome"));
    assert.equal(result.channel, "chrome");
  });

  it("should detect Chrome using which on Linux", () => {
    Object.defineProperty(process, "platform", {
      value: "linux",
    });
    execSyncMocks.set("which google-chrome-stable 2>/dev/null", "/usr/bin/google-chrome");

    const result = detectChrome();
    assert.equal(result.found, true);
    assert.equal(result.executablePath, "/usr/bin/google-chrome");
    assert.equal(result.channel, "chrome");
  });

  it("should return not found when no Chrome is detected", () => {
    fs.existsSync = () => false;
    execSyncMocks.clear();

    const result = detectChrome();
    assert.equal(result.found, false);
  });
});

describe("detectChromeProfiles", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-browser-test-"));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should detect profiles from Local State", () => {
    fs.writeFileSync(
      path.join(tmpDir, "Local State"),
      JSON.stringify({
        profile: {
          info_cache: {
            Default: { name: "Default", last_active: 1 },
            Profile1: { name: "Profile1", last_active: 2 },
          },
        },
      }),
    );

    const profiles = detectChromeProfiles(tmpDir);
    assert.equal(profiles.length, 2);
    assert.equal(profiles[0].name, "Profile1");
    assert.equal(profiles[0].isDefault, false);
    assert.equal(profiles[1].name, "Default");
    assert.equal(profiles[1].isDefault, true);
  });

  it("should return empty array when Local State is invalid", () => {
    fs.writeFileSync(path.join(tmpDir, "Local State"), "invalid json");

    const profiles = detectChromeProfiles(tmpDir);
    assert.equal(profiles.length, 0);
  });

  it("should return empty array when Local State does not exist", () => {
    const profiles = detectChromeProfiles(tmpDir);
    assert.equal(profiles.length, 0);
  });
});

describe("getChromeProfileDir", () => {
  let originalPlatform: NodeJS.Platform;
  let originalEnv: NodeJS.ProcessEnv;

  before(() => {
    originalPlatform = process.platform;
    originalEnv = { ...process.env };
  });

  after(() => {
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
    });
    process.env = originalEnv;
  });

  it("should return correct path for chrome on win32", () => {
    Object.defineProperty(process, "platform", {
      value: "win32",
    });
    process.env.LOCALAPPDATA = "C:\\Users\\Test\\AppData\\Local";

    const result = getChromeProfileDir("chrome");
    assert.ok(result.includes("Google\\Chrome\\User Data"));
  });

  it("should return correct path for msedge on win32", () => {
    Object.defineProperty(process, "platform", {
      value: "win32",
    });
    process.env.LOCALAPPDATA = "C:\\Users\\Test\\AppData\\Local";

    const result = getChromeProfileDir("msedge");
    assert.ok(result.includes("Microsoft\\Edge\\User Data"));
  });

  it("should return correct path for chromium on win32", () => {
    Object.defineProperty(process, "platform", {
      value: "win32",
    });
    process.env.LOCALAPPDATA = "C:\\Users\\Test\\AppData\\Local";

    const result = getChromeProfileDir("chromium");
    assert.ok(result.includes("Chromium\\User Data"));
  });

  it("should return correct path for chrome on darwin", () => {
    Object.defineProperty(process, "platform", {
      value: "darwin",
    });
    process.env.HOME = "/Users/test";

    const result = getChromeProfileDir("chrome");
    assert.ok(result.replace(/\\/g, "/").includes("Library/Application Support/Google/Chrome"));
  });

  it("should return correct path for chrome on linux", () => {
    Object.defineProperty(process, "platform", {
      value: "linux",
    });

    const result = getChromeProfileDir("chrome");
    assert.ok(result.replace(/\\/g, "/").includes(".config/google-chrome"));
  });
});

describe("tryPath and tryWhich", () => {
  after(() => {
    resetFsMocks();
    execSyncMocks.clear();
  });

  it("should return path when valid", () => {
    fs.existsSync = () => true;
    fs.accessSync = () => {};

    const result = tryPath("/valid/path");
    assert.equal(result, "/valid/path");
  });

  it("should return null when path is invalid", () => {
    fs.existsSync = () => false;

    const result = tryPath("/invalid/path");
    assert.equal(result, null);
  });

  it("should return path from which when valid", () => {
    execSyncMocks.set("which test 2>/dev/null", "/usr/bin/test");

    const result = tryWhich("test");
    assert.equal(result, "/usr/bin/test");
  });

  it("should return null from which when invalid", () => {
    const result = tryWhich("invalid");
    assert.equal(result, null);
  });
});