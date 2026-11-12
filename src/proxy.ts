/**
 * Local validating HTTP/HTTPS proxy for Chromium.
 *
 * Chromium resolves DNS itself and re-resolves on every redirect hop, so a
 * hostname that is public when snapmcp validates it can resolve to a private
 * address when Chromium actually dials it (DNS rebinding). Chromium offers no
 * way to pin the address it validated.
 *
 * This module closes that gap: Chromium is pointed at a loopback proxy that
 * resolves and validates every target itself, then connects to the pinned IP
 * literal. Chromium never resolves a target hostname, so the address snapmcp
 * validated is the address that is used.
 *
 * Each hop is validated independently, including targets that are already IP
 * literals, because a redirect to an IP literal skips DNS resolution entirely.
 *
 * @module
 */

import dns from "node:dns";
import http from "node:http";
import net from "node:net";

/** Options for the validating proxy. */
export interface ProxyOptions {
  /** Resolve a hostname to candidate IP addresses. Defaults to `dns.lookup`. */
  resolve?: (hostname: string) => Promise<string[]>;
  /** Return true when an IP literal must be refused. */
  isPrivateAddress: (address: string) => boolean;
  /** Maximum number of requests served over a single client connection. */
  maxHops?: number;
  /** Audit callback invoked for every blocked request. */
  onAudit?: (event: string, detail: string) => void;
}

/** A running validating proxy. */
export interface ValidatingProxy {
  /** Loopback origin Chromium must be pointed at. */
  readonly origin: string;
  /** Chromium launch arguments that route all traffic through this proxy. */
  readonly chromiumArgs: string[];
  /** Stop the proxy and release its port. */
  close(): Promise<void>;
}

/** Default number of requests allowed on a single client connection. */
const DEFAULT_MAX_HOPS = 10;

/** Resolve a hostname to every candidate address. */
async function defaultResolve(hostname: string): Promise<string[]> {
  const entries = await dns.promises.lookup(hostname, { all: true });
  return entries.map((entry) => entry.address);
}

/**
 * Normalize a hostname for validation.
 *
 * Lowercases the host and strips the FQDN trailing dot so `example.com.` and
 * `example.com` are treated identically. Bracketed IPv6 literals are
 * unwrapped because WHATWG URLs keep the brackets in `hostname`.
 */
function normalizeHost(hostname: string): string {
  let value = hostname.trim().toLowerCase();
  if (value.startsWith("[") && value.endsWith("]")) {
    value = value.slice(1, -1);
  }
  return value.endsWith(".") ? value.slice(0, -1) : value;
}

/** Parse an authority string such as `example.com:443` or `[::1]:443`. */
function parseAuthority(authority: string): { host: string; port: number } | null {
  const trimmed = authority.trim();
  if (!trimmed) return null;

  const bracketed = /^\[([^\]]+)\](?::(\d+))?$/.exec(trimmed);
  if (bracketed) {
    const port = bracketed[2] ? Number(bracketed[2]) : 443;
    if (!Number.isInteger(port) || port <= 0 || port > 65535) return null;
    return { host: bracketed[1] ?? "", port };
  }

  const separator = trimmed.lastIndexOf(":");
  if (separator === -1) return { host: trimmed, port: 443 };
  const host = trimmed.slice(0, separator);
  const port = Number(trimmed.slice(separator + 1));
  if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) return null;
  return { host, port };
}

/** A request that must not reach the network. */
class ProxyRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProxyRefusal";
  }
}

/** A validated target pinned to a concrete address. */
interface PinnedTarget {
  /** Normalized hostname or IP literal that was requested. */
  host: string;
  /** Port to connect to. */
  port: number;
  /** IP literal that must be used for the connection. */
  address: string;
}

/**
 * Start the local validating proxy.
 *
 * The proxy binds to `127.0.0.1` on an ephemeral port. It never listens on a
 * public interface and never performs DNS resolution on behalf of Chromium.
 *
 * @param options Validation and audit configuration
 * @returns The running proxy, its Chromium arguments, and a close function
 */
