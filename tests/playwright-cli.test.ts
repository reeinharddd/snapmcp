/**
 * Tests for the Playwright CLI helper.
 *
 * The module is imported as a namespace over `node:child_process` because Bun
 * on Windows does not expose every named export of that module. A named import
 * of `execFileSync` made the whole module fail to link there, which broke every
 * CLI test on the Windows runner.
 */

import { describe, it } from "node:test"
import assert from "node:assert"
import path from "node:path"
import {
  getPlaywrightCliPath,
  hasPlaywrightChromium,
  installPlaywrightChromium,
} from "../src/playwright-cli.js"

describe("playwright-cli", () => {
  it("loads without a link-time error on every runtime", () => {
    assert.equal(typeof getPlaywrightCliPath, "function")
    assert.equal(typeof hasPlaywrightChromium, "function")
    assert.equal(typeof installPlaywrightChromium, "function")
  })

  it("resolves the Playwright CLI inside the installed package", () => {
    const cliPath = getPlaywrightCliPath()
    assert.equal(path.basename(cliPath), "cli.js")
    assert.ok(path.isAbsolute(cliPath))
  })

  it("reports Chromium availability as a boolean", () => {
    assert.equal(typeof hasPlaywrightChromium(), "boolean")
  })
})
