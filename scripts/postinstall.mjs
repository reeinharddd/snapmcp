#!/usr/bin/env node
// Keep package installation fast and side-effect free. Browser setup is an
// explicit user action (`snapmcp init`) or can be done with Playwright directly.
import { existsSync } from "node:fs";

const chromePaths = [
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Program Files/Google/Chrome/Application/chrome.exe",
  "/Program Files (x86)/Google/Chrome/Application/chrome.exe",
];

if (process.env.LOCALAPPDATA) {
  chromePaths.push(
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.LOCALAPPDATA}\\Chromium\\Application\\chrome.exe`,
  );
}

const found = chromePaths.find((candidate) => existsSync(candidate));

if (found) {
  console.log(
    `snapmcp: system browser found at ${found}. Playwright Chromium remains the default until selected explicitly.`,
  );
} else {
  console.log(
    "snapmcp: installed. Run `snapmcp init` or `npx playwright install chromium` before browser captures.",
  );
}
