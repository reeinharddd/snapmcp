#!/usr/bin/env bun
/**
 * postinstall — runs after `bun install` / `npm install`
 *
 * Checks for required system dependencies and warns if missing.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";

const CHECK_MARK = "\x1b[32m✓\x1b[0m";
const WARN_MARK = "\x1b[33m⚠\x1b[0m";

function checkChromium(): boolean {
  try {
    // Check if playwright browsers are installed
    const homedir = process.env.HOME || process.env.USERPROFILE || "";
    const cacheDir = process.env.PLAYWRIGHT_BROWSERS_PATH ||
      `${homedir}/.cache/ms-playwright`;

    if (fs.existsSync(cacheDir)) {
      const dirs = fs.readdirSync(cacheDir);
      if (dirs.some((d) => d.toLowerCase().includes("chromium"))) {
        return true;
      }
    }

    // Check system chromium (cross-platform)
    const checkCmd = process.platform === "win32"
      ? "where chromium 2>nul"
      : "which chromium chromium-browser google-chrome 2>/dev/null";
    execSync(checkCmd, { stdio: "ignore", shell: true });
    return true;
  } catch {
    return false;
  }
}

function main(): void {
  console.log("\n  ⬡ snapmcp — postinstall check\n");

  const hasChromium = checkChromium();

  if (hasChromium) {
    console.log(`  ${CHECK_MARK} Chromium found`);
  } else {
    console.log(`  ${WARN_MARK} Chromium not found — run: bunx playwright install chromium`);
    console.log(`  ${WARN_MARK} Or:                     npx playwright install chromium`);
  }

  console.log(`  ${CHECK_MARK} snapmcp installed successfully`);
  console.log(`\n  Run: SNAPMCP_DIR=./snapshots bun src/index.ts\n`);
}

main();
