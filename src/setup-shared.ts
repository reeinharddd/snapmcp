/**
 * snapmcp bootstrap — shared detection, setup, and summary functions.
 *
 * Used by:
 *  - scripts/setup.ts (standalone interactive bootstrap)
 *  - src/cli.ts       (snapmcp init command)
 *
 * @module
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { detectMcpClients, printDetectedClients } from "./register.js";

/* ─── Types ───────────────────────────────────────────────── */

/** Full system state snapshot (read-only detection) */
export interface SystemState {
  runtime: {
    bun: boolean;
    nodeVersion: string;
    platform: string;
  };
  chromium: {
    installed: boolean;
    systemChrome: string | null;
    playwrightBrowsers: boolean;
  };
  outputDir: {
    exists: boolean;
    writable: boolean;
    path: string;
  };
  config: {
    envVars: Record<string, string>;
    configFile: string | null;
  };
  installMode: "global" | "project" | "unknown";
}

/* ─── Color constants ─────────────────────────────────────── */

export const CHECK = "\x1b[32m✓\x1b[0m";
export const WARN  = "\x1b[33m⚠\x1b[0m";
export const CROSS = "\x1b[31m✗\x1b[0m";
export const STEP  = "\x1b[36m→\x1b[0m";
export const TEAL  = (s: string) => `\x1b[38;2;0;212;170m${s}\x1b[0m`;
export const BLUE  = (s: string) => `\x1b[38;2;0;153;255m${s}\x1b[0m`;
export const GRAY  = (s: string) => `\x1b[38;2;107;107;128m${s}\x1b[0m`;

/* ─── Helpers ─────────────────────────────────────────────── */

/**
 * Ask a yes/no question on the terminal.
 * Returns true for yes, false for no.
 * Works in both Node and Bun.
 */
export async function ask(prompt: string, defaultYes: boolean = true): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<boolean>((resolve) => {
    rl.question(`${prompt} ${defaultYes ? "[Y/n]" : "[y/N]"} `, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === "") resolve(defaultYes);
      else resolve(trimmed === "y" || trimmed === "yes");
    });
  });
}

/**
 * Detect install mode based on how the process was invoked.
 */
function detectInstallMode(): "global" | "project" | "unknown" {
  const exe = process.argv[1] || "";
  // Check for npx-run detection
  if (exe.includes("_npx") || /\bnpx\b/.test(exe)) return "global";

  // Check for bunx
  if (exe.includes("/bunx") || exe.includes("\\bunx")) return "global";

  // Check if cwd is the snapmcp project
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { name?: string };
      if (pkg.name === "snapmcp") return "project";
    }
  } catch {
    /* best-effort */
  }

  // Check if we're inside node_modules
  if (exe.includes("node_modules")) return "global";

  return "unknown";
}

/* ─── Detection ───────────────────────────────────────────── */

/**
 * Read-only system state detection. Never modifies the system.
 */
export function detectSystemState(): SystemState {
  const outDir = process.env.SNAPMCP_DIR || "./captures";
  const resolvedOut = path.resolve(outDir);

  /* Runtime */
  const bun = process.versions?.bun !== undefined;

  /* Chromium: Playwright browsers cache */
  const homedir = process.env.HOME || process.env.USERPROFILE || "";
  const cacheDir = process.env.PLAYWRIGHT_BROWSERS_PATH ||
    `${homedir}/.cache/ms-playwright`;
  let playwrightBrowsers = false;
  try {
    if (fs.existsSync(cacheDir)) {
      const dirs = fs.readdirSync(cacheDir);
      playwrightBrowsers = dirs.some((d) =>
        d.toLowerCase().includes("chromium"),
      );
    }
  } catch {
    /* best-effort */
  }

  /* Chromium: system-installed browser */
  let systemChrome: string | null = null;
  try {
    const result = execSync(
      "which chromium chromium-browser google-chrome 2>/dev/null || true",
      { encoding: "utf-8", timeout: 5_000 },
    );
    const lines = result.trim().split("\n").filter(Boolean);
    systemChrome = lines[0] || null;
  } catch {
    /* which returned non-zero — no system chrome found */
  }

  const chromiumInstalled = playwrightBrowsers || systemChrome !== null;

  /* Output directory */
  let outExists = false;
  let outWritable = false;
  try {
    outExists = fs.existsSync(resolvedOut);
    if (outExists) {
      fs.accessSync(resolvedOut, fs.constants.R_OK | fs.constants.W_OK);
      outWritable = true;
    }
  } catch {
    /* directory doesn't exist or permissions issue */
  }

  /* Config: env vars */
  const envVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("SNAPMCP_") && value) {
      envVars[key] = value;
    }
  }

  /* Config: .env file */
  let configFile: string | null = null;
  try {
    const envPath = path.resolve(".env");
    if (fs.existsSync(envPath)) configFile = envPath;
  } catch {
    /* best-effort */
  }

  const installMode = detectInstallMode();

  return {
    runtime: { bun, nodeVersion: process.version, platform: process.platform },
    chromium: { installed: chromiumInstalled, systemChrome, playwrightBrowsers },
    outputDir: { exists: outExists, writable: outWritable, path: resolvedOut },
    config: { envVars, configFile },
    installMode,
  };
}

