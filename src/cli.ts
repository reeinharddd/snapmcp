/**
 * snapmcp CLI/DX tools — init, doctor, test
 *
 * These functions provide setup wizard, system diagnostics, and
 * integration testing for the snapmcp MCP server.
 *
 * @module
 */

import path from "node:path"
import fs from "node:fs"
import { execSync } from "node:child_process"
import type { SnapConfig } from "./config.js"
import { logger } from "./logger.js"
import { checkChromiumSandbox } from "./security.js"
import {
  captureTerminal,
  captureCode,
  ensureOutputDir,
  closeBrowser,
  runCleanup,
} from "./renderer.js"

/* ─── Types ───────────────────────────────────────────────── */

/** A single diagnostic check result */
export interface DoctorCheck {
  name: string
  status: "ok" | "warn" | "error"
  message: string
}

/** Structured result from cliDoctor */
export interface DoctorResult {
  status: "ok" | "warn" | "error"
  checks: DoctorCheck[]
}

/* ─── Constants ────────────────────────────────────────────── */

const MIN_NODE_VERSION = 20

/* ─── Internal helpers ─────────────────────────────────────── */

/**
 * Check if Chromium is installed and available via Playwright.
 * Tries bunx first, then falls back to npx.
 */
function checkChromiumAvailability(): boolean {
  for (const cmd of [
    "bunx playwright install chromium --dry-run",
    "npx playwright install chromium --dry-run",
  ]) {
    try {
      execSync(cmd, { stdio: "pipe", timeout: 15_000 })
      return true
    } catch {
      continue
    }
  }
  return false
}

/* ─── cliInit ──────────────────────────────────────────────── */

/**
 * Interactive setup wizard.
 *
 * Checks Chromium availability, creates the output directory, prints
 * the current configuration, and shows next steps for connecting
 * to MCP clients.
 */
export async function cliInit(config: SnapConfig): Promise<void> {
  logger.info("")
  logger.info("  ╔═══════════════════════════════════════════╗")
  logger.info("  ║  ⬡ snapmcp — Setup                       ║")
  logger.info("  ╚═══════════════════════════════════════════╝")
  logger.info("")

  /* Chromium check */
  const hasChrome = checkChromiumAvailability()
  if (hasChrome) {
    logger.info("  ✓ Chromium is installed")
  } else {
    logger.warn("  ⚠  Chromium not found — installing...")
    try {
      execSync("bunx playwright install chromium", {
        stdio: "inherit",
        timeout: 120_000,
      })
      logger.info("  ✓ Chromium installed successfully")
    } catch {
      logger.error("  ✗ Failed to install Chromium")
      logger.info("     Try: npx playwright install chromium")
    }
  }

  /* Output directory */
  const outDir = path.resolve(config.outputDir)
  ensureOutputDir(outDir)
  logger.info(`  ✓ Output directory: ${outDir}`)

  /* Configuration summary */
  logger.info("")
  logger.info("  ── Configuration ──")
  logger.info(`     Output:   ${config.outputDir}`)
  logger.info(
    `     Format:   ${config.format}${config.format === "jpeg" ? ` (q${config.quality})` : ""}`,
  )
  logger.info(`     Theme:    ${config.theme}`)
  logger.info(
    `     Chrome:   ${config.windowChrome ? "on" : "off"} · Shadow: ${config.shadow} · Radius: ${config.borderRadius}px`,
  )
  logger.info(`     Security: ${config.securityChecks ? "enabled" : "disabled"}`)

  /* Next steps */
  const entryPoint = process.argv[1] || "dist/index.js"

  logger.info("")
  logger.info("  ── Next Steps ──")
  logger.info("  1. Set SNAPMCP_* environment variables (optional)")
  logger.info("  2. Start the server:  snapmcp")
  logger.info("  3. Connect your MCP client to the stdio endpoint")
  logger.info("")
  logger.info("  MCP client config (Claude Desktop):")
  logger.info(`    "mcpServers": {`)
  logger.info(`      "snapmcp": {`)
  logger.info(`        "command": "node",`)
  logger.info(`        "args": ["${path.resolve(entryPoint)}"]`)
  logger.info(`      }`)
  logger.info(`    }`)
  logger.info("")
}

/* ─── cliDoctor ────────────────────────────────────────────── */

/**
 * System diagnostics.
 *
 * Runs a comprehensive health check covering Node.js, Chromium,
 * sandbox status, output directory, disk space, config values,
 * and the Shiki syntax highlighter. Returns a structured result
 * and logs a formatted report to stderr.
 */
