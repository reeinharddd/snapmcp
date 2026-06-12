/**
 * Runner helper for integration tests.
 *
 * Checks whether Playwright / Chromium is available so tests
 * can skip gracefully instead of failing with cryptic errors.
 */
import fs from "node:fs";

/**
 * Returns `false` when Chromium is available, or a skip-reason string.
 *
 * Usage:
 *   const skip = browserMissing();
 *   it("test", { skip }, async () => { ... });
 */
export function browserMissing(): string | false {
  try {
    const homedir = process.env.HOME || process.env.USERPROFILE || "";
    const cacheDir =
      process.env.PLAYWRIGHT_BROWSERS_PATH ||
      `${homedir}/.cache/ms-playwright`;

    if (!fs.existsSync(cacheDir)) {
      return `Chromium cache directory not found: ${cacheDir}`;
    }

    const dirs = fs.readdirSync(cacheDir);
    const hasChromium = dirs.some((d) =>
      d.toLowerCase().includes("chromium"),
    );
    if (!hasChromium) {
      return "No Chromium installation found in Playwright cache";
    }

    return false;
  } catch {
    return "Could not verify Chromium availability";
  }
}
