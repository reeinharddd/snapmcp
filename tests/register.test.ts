import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse } from "jsonc-parser";
import {
  addSnapmcpEntry,
  addSnapmcpEntryToText,
  findOpenCodeConfigPath,
  hasSnapmcp,
  openCodeConfigCandidates,
  registerSnapmcp,
} from "../src/register.js";

describe("MCP client registration", () => {
  it("writes OpenCode V2 servers under mcp.servers", () => {
    const config: Record<string, unknown> = {
      mcp: {
        servers: {
          existing: {
            type: "local",
            command: ["existing-server"],
          },
        },
      },
    };

    addSnapmcpEntry(config, "opencode");

    const mcp = config.mcp as Record<string, unknown>;
    const servers = mcp.servers as Record<string, unknown>;
    assert.deepEqual(servers.snapmcp, {
      type: "local",
      command: ["npx", "-y", "snapmcp"],
    });
    assert.ok(servers.existing, "Existing MCP servers should be preserved");
    assert.equal(hasSnapmcp(config, "opencode"), true);
  });

  it("recognizes the deprecated OpenCode server location", () => {
    const config: Record<string, unknown> = {
      mcp: {
        snapmcp: {
          type: "local",
          command: ["npx", "-y", "snapmcp"],
        },
      },
    };

    assert.equal(hasSnapmcp(config, "opencode"), true);
  });

  it("keeps the standard mcpServers shape for other clients", () => {
    const config: Record<string, unknown> = {};

    addSnapmcpEntry(config, "claude-desktop");

    const servers = config.mcpServers as Record<string, unknown>;
    assert.deepEqual(servers.snapmcp, {
      command: "npx",
      args: ["-y", "snapmcp"],
    });
  });

  it("updates JSONC in place without removing comments or unrelated settings", () => {
    const source = `{
  "$schema": "https://opencode.ai/config.json",
  // Keep this comment.
  "model": "example/model",
}
`;

    const updated = addSnapmcpEntryToText(source, "opencode");
    const parsed = parse(updated) as Record<string, unknown>;

    assert.match(updated, /Keep this comment/);
    assert.equal(parsed.model, "example/model");
    const mcp = parsed.mcp as Record<string, unknown>;
    const servers = mcp.servers as Record<string, unknown>;
    assert.deepEqual(servers.snapmcp, {
      type: "local",
      command: ["npx", "-y", "snapmcp"],
    });
  });

  it("registers a JSONC config with a backup and preserved comments", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-register-jsonc-"));
    const configPath = path.join(root, "opencode.jsonc");
    const original = `{
  "$schema": "https://opencode.ai/config.json",
  // Preserve this comment.
}
`;
    fs.writeFileSync(configPath, original);

    try {
      const results = await registerSnapmcp(false, [
        {
          name: "OpenCode",
          configPath,
          format: "opencode",
          exists: true,
        },
      ]);

      assert.equal(results[0]?.action, "added");
      const updated = fs.readFileSync(configPath, "utf8");
      assert.match(updated, /Preserve this comment/);
      assert.equal(fs.readFileSync(`${configPath}.bak`, "utf8"), original);
      const parsed = parse(updated) as Record<string, unknown>;
      const mcp = parsed.mcp as Record<string, unknown>;
      const servers = mcp.servers as Record<string, unknown>;
      assert.ok(servers.snapmcp);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("targets the existing OpenCode file that already registers snapmcp", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-opencode-dual-"));
    const previousXdg = process.env.XDG_CONFIG_HOME;
    try {
      const configDir = path.join(root, "opencode");
      fs.mkdirSync(configDir);
      const jsonPath = path.join(configDir, "opencode.json");
      const jsoncPath = path.join(configDir, "opencode.jsonc");
      fs.writeFileSync(jsonPath, "{}\n");
      fs.writeFileSync(
        jsoncPath,
        '{\n  "mcp": { "servers": { "snapmcp": { "type": "local", "command": ["snapmcp"] } } }\n}\n',
      );

      process.env.XDG_CONFIG_HOME = root;
      assert.equal(findOpenCodeConfigPath(), jsoncPath);
    } finally {
      if (previousXdg === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = previousXdg;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("detects an OpenCode JSONC config under XDG_CONFIG_HOME", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "snapmcp-opencode-config-"));
    const previousXdg = process.env.XDG_CONFIG_HOME;
    try {
      const configDir = path.join(root, "opencode");
      fs.mkdirSync(configDir);
      const configPath = path.join(configDir, "opencode.jsonc");
      fs.writeFileSync(configPath, "{}\n");

      process.env.XDG_CONFIG_HOME = root;
      assert.equal(openCodeConfigCandidates()[0], configPath);
      assert.equal(findOpenCodeConfigPath(), configPath);
    } finally {
      if (previousXdg === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = previousXdg;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
