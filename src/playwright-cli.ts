import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

/** Resolve Playwright's installed CLI without relying on Bun, npm, or npx. */
export function getPlaywrightCliPath(): string {
  const packagePath = require.resolve("playwright/package.json");
  return path.join(path.dirname(packagePath), "cli.js");
}

/** Install Playwright's bundled Chromium using the local Node runtime. */
export function installPlaywrightChromium(timeout = 300_000): void {
  execFileSync(process.execPath, [getPlaywrightCliPath(), "install", "chromium"], {
    stdio: "inherit",
    timeout,
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
