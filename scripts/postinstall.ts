#!/usr/bin/env bun
// Inline — no imports from dist/ (dist doesn't exist at install time)
const chromePaths = [
  '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser', '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Program Files/Google/Chrome/Application/chrome.exe',
  '/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.LOCALAPPDATA}\\Chromium\\Application\\chrome.exe`,
];
const found = chromePaths.find((p) => {
  try { return require('fs').existsSync(p); } catch { return false; }
});
if (found) {
  console.log('snapmcp: ✓ chrome found at', found);
} else {
  // No system browser: install the bundled Playwright Chromium so the
  // package works out of the box (mirrors what `snapmcp --setup` does).
  console.log('snapmcp: ⚠ no system Chrome found — installing Playwright Chromium...');
  try {
    const { execSync } = require('node:child_process');
    execSync('bunx playwright install chromium', { stdio: 'inherit', timeout: 300_000 });
    console.log('snapmcp: ✓ Playwright Chromium installed');
  } catch (err) {
    console.error('snapmcp: ✗ Chromium download failed — run "snapmcp init" or "npx playwright install chromium" after install.');
    console.error('snapmcp:   The package will still install; captures need a browser at runtime.');
  }
}