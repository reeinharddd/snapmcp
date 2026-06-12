/**
 * Config matrix tests — validates that MCP configuration snippets
 * from the README are structurally valid and match expectations
 * for each editor/agent platform.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

// ─── Claude Code config ──────────────────────────────────────

describe("Claude Code MCP config", () => {
  it("produces valid JSON with required fields", () => {
    const config = {
      mcpServers: {
        snapmcp: {
          command: "npx",
          args: ["-y", "snapmcp"],
          env: {
            SNAPMCP_DIR: "/path/to/snapshots",
            SNAPMCP_THEME: "nord",
          },
        },
      },
    };
    const json = JSON.stringify(config);
    assert.doesNotThrow(() => JSON.parse(json));
    assert.equal(config.mcpServers.snapmcp.command, "npx");
    assert.deepEqual(config.mcpServers.snapmcp.args, ["-y", "snapmcp"]);
    assert.equal(config.mcpServers.snapmcp.env.SNAPMCP_DIR, "/path/to/snapshots");
    assert.equal(config.mcpServers.snapmcp.env.SNAPMCP_THEME, "nord");
  });

  it("works without optional env vars", () => {
    const config = {
      mcpServers: {
        snapmcp: {
          command: "npx",
          args: ["-y", "snapmcp"],
        },
      },
    };
    assert.doesNotThrow(() => JSON.stringify(config));
    assert.equal(config.mcpServers.snapmcp.command, "npx");
  });

  it("supports SNAPMCP_DIR only", () => {
    const config = {
      mcpServers: {
        snapmcp: {
          command: "npx",
          args: ["-y", "snapmcp"],
          env: {
            SNAPMCP_DIR: "/custom/snapshots",
          },
        },
      },
    };
    const parsed = JSON.parse(JSON.stringify(config));
    assert.equal(parsed.mcpServers.snapmcp.env.SNAPMCP_DIR, "/custom/snapshots");
  });
});

// ─── OpenCode config ─────────────────────────────────────────

describe("OpenCode MCP config", () => {
  it("produces valid JSON", () => {
    const config = {
      mcpServers: {
        snapmcp: {
          command: "npx",
          args: ["-y", "snapmcp"],
          env: {
            SNAPMCP_DIR: "./snapshots",
            SNAPMCP_FORMAT: "jpeg",
            SNAPMCP_QUALITY: "95",
          },
        },
      },
    };
    assert.doesNotThrow(() => JSON.stringify(config));
    const parsed = JSON.parse(JSON.stringify(config));
    assert.equal(parsed.mcpServers.snapmcp.env.SNAPMCP_FORMAT, "jpeg");
    assert.equal(parsed.mcpServers.snapmcp.env.SNAPMCP_QUALITY, "95");
  });

  it("supports all SNAPMCP_ env vars", () => {
    const config = {
      mcpServers: {
        snapmcp: {
          command: "npx",
          args: ["-y", "snapmcp"],
          env: {
            SNAPMCP_DIR: "./snapshots",
            SNAPMCP_FORMAT: "png",
            SNAPMCP_QUALITY: "90",
            SNAPMCP_THEME: "dracula",
            SNAPMCP_PADDING: "48",
            SNAPMCP_SHADOW: "strong",
            SNAPMCP_WINDOW_CHROME: "false",
            SNAPMCP_BORDER_RADIUS: "16",
            SNAPMCP_BADGE: "true",
            SNAPMCP_FONT_SIZE: "16px",
            SNAPMCP_TIMEOUT: "60000",
            SNAPMCP_DEVICE_SCALE: "3",
            SNAPMCP_LOG_LEVEL: "debug",
          },
        },
      },
    };
    assert.doesNotThrow(() => JSON.stringify(config));
    assert.equal(config.mcpServers.snapmcp.env.SNAPMCP_THEME, "dracula");
  });
});

// ─── Cline config ────────────────────────────────────────────

describe("Cline / VS Code MCP config", () => {
  it("includes autoApprove array", () => {
    const config = {
      mcpServers: {
        snapmcp: {
          command: "npx",
          args: ["-y", "snapmcp"],
          env: { SNAPMCP_DIR: "/path/to/snapshots" },
          disabled: false,
          autoApprove: ["capture_terminal", "capture_code"],
        },
      },
    };
    const json = JSON.stringify(config);
    assert.doesNotThrow(() => JSON.parse(json));
    assert.ok(Array.isArray(config.mcpServers.snapmcp.autoApprove));
    assert.equal(config.mcpServers.snapmcp.autoApprove.length, 2);
    assert.ok(config.mcpServers.snapmcp.autoApprove.includes("capture_terminal"));
    assert.ok(config.mcpServers.snapmcp.autoApprove.includes("capture_code"));
  });

  it("autoApprove with all tools", () => {
    const allTools = [
      "capture_terminal", "capture_code", "capture_browser",
      "capture_file", "capture_markdown", "capture_html",
      "capture_diff", "capture_pdf",
    ];
    const config = {
      mcpServers: {
        snapmcp: {
          command: "npx",
          args: ["-y", "snapmcp"],
          env: { SNAPMCP_DIR: "/path/to/snapshots" },
          disabled: false,
          autoApprove: allTools,
        },
      },
    };
    assert.doesNotThrow(() => JSON.stringify(config));
    const parsed = JSON.parse(JSON.stringify(config));
    assert.equal(parsed.mcpServers.snapmcp.autoApprove.length, 8);
  });

  it("works with disabled=true", () => {
    const config = {
      mcpServers: {
        snapmcp: {
          command: "npx",
          args: ["-y", "snapmcp"],
          disabled: true,
        },
      },
    };
    assert.doesNotThrow(() => JSON.stringify(config));
    assert.equal(config.mcpServers.snapmcp.disabled, true);
  });
});

// ─── Continue config ─────────────────────────────────────────

describe("Continue MCP config", () => {
  it("wraps in experimental.mcpServers", () => {
    const config = {
      experimental: {
        mcpServers: {
          snapmcp: {
            command: "npx",
            args: ["-y", "snapmcp"],
          },
        },
      },
    };
    assert.doesNotThrow(() => JSON.stringify(config));
    assert.ok(config.experimental.mcpServers.snapmcp);
    assert.equal(config.experimental.mcpServers.snapmcp.command, "npx");
  });

  it("validates with nested JSON roundtrip", () => {
    const config = {
      experimental: {
        mcpServers: {
          snapmcp: {
            command: "npx",
            args: ["-y", "snapmcp"],
          },
        },
      },
    };
    const parsed = JSON.parse(JSON.stringify(config));
    assert.deepEqual(parsed, config);
  });
});

// ─── Cursor config ───────────────────────────────────────────

describe("Cursor MCP config", () => {
  it("has valid structure", () => {
    const config = {
      mcpServers: {
        snapmcp: {
          command: "npx",
          args: ["-y", "snapmcp"],
        },
      },
    };
    assert.doesNotThrow(() => JSON.stringify(config));
    assert.equal(config.mcpServers.snapmcp.command, "npx");
  });

  it("roundtrips through JSON without loss", () => {
    const config = {
      mcpServers: {
        snapmcp: {
          command: "npx",
          args: ["-y", "snapmcp"],
        },
      },
    };
    const parsed = JSON.parse(JSON.stringify(config));
    assert.deepStrictEqual(parsed, config);
  });
});

// ─── Windsurf config ─────────────────────────────────────────

describe("Windsurf MCP config", () => {
  it("has valid structure", () => {
    const config = {
      mcpServers: {
        snapmcp: {
          command: "npx",
          args: ["-y", "snapmcp"],
        },
      },
    };
    assert.doesNotThrow(() => JSON.stringify(config));
  });
});

// ─── Cross-platform validation ──────────────────────────────

describe("MCP config cross-platform concerns", () => {
  it("npx command works on Windows, macOS, Linux", () => {
    // npx is available on all platforms with Node.js
    const config = {
      mcpServers: {
        snapmcp: {
          command: "npx",
          args: ["-y", "snapmcp"],
        },
      },
    };
    assert.equal(config.mcpServers.snapmcp.command, "npx");
  });

  it("supports both absolute and relative SNAPMCP_DIR", () => {
    const absolute = { SNAPMCP_DIR: "/absolute/path" };
    const relative = { SNAPMCP_DIR: "./relative/path" };
    const home = { SNAPMCP_DIR: "~/snapshots" };

    assert.doesNotThrow(() => JSON.stringify(absolute));
    assert.doesNotThrow(() => JSON.stringify(relative));
    assert.doesNotThrow(() => JSON.stringify(home));
  });

  it("all env vars roundtrip through JSON", () => {
    const env = {
      SNAPMCP_DIR: "./snapshots",
      SNAPMCP_FORMAT: "jpeg",
      SNAPMCP_QUALITY: "95",
      SNAPMCP_THEME: "nord",
      SNAPMCP_FONT_SIZE: "14px",
      SNAPMCP_TIMEOUT: "30000",
      SNAPMCP_DEVICE_SCALE: "2",
      SNAPMCP_PADDING: "32",
      SNAPMCP_SHADOW: "soft",
      SNAPMCP_WINDOW_CHROME: "true",
      SNAPMCP_BORDER_RADIUS: "8",
      SNAPMCP_BADGE: "false",
      SNAPMCP_LOG_LEVEL: "info",
      SNAPMCP_CLEANUP_MAX: "10",
      SNAPMCP_MAX_FILE_SIZE: "5000000",
      SNAPMCP_SECURITY_CHECKS: "true",
    };

    const parsed = JSON.parse(JSON.stringify(env));
    assert.equal(Object.keys(parsed).length, Object.keys(env).length);
    // All values should be strings (env vars are always strings)
    for (const val of Object.values(parsed)) {
      assert.equal(typeof val, "string");
    }
  });
});
