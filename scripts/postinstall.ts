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
if (found) console.log('snapmcp: ✓ chrome found at', found);
else console.log('snapmcp: ⚠ run "snapmcp init" to install Chromium');