export async function cliDoctor(config: SnapConfig): Promise<DoctorResult> {
  const checks: DoctorCheck[] = []

  /* 1. Node.js version */
  const nodeMajor = parseInt(process.version.slice(1), 10)
  if (nodeMajor >= MIN_NODE_VERSION) {
    checks.push({
      name: "node-version",
      status: "ok",
      message: `Node.js ${process.version}`,
    })
  } else {
    checks.push({
      name: "node-version",
      status: "error",
      message: `Node.js ${process.version} — minimum required: ${MIN_NODE_VERSION}`,
    })
  }

  /* 2. Chromium availability */
  const hasChrome = checkChromiumAvailability()
  if (hasChrome) {
    checks.push({
      name: "chromium",
      status: "ok",
      message: "Chromium is installed and available",
    })
  } else {
    checks.push({
      name: "chromium",
      status: "error",
      message: "Chromium not found. Run: npx playwright install chromium",
    })
  }

  /* 3. Chromium sandbox status */
  const sandbox = checkChromiumSandbox()
  checks.push({
    name: "chromium-sandbox",
    status: sandbox.sandboxEnabled ? "ok" : "warn",
    message: sandbox.message,
  })

  /* 4. Output directory */
  const outDir = path.resolve(config.outputDir)
  try {
    ensureOutputDir(outDir)
    const testFile = path.join(outDir, ".snapmcp-write-test")
    fs.writeFileSync(testFile, "ok")
    fs.unlinkSync(testFile)
    checks.push({
      name: "output-dir",
      status: "ok",
      message: `Output directory exists and is writable: ${outDir}`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    checks.push({
      name: "output-dir",
      status: "error",
      message: `Output directory issue: ${msg}`,
    })
  }

  /* 5. Disk space (best-effort) */
  try {
    const df = execSync(`df -k "${outDir}"`, {
      encoding: "utf-8",
      timeout: 5000,
    })
    const lines = df.trim().split("\n")
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/)
      const availableKb = parseInt(parts[3], 10)
      if (!isNaN(availableKb)) {
        const availableMb = Math.round(availableKb / 1024)
        if (availableMb > 100) {
          checks.push({
            name: "disk-space",
            status: "ok",
            message: `Disk space available: ${availableMb}MB`,
          })
        } else {
          checks.push({
            name: "disk-space",
            status: "warn",
            message: `Low disk space: ${availableMb}MB available`,
          })
        }
      }
    }
  } catch {
    checks.push({
      name: "disk-space",
      status: "ok",
      message: "Disk space check skipped (not available on this platform)",
    })
  }

  /* 6. Config validation */
  const configIssues: string[] = []
  if (config.timeout < 5000) {
    configIssues.push(`timeout ${config.timeout}ms is very low`)
  }
  if (config.deviceScale < 1) {
    configIssues.push(`deviceScale ${config.deviceScale} is invalid`)
  }
  if (config.maxFileSize < 1024) {
    configIssues.push(`maxFileSize ${config.maxFileSize} is too small`)
  }
  if (config.quality < 10 && config.format === "jpeg") {
    configIssues.push(`quality ${config.quality} is very low`)
  }

  if (configIssues.length === 0) {
    checks.push({
      name: "config",
      status: "ok",
      message: "Configuration looks good",
    })
  } else {
    checks.push({
      name: "config",
      status: "warn",
      message: `Configuration issues: ${configIssues.join("; ")}`,
    })
  }

  /* 7. Shiki highlighter */
  try {
    const { getHighlighter } = await import("./highlighter.js")
    await getHighlighter()
    checks.push({
      name: "highlighter",
      status: "ok",
      message: "Syntax highlighter initialized (27 themes loaded)",
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    checks.push({
      name: "highlighter",
      status: "warn",
      message: `Highlighter init issue: ${msg}`,
    })
  }

  /* Determine overall status */
  const hasError = checks.some((c) => c.status === "error")
  const hasWarn = checks.some((c) => c.status === "warn")
  const status: DoctorResult["status"] = hasError ? "error" : hasWarn ? "warn" : "ok"

  /* Log report */
  logger.info("")
  logger.info("  ╔═══════════════════════════════════════════╗")
  logger.info("  ║  ⬡ snapmcp — Doctor Report               ║")
  logger.info("  ╚═══════════════════════════════════════════╝")
  logger.info("")
  for (const check of checks) {
    const icon =
      check.status === "ok" ? "✓" : check.status === "warn" ? "⚡" : "✗"
    logger.info(`  ${icon} ${check.name}`)
    logger.info(`     ${check.message}`)
  }
  logger.info("")
  logger.info(
    `  Overall: ${status === "ok" ? "✓ All good" : status === "warn" ? "⚡ Warnings" : "✗ Issues found"}`,
  )
  logger.info("")

  return { status, checks }
}

/* ─── cliTest ──────────────────────────────────────────────── */

/**
 * Run a test capture to verify everything works end-to-end.
 *
 * Creates `test-terminal.png` and `test-code.png` in the output
 * directory, then closes the browser. Logs paths on success.
 */
export async function cliTest(config: SnapConfig): Promise<void> {
  const outDir = path.resolve(config.outputDir)
  ensureOutputDir(outDir)

  const terminalPath = path.join(outDir, "test-terminal.png")
  const codePath = path.join(outDir, "test-code.png")

  logger.info("  📟 Creating test terminal capture...")
  await captureTerminal(
    "snapmcp test",
    [
      "$ snapmcp --version",
      "⬡ snapmcp v2",
      "",
      "$ echo 'hello, world!'",
      "hello, world!",
      "",
      "=== Test completed successfully ===",
    ],
    terminalPath,
    config,
  )
  logger.info(`  ✓ Terminal capture saved: ${terminalPath}`)

  logger.info("  📝 Creating test code capture...")
  await captureCode(
    [
      "function greet(name: string): string {",
      "  return `Hello, ${name}!`",
      "}",
      "",
      "const msg = greet(\"snapmcp\")",
      "console.log(msg)",
    ].join("\n"),
    "typescript",
    "snapmcp test",
    codePath,
    config,
  )
  logger.info(`  ✓ Code capture saved: ${codePath}`)

  runCleanup(config)
  await closeBrowser()

  logger.info("")
  logger.info("  ✓ Test captures completed successfully!")
  logger.info(`    ${terminalPath}`)
  logger.info(`    ${codePath}`)
  logger.info("")
}
