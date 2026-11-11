import * as childProcess from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

/** Resolve Playwright's installed CLI without relying on Bun, npm, or npx. */
export function getPlaywrightCliPath(): string {
  const packagePath = require.resolve("playwright/package.json");
  return path.join(path.dirname(packagePath), "cli.js");
}

/**
 * Install Playwright's bundled Chromium using the local Node runtime.
 *
 * `node:child_process` is imported as a namespace because Bun on Windows does
 * not expose every named export of the module (for example `execFileSync`),
 * and a named import would fail at link time. `spawnSync` is preferred and
 * `execFileSync` is used as a fallback, so the installer works on every
 * supported runtime.
 */
export function installPlaywrightChromium(timeout = 300_000): void {
  const cliPath = getPlaywrightCliPath();
  const args = [cliPath, "install", "chromium"];

  if (typeof childProcess.spawnSync === "function") {
    const result = childProcess.spawnSync(process.execPath, args, {
      stdio: "inherit",
      timeout,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(
        `Playwright Chromium installation failed with exit code ${result.status}`,
      );
    }
    return;
  }

  if (typeof childProcess.execFileSync === "function") {
    childProcess.execFileSync(process.execPath, args, {
      stdio: "inherit",
      timeout,
    });
    return;
  }

  throw new Error(
    "Unable to install Chromium: node:child_process exposes neither spawnSync nor execFileSync",
  );
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
