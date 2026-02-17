import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Board, Task } from './types.js';
import {
  fetchBoard,
  createTask,
  updateTask,
  deleteTask,
  updateColumns,
} from './api.js';
import './components/column-settings.js';

type Theme = 'light' | 'dark';

@customElement('kanbrawl-app')
export class KanbrawlApp extends LitElement {
  @state() private board: Board = { columns: [], tasks: [] };
  @state() private connected = false;
  @state() private error: string | undefined = null;
  @state() private theme: Theme = 'dark';
  @state() private selectedTask: Task | undefined = null;

  private eventSource: EventSource | undefined = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined = null;
  private reconnectDelay = 1000;

  private static get MAX_RECONNECT_DELAY() {
    return 30_000;
  }

  private static get BASE_RECONNECT_DELAY() {
    return 1000;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: var(--bg-base);
      color: var(--text-primary);
      transition:
        background 0.3s ease,
        color 0.3s ease;

      /* ── Dark theme (default) ── */
      --bg-base: #0a0a0f;
      --bg-surface: #12121c;
      --bg-surface-hover: #1a1a30;
      --bg-elevated: #16162a;
      --bg-elevated-hover: #1e1e36;
      --bg-input: #0e0e18;
      --bg-header: linear-gradient(135deg, #12121a 0%, #1a1a2e 100%);
      --bg-column-header: linear-gradient(180deg, #16162a 0%, #12121c 100%);
      --border-default: #2a2a42;
      --border-subtle: #2e2e48;
      --border-hover: #44446a;
      --border-input: #353550;
      --text-primary: #ebebeb;
      --text-secondary: #a0a0c0;
      --text-muted: #8888aa;
      --text-dimmed: #727292;
      --text-placeholder: #6a6a8e;
      --accent: #ff6b35;
      --accent-hover: #ff8c61;
      --accent-glow: rgba(255, 107, 53, 0.4);
      --accent-bg: rgba(255, 107, 53, 0.08);
      --accent-gradient: linear-gradient(135deg, #ff6b35, #ff8c61);
      --btn-secondary-bg: #22223a;
      --btn-secondary-hover: #30304e;
      --btn-disabled-bg: #3a3a4e;
      --btn-disabled-text: #8080a0;
      --status-text: #8a8aaa;
      --status-inactive: #505068;
      --error-bg: #2d1216;
      --error-border: #5c2028;
      --error-text: #ff6b6b;
      --delete-bg: #2d1216;
      --delete-text: #ff6b6b;
      --scrollbar: #353550;
      --shadow: rgba(0, 0, 0, 0.4);
      --count-bg: #1e1e34;
      --count-text: #7878a0;
      --empty-text: #686888;
    }

    :host([data-theme='light']) {
      --bg-base: #f2f0ed;
      --bg-surface: #ffffff;
      --bg-surface-hover: #f8f7f6;
      --bg-elevated: #ffffff;
      --bg-elevated-hover: #f5f4f2;
      --bg-input: #f8f7f5;
      --bg-header: linear-gradient(135deg, #ffffff 0%, #f5f3f0 100%);
      --bg-column-header: linear-gradient(180deg, #fafaf8 0%, #ffffff 100%);
      --border-default: #e0ddd8;
      --border-subtle: #e8e5e0;
      --border-hover: #d0ccc5;
      --border-input: #d8d4ce;
      --text-primary: #1a1a1a;
      --text-secondary: #5a5a68;
      --text-muted: #8a8a98;
      --text-dimmed: #aaa8b0;
      --text-placeholder: #b0aeb8;
      --accent: #e85a2a;
      --accent-hover: #d04e20;
      --accent-glow: rgba(232, 90, 42, 0.25);
      --accent-bg: rgba(232, 90, 42, 0.06);
      --accent-gradient: linear-gradient(135deg, #e85a2a, #ff7a48);
      --btn-secondary-bg: #eae8e4;
      --btn-secondary-hover: #dddad5;
      --btn-disabled-bg: #d8d5d0;
      --btn-disabled-text: #a0a0a8;
      --status-text: #8a8a98;
      --status-inactive: #c8c5c0;
      --error-bg: #fce8e8;
      --error-border: #f0b8b8;
      --error-text: #c0392b;
      --delete-bg: #fce8e8;
      --delete-text: #c0392b;
      --scrollbar: #d0ccc5;
      --shadow: rgba(0, 0, 0, 0.08);
      --count-bg: #f0eeea;
      --count-text: #8a8a98;
      --empty-text: #b0aeb8;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 16px;
      background: var(--bg-header);
      border-bottom: 1px solid var(--border-input);
      flex-shrink: 0;
      transition:
        background 0.3s ease,
        border-color 0.3s ease;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .logo-icon {
      font-size: 18px;
      filter: drop-shadow(0 0 8px var(--accent-glow));
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--status-inactive);
      transition: background 0.3s ease;
    }

    .status-dot.connected {
      background: #00e676;
      box-shadow: 0 0 8px rgba(0, 230, 118, 0.5);
    }

    .status-dot.reconnecting {
      background: #ef4444;
      box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.3;
      }
    }

    h1 {
      font-family: 'Space Mono', monospace;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .theme-toggle {
      background: none;
      border: 1px solid var(--border-input);
      color: var(--text-secondary);
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      border-radius: 6px;
      font-size: 16px;
      line-height: 1;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .theme-toggle:hover {
      border-color: var(--accent);
      color: var(--accent);
      background: var(--accent-bg);
    }

    .error-bar {
      background: var(--error-bg);
      border-bottom: 1px solid var(--error-border);
      padding: 8px 28px;
      font-size: 13px;
      color: var(--error-text);
      font-family: 'Space Mono', monospace;
      transition:
        background 0.3s ease,
        border-color 0.3s ease;
    }

    main {
      flex: 1;
      overflow: hidden;
      display: flex;
    }

    .board-area {
      flex: 1;
      overflow: hidden;
    }

    .detail-panel {
      width: 380px;
      flex-shrink: 0;
      background: var(--bg-surface);
      border-left: 1px solid var(--border-default);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      animation: slideInPanel 0.2s ease-out;
      transition:
        background 0.3s ease,
        border-color 0.3s ease;
    }

    @keyframes slideInPanel {
      from {
        transform: translateX(20px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .detail-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .detail-header-title {
      font-family: 'Space Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--text-muted);
    }

    .detail-close {
      background: none;
      border: 1px solid var(--border-input);
      color: var(--text-secondary);
      cursor: pointer;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      font-size: 14px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }

    .detail-close:hover {
      border-color: var(--accent);
      color: var(--accent);
      background: var(--accent-bg);
    }

    .detail-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .detail-task-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.4;
      word-break: break-word;
    }

    .detail-badges {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    .detail-badge {
      font-family: 'Space Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 4px;
      letter-spacing: 0.5px;
    }

    .detail-badge.priority-P0 {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }

    .detail-badge.priority-P1 {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
    }

    .detail-badge.priority-P2 {
      background: rgba(107, 114, 128, 0.15);
      color: #6b7280;
    }

    .detail-badge.column {
      background: var(--count-bg);
      color: var(--text-secondary);
    }

    .detail-badge.assignee {
      background: var(--accent-bg);
      color: var(--accent);
    }

    .detail-section-label {
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--text-dimmed);
      margin-bottom: 6px;
    }

    .detail-description {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.7;
      word-break: break-word;
      white-space: pre-wrap;
    }

    .detail-timestamps {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      color: var(--text-dimmed);
      letter-spacing: 0.5px;
      padding-top: 12px;
      border-top: 1px solid var(--border-subtle);
    }

    @media (max-width: 600px) {
      header {
        padding: 4px 10px;
      }

      h1 {
        font-size: 12px;
        letter-spacing: 1px;
      }

      .logo {
        gap: 6px;
      }

      .logo-icon {
        font-size: 14px;
      }

      .header-controls {
        gap: 8px;
      }

      .theme-toggle {
        padding: 4px 6px;
        font-size: 14px;
      }

      .status-dot {
        width: 6px;
        height: 6px;
      }

      .error-bar {
        padding: 6px 10px;
        font-size: 11px;
      }

      main {
        overflow: auto;
      }

      .detail-panel {
        width: 100%;
        max-width: 100%;
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        z-index: 100;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.initTheme();
    void this.loadBoard();
    this.connectSSE();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.closeSSE();
  }

  private closeSSE() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.eventSource?.close();
    this.eventSource = null;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectSSE();
    }, this.reconnectDelay);

    // Exponential backoff capped at MAX_RECONNECT_DELAY
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      KanbrawlApp.MAX_RECONNECT_DELAY,
    );
  }

  private initTheme() {
    const stored = localStorage.getItem('kanbrawl-theme') as Theme | undefined;
    this.theme = stored ?? this.getDefaultTheme();
    this.applyTheme();
  }

  private getDefaultTheme(): Theme {
    // Config from kanbrawl.json takes precedence over system preference
    if (this.board.theme) return this.board.theme;
    return globalThis.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }

  private toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('kanbrawl-theme', this.theme);
    this.applyTheme();
  }

  private applyTheme() {
    this.dataset.theme = this.theme;
    document.body.style.background =
      this.theme === 'light' ? '#f2f0ed' : '#0a0a0f';
    document.body.style.color = this.theme === 'light' ? '#1a1a1a' : '#ebebeb';
  }

  private async loadBoard() {
    try {
      this.board = await fetchBoard();
      this.error = null;
      // Re-evaluate theme now that we have the server config
      if (!localStorage.getItem('kanbrawl-theme') && this.board.theme) {
        this.theme = this.board.theme;
        this.applyTheme();
      }
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Failed to load board';
    }
  }

  private connectSSE() {
    this.closeSSE();
    this.eventSource = new EventSource('/events');

    this.eventSource.addEventListener('board_sync', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      this.board = { ...data.board };
      this.connected = true;
      this.error = null;
      this.reconnectDelay = KanbrawlApp.BASE_RECONNECT_DELAY;
    });

    this.eventSource.addEventListener('task_created', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      this.board = {
        ...this.board,
        tasks: [...this.board.tasks, data.task],
      };
    });

    this.eventSource.addEventListener('task_updated', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      this.board = {
        ...this.board,
        tasks: this.board.tasks.map((t) =>
          t.id === data.task.id ? data.task : t,
        ),
      };
    });

    this.eventSource.addEventListener('task_moved', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      this.board = {
        ...this.board,
        tasks: this.board.tasks.map((t) =>
          t.id === data.task.id ? data.task : t,
        ),
      };
    });

    this.eventSource.addEventListener('task_deleted', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      if (this.selectedTask?.id === data.taskId) {
        this.selectedTask = null;
      }

      this.board = {
        ...this.board,
        tasks: this.board.tasks.filter((t) => t.id !== data.taskId),
      };
    });

    this.eventSource.addEventListener('columns_updated', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      this.board = {
        ...this.board,
        columns: data.columns,
      };
    });

