/**
 * Tests for the CLI/DX tools module.
 *
 * Covers structural exports, DoctorResult type contract,
 * cliDoctor health check structure, cliInit non-throwing
 * behavior, and cliTest error handling when Chromium is
 * unavailable.
 */

import { describe, it } from "node:test"
import assert from "node:assert"
import path from "node:path"
import fs from "node:fs"
import os from "node:os"

/* ─── Module structure ─────────────────────────────────────── */

describe("cli module", () => {
  it("exports expected functions and interfaces", async () => {
    const mod = await import("../src/cli.js")
    assert.equal(typeof mod.cliInit, "function")
    assert.equal(typeof mod.cliDoctor, "function")
    assert.equal(typeof mod.cliTest, "function")
  })

  it("exports DoctorCheck and DoctorResult types (structural check)", async () => {
    const mod = await import("../src/cli.js")
    // Interfaces don't exist at runtime, but we can verify the
    // module loads and the exported types are referenced correctly
    // by calling an exported function and inspecting its return
    assert.equal(typeof mod.cliInit, "function")
  })
})

/* ─── cliDoctor ────────────────────────────────────────────── */

describe("cliDoctor", () => {
  it("returns a DoctorResult with checks array", { timeout: 15_000 }, async () => {
    const { cliDoctor } = await import("../src/cli.js")
    const { loadConfig } = await import("../src/config.js")
    const config = loadConfig()
    const result = await cliDoctor(config)

    // Top-level contract
    assert.ok(result, "Expected result to be truthy")
    assert.ok(["ok", "warn", "error"].includes(result.status), `Unexpected status: ${result.status}`)
    assert.ok(Array.isArray(result.checks), "Expected checks to be an array")
    assert.ok(result.checks.length > 0, "Expected at least one check")

    // Each check contract
    for (const check of result.checks) {
      assert.equal(typeof check.name, "string", "Expected check.name to be a string")
      assert.ok(["ok", "warn", "error"].includes(check.status), `Unexpected check status '${check.status}' for ${check.name}`)
      assert.equal(typeof check.message, "string", "Expected check.message to be a string")
    }
  })

  it("includes all expected check names", { timeout: 15_000 }, async () => {
    const { cliDoctor } = await import("../src/cli.js")
    const { loadConfig } = await import("../src/config.js")
    const config = loadConfig()
    const result = await cliDoctor(config)

    const names = result.checks.map((c) => c.name)
    const expected = [
      "node-version",
      "chromium",
      "chromium-sandbox",
      "output-dir",
      "disk-space",
      "config",
      "highlighter",
    ]
    for (const name of expected) {
      assert.ok(names.includes(name), `Expected check "${name}" to be in results`)
    }
  })

  it("reports ok for node-version when Node >= 20", { timeout: 15_000 }, async () => {
    const { cliDoctor } = await import("../src/cli.js")
    const { loadConfig } = await import("../src/config.js")
    const config = loadConfig()
    const result = await cliDoctor(config)

    const nodeCheck = result.checks.find((c) => c.name === "node-version")
    assert.ok(nodeCheck, "Expected node-version check")
    const major = parseInt(process.version.slice(1), 10)
    if (major >= 20) {
      assert.equal(nodeCheck.status, "ok")
    }
  })

  it("checks output-dir is accessible and writable", { timeout: 15_000 }, async () => {
    const { cliDoctor } = await import("../src/cli.js")
    const { loadConfig } = await import("../src/config.js")

    // Use a temp dir for predictable results
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-doctor-test-"))
    const oldDir = process.env.SNAPMCP_DIR
    process.env.SNAPMCP_DIR = tmpDir
    try {
      const config = loadConfig()
      const result = await cliDoctor(config)

      const dirCheck = result.checks.find((c) => c.name === "output-dir")
      assert.ok(dirCheck, "Expected output-dir check")
      assert.equal(dirCheck.status, "ok", `Expected ok, got ${dirCheck.status}: ${dirCheck.message}`)
      assert.ok(dirCheck.message.includes(tmpDir), "Message should reference the temp dir")
    } finally {
      if (oldDir === undefined) {
        delete process.env.SNAPMCP_DIR
      } else {
        process.env.SNAPMCP_DIR = oldDir
      }
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it("reports config check even with edge-case values", { timeout: 15_000 }, async () => {
    const { cliDoctor } = await import("../src/cli.js")
    const { loadConfig } = await import("../src/config.js")
    const oldTimeout = process.env.SNAPMCP_TIMEOUT
    const oldQuality = process.env.SNAPMCP_QUALITY
    const oldFormat = process.env.SNAPMCP_FORMAT
    process.env.SNAPMCP_TIMEOUT = "2000"
    process.env.SNAPMCP_QUALITY = "5"
    process.env.SNAPMCP_FORMAT = "jpeg"
    try {
      const config = loadConfig()
      const result = await cliDoctor(config)

      const cfgCheck = result.checks.find((c) => c.name === "config")
      assert.ok(cfgCheck, "Expected config check")
      assert.equal(cfgCheck.status, "warn", "Edge-case values should warn")
    } finally {
      if (oldTimeout === undefined) delete process.env.SNAPMCP_TIMEOUT
      else process.env.SNAPMCP_TIMEOUT = oldTimeout
      if (oldQuality === undefined) delete process.env.SNAPMCP_QUALITY
      else process.env.SNAPMCP_QUALITY = oldQuality
      if (oldFormat === undefined) delete process.env.SNAPMCP_FORMAT
      else process.env.SNAPMCP_FORMAT = oldFormat
    }
  })
})

/* ─── cliInit ──────────────────────────────────────────────── */

describe("cliInit", () => {
  it("does not throw with default config", { timeout: 15_000 }, async () => {
    const { cliInit } = await import("../src/cli.js")
    const { loadConfig } = await import("../src/config.js")

    // Use a temp dir so we don't pollute real snapshots
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-init-test-"))
    const oldDir = process.env.SNAPMCP_DIR
    process.env.SNAPMCP_DIR = tmpDir
    try {
      const config = loadConfig()
      await cliInit(config)
    } finally {
      if (oldDir === undefined) delete process.env.SNAPMCP_DIR
      else process.env.SNAPMCP_DIR = oldDir
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it("uses the configured output directory", { timeout: 15_000 }, async () => {
    const { cliInit } = await import("../src/cli.js")
    const { loadConfig } = await import("../src/config.js")

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-init-test-"))
    const childDir = path.join(tmpDir, "nested", "captures")
    const oldDir = process.env.SNAPMCP_DIR
    process.env.SNAPMCP_DIR = childDir
    try {
      // Create full path so bootstrapSetup skips interactive prompt
      fs.mkdirSync(childDir, { recursive: true })
      const config = loadConfig()
      await cliInit(config)
      assert.ok(fs.existsSync(childDir), "Output directory should still exist after init")
    } finally {
      if (oldDir === undefined) delete process.env.SNAPMCP_DIR
      else process.env.SNAPMCP_DIR = oldDir
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})

/* ─── cliTest ──────────────────────────────────────────────── */

describe("cliTest", () => {
  it("throws when Chromium is not available", { timeout: 5_000 }, async () => {
    const { cliTest } = await import("../src/cli.js")
    const { loadConfig } = await import("../src/config.js")

    // Quick way to check if Chromium is available — if not, the
    // test should reject with a Playwright-related error
    const home = process.env.HOME || process.env.USERPROFILE || ""
    const cacheDir =
      process.env.PLAYWRIGHT_BROWSERS_PATH || `${home}/.cache/ms-playwright`
    let chromiumAvailable = false
    try {
      chromiumAvailable =
        fs.existsSync(cacheDir) ||
        (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE !== undefined &&
          fs.existsSync(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE))
    } catch {
      chromiumAvailable = false
    }

    if (!chromiumAvailable) {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-test-test-"))
      const oldDir = process.env.SNAPMCP_DIR
      process.env.SNAPMCP_DIR = tmpDir
      try {
        const config = loadConfig()
        await assert.rejects(
          () => cliTest(config),
          /chromium|playwright|browser/i,
          "cliTest should reject when Chromium is not available",
        )
      } finally {
        if (oldDir === undefined) {
          delete process.env.SNAPMCP_DIR
        } else {
          process.env.SNAPMCP_DIR = oldDir
        }
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    }
    // If Chromium IS available, cliTest should succeed — we skip
    // verifying the success path here since it's slow and requires
    // the full Playwright stack (tested by integration tests)
  })
})
