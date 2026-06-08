#!/usr/bin/env bun
/**
 * snapmcp setup — one-time setup utility.
 *
 * Usage: bun run setup
 *
 * Installs Chromium, checks Node/Bun version, creates output directory.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHECK = "\x1b[32m✓\x1b[0m";
const WARN = "\x1b[33m⚠\x1b[0m";
const STEP = "\x1b[36m→\x1b[0m";

async function main(): Promise<void> {
  console.log("\n  snapmcp — Setup\n");

  // Step 1: Check runtime
  console.log(`  ${STEP} Checking runtime...`);
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split(".")[0], 10);
  if (nodeMajor < 20) {
    console.error(`  ${WARN} Node.js ${nodeVersion} detected — minimum required: v20`);
    console.error(`  ${WARN} Upgrade Node.js or use Bun: https://bun.sh`);
  } else {
    console.log(`  ${CHECK} Node.js ${nodeVersion}`);
  }

  // Step 2: Install Chromium
  console.log(`  ${STEP} Installing Chromium...`);
  try {
    execSync("bunx playwright install chromium", {
      stdio: "inherit",
      timeout: 120_000,
    });
    console.log(`  ${CHECK} Chromium installed`);
  } catch {
    console.error(`  ${WARN} Chromium install failed. Try: npx playwright install chromium`);
  }

  // Step 3: Create output directory
  const outDir = process.env.SNAPMCP_DIR || "./snapshots";
  const resolvedOut = path.resolve(outDir);
  fs.mkdirSync(resolvedOut, { recursive: true });
  console.log(`  ${CHECK} Output directory: ${resolvedOut}`);

  // Step 4: Summary
  console.log(`\n  ${CHECK} Setup complete!`);
  console.log(`\n  To start snapmcp:`);
  console.log(`    bun start`);
  console.log(`\n  Or with custom config:`);
  console.log(`    SNAPMCP_DIR=./snapshots SNAPMCP_THEME=nord bun start\n`);
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
