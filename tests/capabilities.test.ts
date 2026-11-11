import { describe, it } from "node:test";
import assert from "node:assert";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  SERVER_INSTRUCTIONS,
  TOOL_CAPABILITIES,
  createCapabilityManifest,
  registerCapabilityResource,
  searchCapabilities,
} from "../src/capabilities.js";
import { registerHintTool } from "../src/tools/hint.js";

const EXPECTED_TOOL_NAMES = [
  "capture_batch",
  "capture_browser",
  "capture_code",
  "capture_diff",
  "capture_document",
  "capture_file",
  "capture_gif",
  "capture_html",
  "capture_markdown",
  "capture_pdf",
  "capture_sequence",
  "capture_terminal",
  "snapmcp-hint",
].sort();

describe("capability catalog", () => {
  it("contains exactly 13 unique MCP tools", () => {
    const names = TOOL_CAPABILITIES.map((capability) => capability.name);
    assert.equal(names.length, 13);
    assert.equal(new Set(names).size, 13);
    assert.deepEqual([...names].sort(), EXPECTED_TOOL_NAMES);
  });

  it("describes every tool with actionable discovery metadata", () => {
    for (const capability of TOOL_CAPABILITIES) {
      assert.ok(capability.title.trim(), `${capability.name} needs a title`);
      assert.ok(capability.summary.trim(), `${capability.name} needs a summary`);
      assert.ok(capability.useWhen.trim(), `${capability.name} needs use-when guidance`);
      assert.ok(capability.keywords.length > 0, `${capability.name} needs keywords`);
      assert.ok(capability.outputs.length > 0, `${capability.name} needs output metadata`);
      assert.ok(capability.limits.trim(), `${capability.name} needs limits`);
    }
  });

  it("builds a stable manifest with the canonical discovery surfaces", () => {
    const manifest = createCapabilityManifest("9.8.7");
    assert.equal(manifest.schemaVersion, "1.0");
    assert.equal(manifest.version, "9.8.7");
    assert.equal(manifest.toolCount, 13);
    assert.equal(manifest.capabilities.length, 13);
    assert.equal(manifest.discovery.searchTool, "snapmcp-hint");
    assert.equal(manifest.discovery.resource, "snapmcp://capabilities");
    assert.equal(manifest.discovery.canonical, "MCP tools/list");
    assert.equal(
      manifest.security.fileAccess,
      "deny-all until SNAPMCP_ALLOWED_PATHS is configured",
    );
  });

  it("keeps server instructions aligned with capability discovery", () => {
    assert.match(SERVER_INSTRUCTIONS, /snapmcp-hint/);
    assert.match(SERVER_INSTRUCTIONS, /snapmcp:\/\/capabilities/);
    assert.match(SERVER_INSTRUCTIONS, /SSRF/i);
    assert.match(SERVER_INSTRUCTIONS, /allowlist/i);
  });
});

describe("capability search", () => {
  it("ranks the expected tool first for common intents", () => {
    const cases: Array<[string, string]> = [
      ["website screenshot", "capture_browser"],
      ["pdf export", "capture_pdf"],
      ["read a source file", "capture_file"],
      ["animated before and after", "capture_gif"],
      ["terminal output", "capture_terminal"],
    ];

    for (const [query, expected] of cases) {
      const matches = searchCapabilities(query);
      assert.ok(matches.length > 0, `Expected matches for: ${query}`);
      assert.equal(
        matches[0]?.capability.name,
        expected,
        `Unexpected top match for: ${query}`,
      );
    }
  });

  it("finds an exact tool name", () => {
    const matches = searchCapabilities("capture_document");
    assert.equal(matches[0]?.capability.name, "capture_document");
  });

  it("returns at most the requested number of ranked matches", () => {
    assert.equal(searchCapabilities("capture", 3).length, 3);
    assert.equal(searchCapabilities("website screenshot", 1).length, 1);
  });
});

describe("capability resource and hint tool", () => {
  type ResourceResult = {
    contents: Array<{
      uri: string;
      mimeType?: string;
      text?: string;
    }>;
  };
  type ResourceHandler = (uri: URL) => Promise<ResourceResult>;
  type HintHandler = (args: {
    topic?: string;
    query?: string;
  }) => Promise<{ content: Array<{ text: string }> }>;

  it("registers machine-readable capability resource data", async () => {
    let registeredUri: string | undefined;
    let registeredMimeType: string | undefined;
    let handler: ResourceHandler | undefined;

    const server = {
      registerResource(
        _name: string,
        uri: string,
        metadata: { mimeType?: string },
        callback: ResourceHandler,
      ): void {
        registeredUri = uri;
        registeredMimeType = metadata.mimeType;
        handler = callback;
      },
    } as unknown as McpServer;

    registerCapabilityResource(server, "1.2.3");
    assert.equal(registeredUri, "snapmcp://capabilities");
    assert.equal(registeredMimeType, "application/json");
    assert.ok(handler);

    const result = await handler(new URL("snapmcp://capabilities"));
    const content = result.contents[0];
    assert.equal(content?.uri, "snapmcp://capabilities");
    assert.equal(content?.mimeType, "application/json");

    const manifest = JSON.parse(content?.text ?? "{}") as ReturnType<
      typeof createCapabilityManifest
    >;
    assert.equal(manifest.toolCount, 13);
    assert.equal(manifest.discovery.resource, "snapmcp://capabilities");
  });

  it("returns ranked guidance for a natural-language hint query", async () => {
    let handler: HintHandler | undefined;
    const server = {
      tool(
        _name: string,
        _description: string,
        _schema: unknown,
        callback: HintHandler,
      ): void {
        handler = callback;
      },
    } as unknown as McpServer;

    registerHintTool(server);
    assert.ok(handler);

    const result = await handler({ query: "website screenshot" });
    const text = result.content[0]?.text ?? "";
    assert.match(text, /capture_browser/);
    assert.match(text, /Best snapmcp matches/i);
  });

  it("returns concise security guidance for a setup topic", async () => {
    let handler: HintHandler | undefined;
    const server = {
      tool(
        _name: string,
        _description: string,
        _schema: unknown,
        callback: HintHandler,
      ): void {
        handler = callback;
      },
    } as unknown as McpServer;

    registerHintTool(server);
    assert.ok(handler);

    const result = await handler({ topic: "security" });
    const text = result.content[0]?.text ?? "";
    assert.match(text, /deny-by-default/i);
    assert.match(text, /SSRF/i);
    assert.match(text, /ALLOWED_PATHS/i);
  });
});
