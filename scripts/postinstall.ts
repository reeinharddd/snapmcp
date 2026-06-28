#!/usr/bin/env bun
import { detectChrome } from '../dist/browser.js';

try {
  const chrome = detectChrome();
  if (chrome.found) console.log('snapmcp: ✓ Chrome found at', chrome.executablePath);
  else console.log('snapmcp: ⚠ Run "snapmcp init" to install Chromium');
} catch { console.log('snapmcp: Run "snapmcp init" to set up'); }
