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
import type { SnapConfig } from "./config.js"
import { logger } from "./logger.js"
import { checkChromiumSandbox } from "./security.js"
import { detectChrome } from "./browser.js"
import { hasPlaywrightChromium } from "./playwright-cli.js"
import {
  createCapabilityManifest,
  searchCapabilities,
  TOOL_CAPABILITIES,
} from "./capabilities.js"
import {
  captureTerminal,
  captureCode,
  ensureOutputDir,
  closeBrowser,
  runCleanup,
} from "./renderer.js"
import { ask, detectSystemState, bootstrapSetup, printSummary, SystemState, CHECK, WARN, CROSS, STEP, BLUE, GRAY } from "./setup-shared.js"
import {
  detectMcpClients,
  registerSnapmcp,
  printRegistrationResults,
  printDetectedClients,
  type McpClientConfig,
} from "./register.js"
import { BRAND, brandPrimary as TEAL } from "./brand.js"

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

interface BrowserAvailability {
  status: "ok" | "warn" | "error"
  message: string
}

/** Check the browser that snapmcp will actually use for URL captures. */
function checkChromiumAvailability(config: SnapConfig): BrowserAvailability {
  if (config.chromeExecutable) {
    return fs.existsSync(config.chromeExecutable)
      ? {
          status: "ok",
          message: `Configured browser executable is available: ${config.chromeExecutable}`,
        }
      : {
          status: "error",
          message: `Configured browser executable was not found: ${config.chromeExecutable}`,
        }
  }

  if (config.chromeChannel) {
    if (config.chromeChannel === "chromium") {
      return hasPlaywrightChromium()
        ? { status: "ok", message: "Playwright Chromium is installed and available" }
        : {
            status: "error",
            message: "Playwright Chromium is not installed. Run: npx playwright install chromium",
          }
    }

    const detected = detectChrome()
    if (detected.found && detected.channel === config.chromeChannel) {
      return {
        status: "ok",
        message: `Configured Chrome channel is available via ${detected.executablePath}`,
      }
    }
    return {
      status: "warn",
      message: `Configured Chrome channel "${config.chromeChannel}" was not detected; Playwright will verify it at launch`,
    }
  }

  if (config.chromeProfile) {
    const detected = detectChrome()
    return detected.found
      ? {
          status: "ok",
          message: `Profile mode is available via system browser ${detected.executablePath}`,
        }
      : {
          status: "error",
          message: "Profile mode requires a system Chrome installation",
        }
  }

  if (hasPlaywrightChromium()) {
    return { status: "ok", message: "Playwright Chromium is installed and available" }
  }

  const detected = detectChrome()
  const systemNote = detected.found
    ? " A system browser was detected, but it is not selected automatically."
    : ""
  return {
    status: "error",
    message: `Playwright Chromium is not installed. Run: npx playwright install chromium.${systemNote}`,
  }
}

/* ─── cliCapabilities ───────────────────────────────────────── */

/**
 * Print the machine-readable capability catalog or search it by intent.
 * JSON mode writes only to stdout so agents and code-mode clients can parse it.
 */
export function cliCapabilities(
  version: string,
  query?: string,
  json = false,
): void {
  const normalizedQuery = query?.trim()

  if (json) {
    if (normalizedQuery) {
      const matches = searchCapabilities(normalizedQuery, 5)
      process.stdout.write(
        JSON.stringify(
          {
            schemaVersion: "1.0",
            query: normalizedQuery,
            count: matches.length,
            matches: matches.map(({ capability, score }) => ({
              ...capability,
              score,
            })),
          },
          null,
          2,
        ) + "\n",
      )
      return
    }

    process.stdout.write(
      JSON.stringify(createCapabilityManifest(version), null, 2) + "\n",
    )
    return
  }

  logger.info("")
  logger.info("  ╔═══════════════════════════════════════════╗")
  logger.info("  ║  ⬡ snapmcp — Capabilities                ║")
  logger.info("  ╚═══════════════════════════════════════════╝")
  logger.info("")

  if (normalizedQuery) {
    const matches = searchCapabilities(normalizedQuery, 5)
    if (matches.length === 0) {
      logger.info(`  No tools matched "${normalizedQuery}".`)
      logger.info("  Run `snapmcp capabilities` to list every tool.")
      return
    }
    logger.info(`  Best matches for "${normalizedQuery}":`)
    for (const { capability } of matches) {
      logger.info(`    ${capability.name.padEnd(20)} ${capability.summary}`)
      logger.info(`      ${capability.useWhen}`)
    }
    return
  }

  logger.info(`  ${TOOL_CAPABILITIES.length} tools available:`)
  for (const capability of TOOL_CAPABILITIES) {
    logger.info(`    ${capability.name.padEnd(20)} ${capability.summary}`)
  }
  logger.info("")
  logger.info("  Search: snapmcp search \"website screenshot\"")
  logger.info("  JSON:   snapmcp capabilities --json")
}

/* ─── cliInit ──────────────────────────────────────────────── */

/**
 * Interactive setup wizard.
 *
 * Detects system state, runs the shared bootstrap (Chromium install,
 * output directory, .env creation), and prints the summary.
 */
export async function cliInit(
  config: SnapConfig,
  options?: { clients?: McpClientConfig[] },
): Promise<void> {
  logger.info("")
  logger.info("  ╔═══════════════════════════════════════════╗")
  logger.info("  ║  ⬡ snapmcp — Setup                       ║")
  logger.info("  ╚═══════════════════════════════════════════╝")
  logger.info("")

  /* Detect system state and run interactive bootstrap */
  const systemState = detectSystemState()
  const mcpClients = options?.clients ?? detectMcpClients()
  await bootstrapSetup({ createEnv: false })
  printSummary(systemState, mcpClients)

  /* MCP auto-registration */
  if (mcpClients.length > 0) {
    printDetectedClients(mcpClients)
    const answer = await ask(
      "  Register snapmcp with detected MCP clients?",
      true,
    )
    if (answer) {
      const results = await registerSnapmcp(false, mcpClients)
      printRegistrationResults(results)
    } else {
      logger.info(`  ${STEP} MCP registration skipped`)
    }
  }
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
export async function cliDoctor(
  config: SnapConfig,
  json = false,
): Promise<DoctorResult> {
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
  const browserAvailability = checkChromiumAvailability(config)
  checks.push({
    name: "chromium",
    status: browserAvailability.status,
    message: browserAvailability.message,
  })

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
    const stats = fs.statfsSync(outDir)
    const availableBytes = stats.bavail * stats.bsize
    const availableMb = Math.floor(availableBytes / (1024 * 1024))
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

  if (json) {
    process.stdout.write(JSON.stringify({ status, checks }, null, 2) + "\n")
    return { status, checks }
  }

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
