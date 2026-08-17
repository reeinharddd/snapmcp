import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerHintTool(server: McpServer): void {
  server.tool(
    "snapmcp-hint",
    "Return a helpful hint about configuring and using snapmcp.",
    {
      topic: z.string().optional().describe("Optional topic: init, doctor, browser, themes, output"),
    },
    async ({ topic }) => {
      const hints: Record<string, string> = {
        init: "Run `snapmcp init` to configure output directory, theme, and browser profile interactively.",
        doctor: "Run `snapmcp doctor` to diagnose your system setup and verify all dependencies.",
        browser: "Set SNAPMCP_CHROME_EXECUTABLE to your Chrome/Chromium path to use your real browser profile for captures.",
        themes: "Set SNAPMCP_THEME to one of 27 themes: dracula, nord, catppuccin-mocha, tokyo-night, and more.",
        output: "Set SNAPMCP_DIR to control where captures are saved (default: ./captures).",
      };
      
      const generic = "Need help configuring snapmcp? Run `snapmcp init` to set up your output directory, terminal theme, and browser profile interactively.";
      const text = topic && hints[topic] ? hints[topic] : generic;
      
      return { content: [{ type: "text", text }] };
    },
  );
}
