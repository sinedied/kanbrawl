import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { Board, Task } from "./types.js";
import { fetchBoard, createTask, updateTask, deleteTask } from "./api.js";

@customElement("kanbrawl-app")
export class KanbrawlApp extends LitElement {
  @state() private board: Board = { columns: [], tasks: [] };
  @state() private connected = false;
  @state() private error: string | null = null;

  private eventSource: EventSource | null = null;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: #0a0a0f;
      color: #e8e6e3;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 28px;
      background: linear-gradient(135deg, #12121a 0%, #1a1a2e 100%);
      border-bottom: 1px solid #2a2a3e;
      flex-shrink: 0;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-icon {
      font-size: 28px;
      filter: drop-shadow(0 0 8px rgba(255, 107, 53, 0.4));
    }

    h1 {
      font-family: 'Space Mono', monospace;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
      background: linear-gradient(135deg, #ff6b35, #ff8c61);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-family: 'Space Mono', monospace;
      color: #6b6b7b;
      letter-spacing: 1px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #3d3d4d;
      transition: background 0.3s ease;
    }

    .status-dot.connected {
      background: #00e676;
      box-shadow: 0 0 8px rgba(0, 230, 118, 0.5);
    }

    .error-bar {
      background: #2d1216;
      border-bottom: 1px solid #5c2028;
      padding: 8px 28px;
      font-size: 13px;
      color: #ff6b6b;
      font-family: 'Space Mono', monospace;
    }

    main {
      flex: 1;
      overflow: hidden;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadBoard();
    this.connectSSE();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.eventSource?.close();
  }

  private async loadBoard() {
    try {
      this.board = await fetchBoard();
      this.error = null;
    } catch (e) {
      this.error = e instanceof Error ? e.message : "Failed to load board";
    }
  }

  private connectSSE() {
    this.eventSource = new EventSource("/events");

    this.eventSource.addEventListener("board_sync", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      this.board = { ...data.board };
      this.connected = true;
      this.error = null;
    });

    this.eventSource.addEventListener("task_created", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      this.board = {
        ...this.board,
        tasks: [...this.board.tasks, data.task],
      };
    });

    this.eventSource.addEventListener("task_updated", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      this.board = {
        ...this.board,
        tasks: this.board.tasks.map((t) =>
          t.id === data.task.id ? data.task : t,
        ),
      };
    });

    this.eventSource.addEventListener("task_moved", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      this.board = {
        ...this.board,
        tasks: this.board.tasks.map((t) =>
          t.id === data.task.id ? data.task : t,
        ),
      };
    });

    this.eventSource.addEventListener("task_deleted", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      this.board = {
        ...this.board,
        tasks: this.board.tasks.filter((t) => t.id !== data.taskId),
      };
    });

    this.eventSource.onopen = () => {
      this.connected = true;
      this.error = null;
    };

    this.eventSource.onerror = () => {
      this.connected = false;
    };
  }

  private async handleCreateTask(
    e: CustomEvent<{ title: string; description: string; column: string }>,
  ) {
    try {
      await createTask(e.detail.title, e.detail.description, e.detail.column);
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to create task";
    }
  }

  private async handleUpdateTask(
    e: CustomEvent<{
      id: string;
      title?: string;
      description?: string;
      column?: string;
    }>,
  ) {
    try {
      const { id, ...fields } = e.detail;
      await updateTask(id, fields);
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to update task";
    }
  }

  private async handleDeleteTask(e: CustomEvent<{ id: string }>) {
    try {
      await deleteTask(e.detail.id);
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to delete task";
    }
  }

  render() {
    return html`
      <header>
        <div class="logo">
          <span class="logo-icon">🥊</span>
          <h1>Kanbrawl</h1>
        </div>
        <div class="status">
          <div class="status-dot ${this.connected ? "connected" : ""}"></div>
          ${this.connected ? "LIVE" : "CONNECTING"}
        </div>
      </header>
      ${this.error
        ? html`<div class="error-bar">⚠ ${this.error}</div>`
        : null}
      <main>
        <kanbrawl-board
          .columns=${this.board.columns}
          .tasks=${this.board.tasks}
          @create-task=${this.handleCreateTask}
          @update-task=${this.handleUpdateTask}
          @delete-task=${this.handleDeleteTask}
        ></kanbrawl-board>
      </main>
    `;
  }
}
