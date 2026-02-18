import process from 'node:process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { BoardStore } from './store.js';
import { SSEManager } from './sse.js';
import { registerTools } from './tools.js';
import { createApiRouter } from './api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createMcpServer(store: BoardStore): McpServer {
  const mcpServer = new McpServer({
    name: 'kanbrawl-mcp-server',
    version: '1.0.0',
  });
  registerTools(mcpServer, store);
  return mcpServer;
}

export type ServerOptions = {
  stdio?: boolean;
};

export async function startServer(
  options: ServerOptions = {},
): Promise<Server> {
  const log = options.stdio
    ? console.error.bind(console)
    : console.log.bind(console);

  // --- Initialize core services ---
  const store = new BoardStore();
  const sse = new SSEManager();
  const mcpServer = createMcpServer(store);

  // Wire SSE to store events
  store.onChange((event) => {
    sse.broadcast(event);
  });

  // --- MCP Transport ---
  if (options.stdio) {
    // Stdio transport for AI tool integrations
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
  }

  // --- Express App ---
  const app = express();
  app.use(express.json());

  // MCP Streamable HTTP endpoint (only when not using stdio transport)
  if (!options.stdio) {
    app.post('/mcp', async (request, res) => {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.on('close', async () => transport.close());
      await mcpServer.connect(transport);
      await transport.handleRequest(request, res, request.body);
    });
  }

  // SSE endpoint for live updates
  app.get('/events', (request, res) => {
    sse.addClient(res);

    // Send initial board state
    const board = store.getBoard();
    res.write(
      `event: board_sync\ndata: ${JSON.stringify({ type: 'board_sync', board })}\n\n`,
    );
  });

  // REST API for web UI
  app.use('/api', createApiRouter(store));

  // Serve static client files (production build)
  const clientDirectory = resolve(__dirname, '../../dist/client');
  if (existsSync(clientDirectory)) {
    app.use(express.static(clientDirectory));
    // SPA fallback
    app.get('/{*splat}', (_request, res) => {
      res.sendFile(resolve(clientDirectory, 'index.html'));
    });
  }

  // Start server
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  const server = app.listen(port, () => {
    log(`🥊 Kanbrawl server running on http://localhost:${port}`);
    if (!options.stdio) {
      log(`   MCP endpoint: http://localhost:${port}/mcp`);
    }

    log(`   MCP transport: ${options.stdio ? 'stdio' : 'HTTP'}`);
  });

  return server;
}