export async function startValidatingProxy(options: ProxyOptions): Promise<ValidatingProxy> {
  const resolve = options.resolve ?? defaultResolve;
  const isPrivateAddress = options.isPrivateAddress;
  const maxHops = Math.max(1, options.maxHops ?? DEFAULT_MAX_HOPS);
  const onAudit = options.onAudit ?? ((): void => {});

  const sockets = new Set<net.Socket>();
  const requestCounts = new WeakMap<net.Socket, number>();
  let closed = false;

  /**
   * Resolve a target and pin it to a validated address.
   *
   * Fails closed: a host that resolves to any private address is refused, and
   * a host that cannot be resolved is refused as well.
   */
  async function pinTarget(hostname: string, port: number): Promise<PinnedTarget> {
    const host = normalizeHost(hostname);
    if (!host) {
      throw new ProxyRefusal("request target has no host");
    }

    if (net.isIP(host) !== 0) {
      if (isPrivateAddress(host)) {
        throw new ProxyRefusal(`refusing private address ${host}`);
      }
      return { host, port, address: host };
    }

    let addresses: string[];
    try {
      addresses = await resolve(host);
    } catch (err) {
      throw new ProxyRefusal(`could not resolve ${host}: ${(err as Error).message}`);
    }

    if (!addresses || addresses.length === 0) {
      throw new ProxyRefusal(`could not resolve ${host}`);
    }

    for (const address of addresses) {
      if (isPrivateAddress(address)) {
        throw new ProxyRefusal(
          `refusing ${host} because it resolves to private address ${address}`,
        );
      }
    }

    return { host, port, address: addresses[0] as string };
  }

  /** Record and report a blocked request. */
  function auditRefusal(reason: string): void {
    onAudit("ssrf_block", reason);
  }

  /** Answer an HTTP request with a refusal status. */
  function refuseHttp(res: http.ServerResponse, reason: string): void {
    auditRefusal(reason);
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden\n");
  }

  /** Answer a CONNECT tunnel request with a refusal status. */
  function refuseConnect(socket: net.Socket, reason: string): void {
    auditRefusal(reason);
    socket.write("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n");
    socket.destroy();
  }

  /** Track the socket so it can be destroyed when the proxy closes. */
  function trackSocket(socket: net.Socket): void {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  }

  /** Forward a plain HTTP request to the pinned address. */
  async function handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    try {
      const raw = req.url ?? "";
      if (!/^https?:\/\//i.test(raw)) {
        refuseHttp(res, "proxy requests must use an absolute http(s) URL");
        return;
      }

      const url = new URL(raw);
      if (url.protocol !== "http:") {
        refuseHttp(res, `unsupported protocol ${url.protocol}`);
        return;
      }

      const count = (requestCounts.get(req.socket) ?? 0) + 1;
      requestCounts.set(req.socket, count);
      if (count > maxHops) {
        refuseHttp(res, `request limit of ${maxHops} reached for this connection`);
        return;
      }

      const port = url.port ? Number(url.port) : 80;
      const target = await pinTarget(url.hostname, port);

      if (req.headers.upgrade) {
        await tunnelUpgrade(req, res, target, url);
        return;
      }

      const headers = { ...req.headers, host: url.host };
      const upstream = http.request(
        {
          host: target.address,
          port: target.port,
          method: req.method,
          path: `${url.pathname}${url.search}`,
          headers,
          setHost: false,
        },
        (upstreamResponse) => {
          res.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
          upstreamResponse.pipe(res);
        },
      );

      upstream.on("error", (err) => {
        if (!res.headersSent) {
          refuseHttp(res, `upstream request failed: ${err.message}`);
          return;
        }
        res.destroy();
      });

      req.pipe(upstream);
    } catch (err) {
      refuseHttp(res, err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Tunnel an upgrade request (WebSocket) to the pinned address.
   *
   * The handshake is replayed verbatim so the client keeps its upgrade
   * semantics while the connection still goes to the validated address.
   */
  async function tunnelUpgrade(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    target: PinnedTarget,
    url: URL,
  ): Promise<void> {
    const upstream = net.connect({ host: target.address, port: target.port });
    trackSocket(upstream);

    upstream.on("error", (err) => {
      if (!res.headersSent) {
        refuseHttp(res, `upstream connection failed: ${err.message}`);
        return;
      }
      res.destroy();
    });

    upstream.on("connect", () => {
      const lines = [`${req.method} ${url.pathname}${url.search} HTTP/${req.httpVersion}`];
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          for (const entry of value) lines.push(`${key}: ${entry}`);
        } else {
          lines.push(`${key}: ${value}`);
        }
      }
      lines.push("", "");
      upstream.write(lines.join("\r\n"));
      req.pipe(upstream);
      upstream.pipe(res);
    });
  }

  /** Open a CONNECT tunnel to the pinned address. */
  async function handleConnect(
    req: http.IncomingMessage,
    clientSocket: net.Socket,
    head: Buffer,
  ): Promise<void> {
    try {
      const authority = parseAuthority(req.url ?? "");
      if (!authority) {
        refuseConnect(clientSocket, "invalid CONNECT target");
        return;
      }

      const count = (requestCounts.get(clientSocket) ?? 0) + 1;
      requestCounts.set(clientSocket, count);
      if (count > maxHops) {
        refuseConnect(clientSocket, `request limit of ${maxHops} reached for this connection`);
        return;
      }

      const target = await pinTarget(authority.host, authority.port);
      const upstream = net.connect({ host: target.address, port: target.port });
      trackSocket(upstream);

      upstream.on("error", () => clientSocket.destroy());
      upstream.on("connect", () => {
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head && head.length > 0) upstream.write(head);
        clientSocket.pipe(upstream);
        upstream.pipe(clientSocket);
      });

      clientSocket.on("error", () => upstream.destroy());
    } catch (err) {
      refuseConnect(clientSocket, err instanceof Error ? err.message : String(err));
    }
  }

  const server = http.createServer();
  server.on("connection", trackSocket);
  server.on("request", (req, res) => {
    void handleRequest(req, res);
  });
  server.on("connect", (req, socket, head) => {
    void handleConnect(req, socket as net.Socket, head);
  });
  server.on("clientError", (_err, socket) => {
    socket.destroy();
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Validating proxy failed to bind to a loopback port");
  }

  const origin = `http://127.0.0.1:${address.port}`;

  return {
    origin,
    chromiumArgs: [
      `--proxy-server=${origin}`,
      // Chromium must not resolve any target hostname: the proxy resolves and
      // pins every target itself. Only the loopback proxy address stays
      // reachable, and it is an IP literal, so no DNS lookup is needed.
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
      // Remove the implicit loopback bypass so requests to 127.0.0.1 or
      // localhost still reach the proxy, where they are refused by the same
      // private-address checks as every other target.
      "--proxy-bypass-list=<-loopback>",
    ],
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      for (const socket of sockets) {
        socket.destroy();
      }
      sockets.clear();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections?.();
      });
    },
  };
}
