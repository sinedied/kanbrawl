import * as http from 'node:http';

// ── Types (mirrors src/server/types.ts) ─────────────────────────────

export type Priority = 'P0' | 'P1' | 'P2';
export type SortBy = 'priority' | 'created' | 'updated';
export type SortOrder = 'asc' | 'desc';

export type Column = {
  name: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  column: string;
  priority: Priority;
  assignee: string;
  createdAt: string;
  updatedAt: string;
};

export type KanbrawlData = {
  columns: Column[];
  tasks: Task[];
  theme?: 'light' | 'dark';
};

export type BoardEvent =
  | { type: 'task_created'; task: Task }
  | { type: 'task_updated'; task: Task }
  | { type: 'task_moved'; task: Task; fromColumn: string }
  | { type: 'task_deleted'; taskId: string }
  | { type: 'columns_updated'; columns: Column[] }
  | { type: 'board_sync'; board: KanbrawlData };

// ── REST API client ─────────────────────────────────────────────────

export class KanbrawlApiClient {
  private sseRequest: http.ClientRequest | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private reconnectDelay = 1000;
  private disposed = false;
  private onEvent: ((event: BoardEvent) => void) | undefined;

  constructor(private readonly baseUrl: string) {}

  private get maxReconnectDelay() {
    return 30_000;
  }

  async getBoard(): Promise<KanbrawlData> {
    const response = await fetch(`${this.baseUrl}/api/board`);
    if (!response.ok) {
      throw new Error(`Failed to fetch board: ${response.statusText}`);
    }

    return response.json() as Promise<KanbrawlData>;
  }

  async moveTask(id: string, column: string): Promise<Task> {
    const response = await fetch(`${this.baseUrl}/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column }),
    });
    if (!response.ok) {
      const error = (await response.json()) as { error?: string };
      throw new Error(error.error ?? 'Failed to move task');
    }

    return response.json() as Promise<Task>;
  }

  async updateTask(
    id: string,
    fields: {
      title?: string;
      description?: string;
      priority?: string;
      assignee?: string;
    },
  ): Promise<Task> {
    const response = await fetch(`${this.baseUrl}/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!response.ok) {
      const error = (await response.json()) as { error?: string };
      throw new Error(error.error ?? 'Failed to update task');
    }

    return response.json() as Promise<Task>;
  }

  // ── SSE connection ──────────────────────────────────────────────

  connectSSE(onEvent: (event: BoardEvent) => void): void {
    this.onEvent = onEvent;
    this.disposed = false;
    this.startSSE();
  }

  private startSSE(): void {
    if (this.disposed) {
      return;
    }

    this.closeSSE();

    const url = new URL(`${this.baseUrl}/events`);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    };

    this.sseRequest = http.request(options, (res) => {
      if (res.statusCode !== 200) {
        this.scheduleReconnect();
        return;
      }

      this.reconnectDelay = 1000;
      let buffer = '';

      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        buffer += chunk;
        const messages = buffer.split('\n\n');
        // Keep the last (possibly incomplete) chunk in the buffer
        buffer = messages.pop() ?? '';

        for (const message of messages) {
          this.parseSSEMessage(message);
        }
      });

      res.on('end', () => {
        this.scheduleReconnect();
      });

      res.on('error', () => {
        this.scheduleReconnect();
      });
    });

    this.sseRequest.on('error', () => {
      this.scheduleReconnect();
    });

    this.sseRequest.end();
  }

  private parseSSEMessage(message: string): void {
    let eventType = '';
    let data = '';

    for (const line of message.split('\n')) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        data = line.slice(6);
      }
    }

    if (eventType && data && this.onEvent) {
      try {
        const parsed = JSON.parse(data) as BoardEvent;
        this.onEvent(parsed);
      } catch {
        // Ignore malformed JSON
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.startSSE();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      this.maxReconnectDelay,
    );
  }

  private closeSSE(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.sseRequest) {
      this.sseRequest.destroy();
      this.sseRequest = undefined;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.closeSSE();
  }
}
