import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

// Browser detection scans PATH through the filesystem instead of spawning a
// shell, so no child_process mock is required here.
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

  it("should detect Chrome from a PATH lookup on Linux", () => {
    Object.defineProperty(process, "platform", {
      value: "linux",
    });
    const originalPath = process.env.PATH;
    try {
      // Build the fixture with the host path separator so the test behaves the
      // same on Windows runners.
      const firstDir = path.join(path.sep, "usr", "local", "bin");
      const secondDir = path.join(path.sep, "usr", "bin");
      process.env.PATH = [firstDir, secondDir].join(path.delimiter);
      const expected = path.join(secondDir, "google-chrome-stable");
      fs.existsSync = (p) => p === expected;
      fs.accessSync = () => {};

      const result = detectChrome();
      assert.equal(result.found, true);
      assert.equal(result.executablePath, expected);
      assert.equal(result.channel, "chrome");
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
    }
  });

  it("should return not found when no Chrome is detected", () => {
    fs.existsSync = () => false;

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

  it("should resolve a binary from PATH without spawning a shell", () => {
    const originalPath = process.env.PATH;
    try {
      // Build the fixture with the host path separator so the test behaves the
      // same on Windows runners.
      const firstDir = path.join(path.sep, "usr", "local", "bin");
      const secondDir = path.join(path.sep, "usr", "bin");
      process.env.PATH = [firstDir, secondDir].join(path.delimiter);
      const expected = path.join(secondDir, "test");
      fs.existsSync = (p) => p === expected;
      fs.accessSync = () => {};

      const result = tryWhich("test");
      assert.equal(result, expected);
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
    }
  });

  it("should return null when the binary is not on PATH", () => {
    const originalPath = process.env.PATH;
    try {
      const firstDir = path.join(path.sep, "usr", "local", "bin");
      const secondDir = path.join(path.sep, "usr", "bin");
      process.env.PATH = [firstDir, secondDir].join(path.delimiter);
      fs.existsSync = () => false;

      const result = tryWhich("invalid");
      assert.equal(result, null);
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
    }
  });

  it("should reject names that carry path separators", () => {
    assert.equal(tryWhich("../bin/sh"), null);
    assert.equal(tryWhich("/bin/sh"), null);
    assert.equal(tryWhich(""), null);
  });
});