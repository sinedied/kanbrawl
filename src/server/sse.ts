import type { Response } from 'express';
import type { BoardEvent } from './types.js';

export class SSEManager {
  private readonly clients = new Set<Response>();

  addClient(res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders();

    this.clients.add(res);

    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  broadcast(event: BoardEvent): void {
    const data = JSON.stringify(event);
    for (const client of this.clients) {
      client.write(`event: ${event.type}\ndata: ${data}\n\n`);
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}
