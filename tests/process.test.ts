/**
 * Tests for the shell-free command runner.
 *
 * The runner must never pass a command through a shell, so arguments that
 * contain shell metacharacters are delivered literally.
 */

import { describe, it } from "node:test"
import assert from "node:assert"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { runCommand } from "../src/process.js"

const isWindows = process.platform === "win32"

describe("runCommand", () => {
  it("captures stdout from a successful command", () => {
    const result = runCommand(
      process.execPath,
      ["-e", "process.stdout.write('snapmcp-ok')"],
    )
    assert.equal(result.stdout, "snapmcp-ok")
    assert.equal(result.status, 0)
  })

  it("throws when the command exits with a non-zero status", () => {
    assert.throws(
      () => runCommand(process.execPath, ["-e", "process.exit(3)"]),
      /exited with status 3/,
    )
  })

  it("throws when the command cannot be started", () => {
    assert.throws(
      () => runCommand("snapmcp-command-that-does-not-exist-xyz", []),
      /ENOENT|not found|spawn/i,
    )
  })

  it("passes arguments literally instead of interpreting shell syntax", () => {
    const marker = "a;echo pwned && $(id)"
    const result = runCommand(
      process.execPath,
      ["-e", "process.stdout.write(process.argv[1])", marker],
    )
    assert.equal(result.stdout, marker)
    assert.ok(!result.stdout.includes("pwned\n"))
  })

  it("does not create a file when an argument contains a shell redirect", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-run-command-"))
    try {
      const target = path.join(dir, "should-not-exist")
      runCommand(
        process.execPath,
        ["-e", "process.stdout.write('done')", `>${target}`],
      )
      assert.equal(fs.existsSync(target), false)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it("honours the timeout", () => {
    assert.throws(
      () =>
        runCommand(
          process.execPath,
          ["-e", "setTimeout(() => {}, 10000)"],
          { timeout: 250 },
        ),
      /ETIMEDOUT|timed out|spawn/i,
    )
  })

  it("is available on every supported runtime", { skip: isWindows ? false : false }, () => {
    // The module must load without a link-time error. Bun on Windows does not
    // expose every named export of node:child_process, so the module uses a
    // namespace import instead.
    assert.equal(typeof runCommand, "function")
  })
})
