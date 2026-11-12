/**
 * Integration tests for the validating proxy used by URL captures.
 *
 * These tests drive a real Chromium instance through the local proxy to prove
 * that the browser stops resolving target hostnames itself and that the proxy
 * pins and refuses the right addresses.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import playwright from "playwright";
import { startValidatingProxy, type ValidatingProxy } from "../../src/proxy.js";
import { browserMissing } from "./runner.js";

const skipNoBrowser = browserMissing();

describe("Chromium through the validating proxy", { skip: skipNoBrowser }, () => {
  let tmpDir: string;
  let originServer: http.Server;
  let originPort: number;
  let seenHosts: string[] = [];

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-proxy-browser-"));
    originServer = http.createServer((req, res) => {
      seenHosts.push(req.headers.host ?? "");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end("<!DOCTYPE html><html><head><title>pinned</title></head><body>proxy-ok</body></html>");
    });
    await new Promise<void>((resolve) => originServer.listen(0, "127.0.0.1", resolve));
    const address = originServer.address();
    originPort = typeof address === "object" && address ? address.port : 0;
  });

  after(async () => {
    await new Promise<void>((resolve) => originServer.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads a page through the proxy without Chromium resolving the hostname", async () => {
    const proxy: ValidatingProxy = await startValidatingProxy({
      // The test origin is on loopback, so the private check is relaxed here.
      resolve: async () => ["127.0.0.1"],
      isPrivateAddress: () => false,
    });

    const browser = await playwright.chromium.launch({
      headless: true,
      args: proxy.chromiumArgs,
    });

    try {
      const page = await browser.newPage();
      const response = await page.goto(`http://example.test:${originPort}/page`, {
        waitUntil: "domcontentloaded",
      });

      assert.ok(response, "Expected a response from the origin");
      assert.equal(await page.title(), "pinned");
      assert.match((await page.content()) ?? "", /proxy-ok/);
      assert.ok(
        seenHosts.includes(`example.test:${originPort}`),
        `Expected the original Host header, saw: ${seenHosts.join(", ")}`,
      );
    } finally {
      await browser.close();
      await proxy.close();
    }
  });

  it("refuses a target that resolves to a private address", async () => {
    const events: string[] = [];
    const proxy = await startValidatingProxy({
      resolve: async () => ["10.0.0.1"],
      isPrivateAddress: (address) => address.startsWith("10."),
      onAudit: (event) => events.push(event),
    });

    const browser = await playwright.chromium.launch({
      headless: true,
      args: proxy.chromiumArgs,
    });

    try {
      const page = await browser.newPage();
      const response = await page.goto("http://internal.test/", {
        waitUntil: "domcontentloaded",
      });

      assert.equal(response?.status(), 403, "Expected the proxy to refuse the request");
      assert.match((await page.content()) ?? "", /Forbidden/);
      assert.ok(events.includes("ssrf_block"), "Expected an ssrf_block audit event");
    } finally {
      await browser.close();
      await proxy.close();
    }
  });
});
