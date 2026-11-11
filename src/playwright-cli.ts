import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { runCommand } from "./process.js";

const require = createRequire(import.meta.url);

/** Resolve Playwright's installed CLI without relying on Bun, npm, or npx. */
export function getPlaywrightCliPath(): string {
  const packagePath = require.resolve("playwright/package.json");
  return path.join(path.dirname(packagePath), "cli.js");
}

/**
 * Install Playwright's bundled Chromium using the local Node runtime.
 *
 * The command runs without a shell, so no value can be interpreted as shell
 * syntax, and it works on every runtime that exposes `node:child_process`.
 */
export function installPlaywrightChromium(timeout = 300_000): void {
  runCommand(process.execPath, [getPlaywrightCliPath(), "install", "chromium"], {
    timeout,
    inherit: true,
  });
}

/** Check whether Playwright's bundled Chromium is actually installed. */
export function hasPlaywrightChromium(): boolean {
  try {
    const executable = require("playwright").chromium.executablePath() as string;
    return fs.existsSync(executable);
  } catch {
    return false;
  }
}