/* ─── Bootstrap ───────────────────────────────────────────── */

/**
 * Interactive setup: ask user for each missing dependency and install/configure.
 * Call after detectSystemState() to show what's missing.
 *
 * @param options.installChrome - Set false to skip Chromium install prompt (default: true)
 * @param options.outputDir     - Custom output dir path (default: SNAPMCP_DIR or ./captures)
 * @param options.createEnv     - Set false to skip .env prompt (default: true)
 */
export async function bootstrapSetup(options?: {
  installChrome?: boolean;
  outputDir?: string;
  createEnv?: boolean;
}): Promise<void> {
  const state = detectSystemState();

  /* ── a. Install Playwright Chromium ── */
  if (!state.chromium.installed && options?.installChrome !== false) {
    const answer = await ask(
      "  Chromium not found. Install Playwright Chromium (required for browser captures)?",
      true,
    );
    if (answer) {
      console.log(`  ${STEP} Installing Chromium via bunx...`);
      let ok = false;
      try {
        execSync("bunx playwright install chromium", {
          stdio: "inherit",
          timeout: 120_000,
        });
        console.log(`  ${CHECK} Chromium installed`);
        ok = true;
      } catch {
        console.log(`  ${WARN} bunx failed, trying npx...`);
      }
      if (!ok) {
        try {
          execSync("npx playwright install chromium", {
            stdio: "inherit",
            timeout: 120_000,
          });
          console.log(`  ${CHECK} Chromium installed (via npx)`);
          ok = true;
        } catch {
          console.log(
            `  ${CROSS} Chromium install failed. Manual: npx playwright install chromium`,
          );
        }
      }
    }
  } else if (state.chromium.installed) {
    console.log(`  ${CHECK} Chromium already available`);
  }

  /* ── b. Create output directory ── */
  const outDir = options?.outputDir || process.env.SNAPMCP_DIR || "./captures";
  const resolvedOut = path.resolve(outDir);
  if (!state.outputDir.exists) {
    const answer = await ask(
      `  Output directory '${outDir}' not found. Create it?`,
      true,
    );
    if (answer) {
      fs.mkdirSync(resolvedOut, { recursive: true });
      console.log(`  ${CHECK} Created: ${resolvedOut}`);
    }
  } else {
    console.log(`  ${CHECK} Output directory exists: ${resolvedOut}`);
  }

  /* ── c. Notify about system Chrome vs Playwright ── */
  if (state.chromium.systemChrome && !state.chromium.playwrightBrowsers) {
    console.log(
      `  ${STEP} System Chrome found at: ${state.chromium.systemChrome}`,
    );
    console.log(
      `  ${GRAY("     For reliable captures, install Playwright Chromium: bunx playwright install chromium")}`,
    );
  }

  /* ── d. Save .env file ── */
  if (options?.createEnv !== false) {
    const existing = state.config.configFile !== null;
    const prompt = existing
      ? "  .env file exists. Overwrite with current SNAPMCP_ settings?"
      : "  Save current SNAPMCP_ configuration to .env file?";
    const answer = await ask(prompt, !existing);
    if (answer) {
      const vars: Record<string, string> = {
        SNAPMCP_DIR: process.env.SNAPMCP_DIR || "./captures",
        SNAPMCP_FORMAT: process.env.SNAPMCP_FORMAT || "png",
        SNAPMCP_THEME: process.env.SNAPMCP_THEME || "dark-plus",
        SNAPMCP_SHADOW: process.env.SNAPMCP_SHADOW || "soft",
        SNAPMCP_WINDOW_CHROME: process.env.SNAPMCP_WINDOW_CHROME || "true",
      };
      // Only include vars that differ from defaults or are explicitly set
      const lines = Object.entries(vars)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${v}`);
      fs.writeFileSync(".env", lines.join("\n") + "\n");
      console.log(`  ${CHECK} .env file written (${lines.length} variables)`);
    }
  }
}

/* ─── Summary ─────────────────────────────────────────────── */

/**
 * Print a formatted system summary table.
 * Uses console.log for output (safe before MCP server starts).
 */
export function printSummary(state: SystemState): void {
  console.log("");
  console.log(`  ${TEAL("╔═══════════════════════════════════════════╗")}`);
  console.log(`  ${TEAL("║  ⬡ snapmcp — System Summary              ║")}`);
  console.log(`  ${TEAL("╚═══════════════════════════════════════════╝")}`);
  console.log("");

  /* Runtime */
  console.log(`  ${BLUE("Runtime")}`);
  if (state.runtime.bun) {
    console.log(`    ${CHECK} Bun ${process.versions.bun}`);
  } else {
    console.log(`    ${CHECK} Node.js ${state.runtime.nodeVersion}`);
  }
  console.log(`    ${CHECK} Platform: ${state.runtime.platform}`);
  console.log("");

  /* Chromium */
  console.log(`  ${BLUE("Chromium")}`);
  if (state.chromium.playwrightBrowsers) {
    console.log(`    ${CHECK} Playwright Chromium installed`);
  } else {
    console.log(`    ${WARN} Playwright Chromium not installed`);
  }
  if (state.chromium.systemChrome) {
    console.log(
      `    ${CHECK} System Chrome: ${state.chromium.systemChrome}`,
    );
  }
  if (!state.chromium.installed) {
    console.log(`    ${CROSS} No Chromium found — install required`);
  }
  console.log("");

  /* Output directory */
  console.log(`  ${BLUE("Output")}`);
  if (state.outputDir.exists && state.outputDir.writable) {
    console.log(`    ${CHECK} ${state.outputDir.path} (writable)`);
  } else if (state.outputDir.exists) {
    console.log(`    ${WARN} ${state.outputDir.path} (not writable)`);
  } else {
    console.log(`    ${WARN} ${state.outputDir.path} (does not exist)`);
  }
  console.log("");

  /* Config */
  console.log(`  ${BLUE("Config")}`);
  const envKeys = Object.keys(state.config.envVars);
  if (envKeys.length > 0) {
    for (const key of envKeys.slice(0, 8)) {
      console.log(`    ${CHECK} ${key}=${state.config.envVars[key]}`);
    }
    if (envKeys.length > 8) {
      console.log(`    ${GRAY(`  ... and ${envKeys.length - 8} more`)}`);
    }
  } else {
    console.log(`    ${STEP} No SNAPMCP_* env vars set`);
  }
  if (state.config.configFile) {
    console.log(`    ${CHECK} .env: ${state.config.configFile}`);
  }
  console.log("");

  /* Install mode */
  console.log(`  ${BLUE("Install")}`);
  const modeIcon =
    state.installMode === "project"
      ? CHECK
      : state.installMode === "global"
        ? CHECK
        : STEP;
  console.log(`    ${modeIcon} Mode: ${state.installMode}`);
  console.log("");

  /* ─── MCP Client Detection ─── */
  printDetectedClients(detectMcpClients());

  /* ─── MCP Client Config Snippet ─── */
  printMcpConfigSnippet(state);
}

/**
 * Print MCP client configuration snippets based on detected install mode.
 */
function printMcpConfigSnippet(state: SystemState): void {
  const { execPath } = process;
  const isNpxGlobal =
    state.installMode === "global" ||
    execPath.includes("npx") ||
    execPath.includes("_npx");

  let command: string;
  let args: string[];
  if (isNpxGlobal) {
    command = "npx";
    args = ["-y", "snapmcp"];
  } else if (state.runtime.bun) {
    command = "bun";
    args = ["run", "src/index.ts"];
  } else {
    command = "node";
    args = ["dist/index.js"];
  }

  // Collect non-default env vars for the snippet
  const envSnippet: Record<string, string> = {};
  if (state.config.envVars.SNAPMCP_DIR) {
    envSnippet.SNAPMCP_DIR = state.config.envVars.SNAPMCP_DIR;
  } else {
    envSnippet.SNAPMCP_DIR = "./captures";
  }
  if (state.config.envVars.SNAPMCP_THEME) {
    envSnippet.SNAPMCP_THEME = state.config.envVars.SNAPMCP_THEME;
  }

  const envStr = Object.entries(envSnippet)
    .map(([k, v]) => `          "${k}": "${v}"`)
    .join(",\n");

  console.log(`  ${BLUE("MCP Client Config")}`);
  console.log(`  ${GRAY("Paste into your MCP client settings:")}`);
  console.log("");
  console.log(`    "mcpServers": {`);
  console.log(`      "snapmcp": {`);
  console.log(`        "command": "${command}",`);
  console.log(`        "args": [${args.map((a) => `"${a}"`).join(", ")}]`);
  if (envStr) {
    console.log(`        "env": {`);
    console.log(envStr);
    console.log(`        }`);
  }
  console.log(`      }`);
  console.log(`    }`);
  console.log("");
}
