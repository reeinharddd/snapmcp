import { describe, it, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  logger,
  setLogLevel,
  getLogLevel,
  setLogFile,
  closeAuditLog,
  AuditEventType,
} from "../src/logger.js";

let tmpDir = "";
after(() => {
  closeAuditLog();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

function freshTmpDir(): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-logger-test-"));
  return tmpDir;
}

describe("log levels", () => {
  after(() => setLogLevel("info"));

  it("setLogLevel/getLogLevel roundtrip", () => {
    setLogLevel("debug");
    assert.equal(getLogLevel(), "debug");
    setLogLevel("error");
    assert.equal(getLogLevel(), "error");
  });
});

async function flush(): Promise<void> {
  closeAuditLog();
  await new Promise((r) => setTimeout(r, 50));
}

describe("audit log file", () => {
  it("writes JSON lines to the configured file", async () => {
    const dir = freshTmpDir();
    const file = path.join(dir, "audit.log");
    setLogFile(file);

    logger.audit({ event: AuditEventType.SsrfBlock, severity: "warn", detail: "blocked 127.0.0.1", source: "validateUrl" });
    logger.audit({ event: AuditEventType.CaptureBrowser, severity: "info", detail: "https://example.com" });
    await flush();

    const lines = fs.readFileSync(file, "utf-8").trim().split("\n");
    assert.equal(lines.length, 2);

    const first = JSON.parse(lines[0]);
    assert.equal(first.event, "ssrf_block");
    assert.equal(first.severity, "warn");
    assert.equal(first.detail, "blocked 127.0.0.1");
    assert.equal(first.source, "validateUrl");
    assert.ok(first.ts, "audit entries carry a timestamp");

    const second = JSON.parse(lines[1]);
    assert.equal(second.event, "capture_browser");
    assert.equal(second.severity, "info");
  });

  it("appends to an existing file", async () => {
    const dir = freshTmpDir();
    const file = path.join(dir, "audit.log");
    fs.writeFileSync(file, "{\"preexisting\":true}\n");
    setLogFile(file);

    logger.audit({ event: AuditEventType.FileRead, severity: "info" });
    await flush();

    const lines = fs.readFileSync(file, "utf-8").trim().split("\n");
    assert.equal(lines.length, 2);
  });

  it("creates parent directories", async () => {
    const dir = freshTmpDir();
    const file = path.join(dir, "nested", "deep", "audit.log");
    setLogFile(file);

    logger.audit({ event: AuditEventType.PathTraversal, severity: "error", detail: "blocked" });
    await flush();

    assert.ok(fs.existsSync(file));
    const lines = fs.readFileSync(file, "utf-8").trim().split("\n");
    assert.equal(lines.length, 1);
  });
});

describe("audit event types", () => {
  it("maps to expected wire strings", () => {
    assert.equal(AuditEventType.SsrfBlock, "ssrf_block");
    assert.equal(AuditEventType.CaptureBrowser, "capture_browser");
    assert.equal(AuditEventType.CapturePdf, "capture_pdf");
    assert.equal(AuditEventType.FileRead, "file_read");
    assert.equal(AuditEventType.PathTraversal, "path_traversal");
    assert.equal(AuditEventType.LimitExceeded, "limit_exceeded");
  });
});