    this.eventSource.addEventListener('open', () => {
      this.connected = true;
      this.error = null;
      this.reconnectDelay = KanbrawlApp.BASE_RECONNECT_DELAY;
      // Re-fetch board to catch any events missed during disconnect
      void this.loadBoard();
    });

    this.eventSource.addEventListener('error', () => {
      this.connected = false;
      // Close and manually reconnect to ensure clean state
      this.eventSource?.close();
      this.eventSource = null;
      this.scheduleReconnect();
    });
  }

  private async handleCreateTask(
    e: CustomEvent<{
      title: string;
      description: string;
      column: string;
      priority?: string;
      assignee?: string;
    }>,
  ) {
    try {
      await createTask(
        e.detail.title,
        e.detail.description,
        e.detail.column,
        e.detail.priority,
        e.detail.assignee,
      );
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Failed to create task';
    }
  }

  private async handleUpdateTask(
    e: CustomEvent<{
      id: string;
      title?: string;
      description?: string;
      column?: string;
      priority?: string;
      assignee?: string;
    }>,
  ) {
    try {
      const { id, ...fields } = e.detail;
      await updateTask(id, fields);
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Failed to update task';
    }
  }

  private async handleDeleteTask(e: CustomEvent<{ id: string }>) {
    try {
      await deleteTask(e.detail.id);
      // Close panel if the deleted task was being viewed
      if (this.selectedTask?.id === e.detail.id) {
        this.selectedTask = null;
      }
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Failed to delete task';
    }
  }

  private handleViewTask(e: CustomEvent<{ task: Task }>) {
    this.selectedTask = e.detail.task;
  }

  private closeDetailPanel() {
    this.selectedTask = null;
  }

  private formatTimestamp(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  private renderDetailPanel() {
    const task = this.selectedTask;
    if (!task) return null;

    // Get the latest version from the board
    const current = this.board.tasks.find((t) => t.id === task.id);
    if (!current) return null;

    return html`
      <div class="detail-panel">
        <div class="detail-header">
          <span class="detail-header-title">Task Detail</span>
          <button
            class="detail-close"
            title="Close"
            @click=${this.closeDetailPanel}
          >
            ✕
          </button>
        </div>
        <div class="detail-body">
          <div class="detail-task-title">${current.title}</div>
          <div class="detail-badges">
            <span class="detail-badge priority-${current.priority}"
              >${current.priority}</span
            >
            <span class="detail-badge column">${current.column}</span>
            ${current.assignee
              ? html`<span class="detail-badge assignee"
                  >${current.assignee}</span
                >`
              : null}
          </div>
          ${current.description
            ? html`
                <div>
                  <div class="detail-section-label">Description</div>
                  <div class="detail-description">${current.description}</div>
                </div>
              `
            : null}
          <div class="detail-timestamps">
            <span>Created: ${this.formatTimestamp(current.createdAt)}</span>
            <span>Updated: ${this.formatTimestamp(current.updatedAt)}</span>
          </div>
        </div>
      </div>
    `;
  }

  private async handleUpdateColumns(e: CustomEvent<{ columns: string[] }>) {
    try {
      await updateColumns(e.detail.columns);
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Failed to update columns';
    }
  }

  render() {
    return html`
      <header>
        <div class="logo">
          <span class="logo-icon">🥊</span>
          <h1>Kanbrawl</h1>
          <div
            class="status-dot ${this.connected ? 'connected' : 'reconnecting'}"
            title=${this.connected ? 'Connected' : 'Reconnecting...'}
          ></div>
        </div>
        <div class="header-controls">
          <kanbrawl-column-settings
            .columns=${this.board.columns}
            @update-columns=${this.handleUpdateColumns}
          ></kanbrawl-column-settings>
          <button
            class="theme-toggle"
            title="Toggle theme"
            @click=${this.toggleTheme}
          >
            ${this.theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>
      ${this.error ? html`<div class="error-bar">⚠ ${this.error}</div>` : null}
      <main>
        <div class="board-area">
          <kanbrawl-board
            .columns=${this.board.columns}
            .tasks=${this.board.tasks}
            @create-task=${this.handleCreateTask}
            @update-task=${this.handleUpdateTask}
            @delete-task=${this.handleDeleteTask}
            @view-task=${this.handleViewTask}
          ></kanbrawl-board>
        </div>
        ${this.selectedTask ? this.renderDetailPanel() : null}
      </main>
    `;
  }
}
