#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { BoardStore } from "./store.js";
import { SSEManager } from "./sse.js";
import { registerTools } from "./tools.js";
import { createApiRouter } from "./api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Initialize core services ---
const store = new BoardStore();
const sse = new SSEManager();

// Wire SSE to store events
store.onChange((event) => sse.broadcast(event));

// --- MCP Server ---
const mcpServer = new McpServer({
  name: "kanbrawl-mcp-server",
  version: "1.0.0",
});

registerTools(mcpServer, store);

// --- Express App ---
const app = express();
app.use(express.json());

// MCP Streamable HTTP endpoint
app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => transport.close());
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// SSE endpoint for live updates
app.get("/events", (req, res) => {
  sse.addClient(res);

  // Send initial board state
  const board = store.getBoard();
  res.write(
    `event: board_sync\ndata: ${JSON.stringify({ type: "board_sync", board })}\n\n`,
  );
});

// REST API for web UI
app.use("/api", createApiRouter(store));

// Serve static client files (production build)
const clientDir = resolve(__dirname, "../client");
if (existsSync(clientDir)) {
  app.use(express.static(clientDir));
  // SPA fallback
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(resolve(clientDir, "index.html"));
  });
}

// Start server
const port = parseInt(process.env.PORT ?? "3000", 10);
app.listen(port, () => {
  console.log(`🥊 Kanbrawl server running on http://localhost:${port}`);
  console.log(`   MCP endpoint: http://localhost:${port}/mcp`);
  console.log(`   SSE endpoint: http://localhost:${port}/events`);
  console.log(`   API endpoint: http://localhost:${port}/api/board`);
});
