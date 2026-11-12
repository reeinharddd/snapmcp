import { describe, it } from "node:test";
import assert from "node:assert";
import http from "node:http";
import net from "node:net";
import { startValidatingProxy, type ValidatingProxy } from "../src/proxy.js";

/** Start a local origin server that echoes the request line and headers. */
async function startOrigin(): Promise<{
  origin: string;
  requests: Array<{ url?: string; host?: string }>;
  close: () => Promise<void>;
}> {
  const requests: Array<{ url?: string; host?: string }> = [];
  const server = http.createServer((req, res) => {
    requests.push({ url: req.url, host: req.headers.host });
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("origin-ok");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    origin: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

/** Perform an absolute-form HTTP request through the proxy. */
function proxyRequest(
  proxyPort: number,
  target: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port: proxyPort,
        path: target,
        method: "GET",
        headers: { host: "example.com" },
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => resolve({ status: response.statusCode ?? 0, body }));
      },
    );
    request.on("error", reject);
    request.end();
  });
}

/** Send a raw CONNECT request and return the status line. */
function connectRequest(proxyPort: number, authority: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: "127.0.0.1", port: proxyPort }, () => {
      socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`);
    });
    let data = "";
    socket.on("data", (chunk) => {
      data += chunk.toString("utf8");
      if (data.includes("\r\n")) {
        socket.destroy();
        resolve(data.split("\r\n")[0] ?? "");
      }
    });
    socket.on("error", reject);
    socket.on("close", () => {
      if (!data) resolve("");
    });
  });
}

describe("validating proxy", () => {
  let proxy: ValidatingProxy | null = null;
  const cleanups: Array<() => Promise<void>> = [];

  it("binds to loopback and exposes the Chromium arguments", async () => {
    proxy = await startValidatingProxy({
      isPrivateAddress: () => false,
    });
    cleanups.push(() => proxy?.close() ?? Promise.resolve());

    assert.match(proxy.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.ok(proxy.chromiumArgs.includes(`--proxy-server=${proxy.origin}`));
    assert.ok(
      proxy.chromiumArgs.includes(
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
      ),
    );
    assert.ok(proxy.chromiumArgs.includes("--proxy-bypass-list=<-loopback>"));
  });

  it("forwards a public target to the pinned address and keeps the Host header", async () => {
    const origin = await startOrigin();
    cleanups.push(origin.close);

    const scoped = await startValidatingProxy({
      resolve: async () => ["127.0.0.1"],
      // The test origin lives on loopback, so only a private range is refused.
      isPrivateAddress: (address) => address.startsWith("10."),
    });
    cleanups.push(() => scoped.close());

    const port = Number(scoped.origin.split(":").pop());
    const originPort = Number(origin.origin.split(":").pop());
    const result = await proxyRequest(port, `http://example.com:${originPort}/hello?x=1`);

    assert.equal(result.status, 200);
    assert.equal(result.body, "origin-ok");
    assert.equal(origin.requests.length, 1);
    assert.equal(origin.requests[0]?.host, `example.com:${originPort}`);
    assert.equal(origin.requests[0]?.url, "/hello?x=1");
  });

  it("refuses a hostname that resolves to a private address", async () => {
    const events: string[] = [];
    const scoped = await startValidatingProxy({
      resolve: async () => ["10.0.0.5"],
      isPrivateAddress: (address) => address.startsWith("10."),
      onAudit: (event) => events.push(event),
    });
    cleanups.push(() => scoped.close());

    const port = Number(scoped.origin.split(":").pop());
    const result = await proxyRequest(port, "http://internal.example.com/secret");

    assert.ok(result.status >= 400, `Expected a refusal status, got ${result.status}`);
    assert.ok(events.includes("ssrf_block"));
  });

  it("refuses a private IP literal without any DNS lookup", async () => {
    let resolved = false;
    const events: string[] = [];
    const scoped = await startValidatingProxy({
      resolve: async () => {
        resolved = true;
        return ["93.184.216.34"];
      },
      isPrivateAddress: (address) => address.startsWith("127."),
      onAudit: (event) => events.push(event),
    });
    cleanups.push(() => scoped.close());

    const port = Number(scoped.origin.split(":").pop());
    const result = await proxyRequest(port, "http://127.0.0.1/admin");

    assert.ok(result.status >= 400, `Expected a refusal status, got ${result.status}`);
    assert.equal(resolved, false, "An IP literal must not trigger a DNS lookup");
    assert.ok(events.includes("ssrf_block"));
  });

  it("refuses a CONNECT tunnel to a private IP literal", async () => {
    const events: string[] = [];
    const scoped = await startValidatingProxy({
      isPrivateAddress: (address) => address.startsWith("192.168."),
      onAudit: (event) => events.push(event),
    });
    cleanups.push(() => scoped.close());

    const port = Number(scoped.origin.split(":").pop());
    const statusLine = await connectRequest(port, "192.168.1.10:443");

    assert.match(statusLine, /^HTTP\/1\.1 403/);
    assert.ok(events.includes("ssrf_block"));
  });

  it("refuses a host that cannot be resolved", async () => {
    const scoped = await startValidatingProxy({
      resolve: async () => [],
      isPrivateAddress: () => false,
    });
    cleanups.push(() => scoped.close());

    const port = Number(scoped.origin.split(":").pop());
    const result = await proxyRequest(port, "http://nowhere.invalid/");

    assert.ok(result.status >= 400, `Expected a refusal status, got ${result.status}`);
  });

  it("stops accepting connections after close and can be closed twice", async () => {
    const scoped = await startValidatingProxy({
      isPrivateAddress: () => false,
    });
    const port = Number(scoped.origin.split(":").pop());

    await scoped.close();
    await scoped.close();

    await assert.rejects(
      () =>
        new Promise<void>((resolve, reject) => {
          const socket = net.connect({ host: "127.0.0.1", port }, () => {
            socket.destroy();
            resolve();
          });
          socket.on("error", reject);
        }),
      /ECONNREFUSED|ECONNRESET/,
    );
  });
});
