#!/usr/bin/env node

/**
 * Veda Lumina — Official Model Context Protocol (MCP) Server
 * 
 * Vedic astrology (Jyotish) tools over stdio: sidereal chart, Vimshottari
 * dasha, Panchanga limbs, Jaimini Chara Karakas and Vastu direction reference.
 * Tool logic lives in tools.ts; astronomy in astro.ts (astronomy-engine).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { TOOLS, callTool } from "./tools.js";

// Initialize Server
const server = new Server(
  {
    name: "veda-lumina-mcp",
    version: "1.1.2"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// List Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Call Tool Handler with real calculations
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  return callTool(name, args);
});

// Start Server on Stdio Transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Veda Lumina MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error in Veda Lumina MCP Server:", err);
  process.exit(1);
});
