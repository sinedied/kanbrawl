import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BoardStore } from '../../server/store.js';
import { createMcpServer, startServer } from '../../server/index.js';

type StartOptions = {
  stdio?: boolean;
};

export async function startAction(options: StartOptions): Promise<void> {
  if (options.stdio) {
    const store = new BoardStore();
    const mcpServer = createMcpServer(store);
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
  } else {
    startServer();
  }
}
