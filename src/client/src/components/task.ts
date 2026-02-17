import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Task } from '../types.js';

@customElement('kanbrawl-task')
export class KanbrawlTask extends LitElement {
  @property({ type: Object }) task!: Task;
  @property({ type: Array }) allColumns: string[] = [];
  @state() private editing = false;
  @state() private editTitle = '';
  @state() private editDescription = '';

  static styles = css`
    :host {
      display: block;
      animation: slideIn 0.25s ease-out;
      cursor: grab;
      -webkit-user-select: none;
      user-select: none;
    }

    :host(:active) {
      cursor: grabbing;
    }

    :host(.dragging) {
      opacity: 0.4;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-8px) scale(0.97);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .task-card {
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 14px;
      transition: all 0.2s ease;
      position: relative;
    }

    .task-card:hover {
      border-color: var(--border-hover);
      background: var(--bg-elevated-hover);
    }

    .task-card:hover .task-actions {
      opacity: 1;
    }

    .task-header {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 4px;
    }

    .priority-badge {
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      letter-spacing: 0.5px;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .priority-P0 {
      background: var(--priority-p0-bg, rgba(239, 68, 68, 0.15));
      color: var(--priority-p0-text, #ef4444);
    }

    .priority-P1 {
      background: var(--priority-p1-bg, rgba(245, 158, 11, 0.15));
      color: var(--priority-p1-text, #f59e0b);
    }

    .priority-P2 {
      background: var(--priority-p2-bg, rgba(107, 114, 128, 0.15));
      color: var(--priority-p2-text, #6b7280);
    }

    .task-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      line-height: 1.4;
      word-break: break-word;
      flex: 1;
    }

    .task-description {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 8px;
      word-break: break-word;
      white-space: pre-wrap;
    }

    .task-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .task-meta-left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .task-time {
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      color: var(--text-dimmed);
      letter-spacing: 0.5px;
      flex-shrink: 0;
    }

    .task-assignee {
      font-size: 11px;
      color: var(--text-secondary);
      background: var(--count-bg);
      padding: 2px 8px;
      border-radius: 10px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 120px;
    }

    .task-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.15s ease;
      flex-shrink: 0;
    }

    .action-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 4px;
      font-size: 14px;
      line-height: 1;
      transition: all 0.15s ease;
    }

    .action-btn:hover {
      background: var(--border-subtle);
      color: var(--text-secondary);
    }

    .action-btn.delete:hover {
      background: var(--delete-bg);
      color: var(--delete-text);
    }

    /* Edit form */
    .edit-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .edit-form input,
    .edit-form textarea,
    .edit-form select {
      width: 100%;
      padding: 8px 10px;
      background: var(--bg-input);
      border: 1px solid var(--border-input);
      border-radius: 4px;
      color: var(--text-primary);
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      outline: none;
      box-sizing: border-box;
      transition:
        border-color 0.2s ease,
        background 0.3s ease;
    }

    .edit-form input:focus,
    .edit-form textarea:focus,
    .edit-form select:focus {
      border-color: var(--accent);
    }

    .edit-form textarea {
      resize: vertical;
      min-height: 50px;
    }

    .edit-form select {
      cursor: pointer;
    }

    .edit-row {
      display: flex;
      gap: 8px;
    }

    .edit-row > * {
      flex: 1;
    }

    .edit-actions {
      display: flex;
      gap: 6px;
    }

    .edit-actions button {
      flex: 1;
      padding: 6px;
      border-radius: 4px;
      border: none;
      font-family: 'DM Sans', sans-serif;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-save {
      background: var(--accent);
      color: #fff;
    }

    .btn-save:hover {
      background: var(--accent-hover);
    }

    .btn-edit-cancel {
      background: var(--btn-secondary-bg);
      color: var(--text-secondary);
    }

    .btn-edit-cancel:hover {
      background: var(--btn-secondary-hover);
    }

    @media (max-width: 600px) {
      .task-card {
        padding: 12px;
      }

      .task-actions {
        opacity: 1;
      }

      .action-btn {
        padding: 8px 10px;
        font-size: 16px;
      }

      .edit-row {
        flex-direction: column;
      }
    }
  `;

  @state() private editPriority = 'P1';
  @state() private editAssignee = '';

  connectedCallback() {
    super.connectedCallback();
    this.draggable = true;
    this.addEventListener('dragstart', this._onDragStart);
    this.addEventListener('dragend', this._onDragEnd);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('dragstart', this._onDragStart);
    this.removeEventListener('dragend', this._onDragEnd);
  }

  private readonly _onDragStart = (e: DragEvent) => {
    if (this.editing) {
      e.preventDefault();
      return;
    }

    e.dataTransfer?.setData('text/plain', this.task.id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    requestAnimationFrame(() => {
      this.classList.add('dragging');
    });
  };

  private readonly _onDragEnd = () => {
    this.classList.remove('dragging');
  };

  private formatTime(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  private startEdit() {
    this.editing = true;
    this.draggable = false;
    this.editTitle = this.task.title;
    this.editDescription = this.task.description;
    this.editPriority = this.task.priority;
    this.editAssignee = this.task.assignee;
  }

  private cancelEdit() {
    this.editing = false;
    this.draggable = true;
  }

  private saveEdit() {
    if (!this.editTitle.trim()) return;
    this.dispatchEvent(
      new CustomEvent('update-task', {
        detail: {
          id: this.task.id,
          title: this.editTitle.trim(),
          description: this.editDescription.trim(),
          priority: this.editPriority,
          assignee: this.editAssignee.trim(),
        },
        bubbles: true,
        composed: true,
      }),
    );
    this.editing = false;
    this.draggable = true;
  }

  private handleDelete() {
    this.dispatchEvent(
      new CustomEvent('delete-task', {
        detail: { id: this.task.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleEditKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.saveEdit();
    }

    if (e.key === 'Escape') {
      this.cancelEdit();
    }
  }

  render() {
    if (this.editing) {
      return html`
        <div class="task-card">
          <div class="edit-form">
            <input
              type="text"
              .value=${this.editTitle}
              @input=${(e: InputEvent) =>
                (this.editTitle = (e.target as HTMLInputElement).value)}
              @keydown=${this.handleEditKeydown}
            />
            <textarea
              .value=${this.editDescription}
              @input=${(e: InputEvent) =>
                (this.editDescription = (
                  e.target as HTMLTextAreaElement
                ).value)}
              @keydown=${this.handleEditKeydown}
            ></textarea>
            <div class="edit-row">
              <select
                .value=${this.editPriority}
                @change=${(e: Event) =>
                  (this.editPriority = (e.target as HTMLSelectElement).value)}
              >
                <option value="P0">P0 — Critical</option>
                <option value="P1">P1 — Normal</option>
                <option value="P2">P2 — Low</option>
              </select>
              <input
                type="text"
                placeholder="Assignee (optional)"
                .value=${this.editAssignee}
                @input=${(e: InputEvent) =>
                  (this.editAssignee = (e.target as HTMLInputElement).value)}
                @keydown=${this.handleEditKeydown}
              />
            </div>
            <div class="edit-actions">
              <button class="btn-save" @click=${this.saveEdit}>Save</button>
              <button class="btn-edit-cancel" @click=${this.cancelEdit}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      `;
    }

    return html`
      <div class="task-card">
        <div class="task-header">
          <span class="priority-badge priority-${this.task.priority}"
            >${this.task.priority}</span
          >
          <div class="task-title">${this.task.title}</div>
        </div>
        ${this.task.description
          ? html`<div class="task-description">${this.task.description}</div>`
          : nothing}
        <div class="task-meta">
          <div class="task-meta-left">
            <span class="task-time"
              >${this.formatTime(this.task.updatedAt)}</span
            >
            ${this.task.assignee
              ? html`<span class="task-assignee" title=${this.task.assignee}
                  >${this.task.assignee}</span
                >`
              : nothing}
          </div>
          <div class="task-actions">
            <button class="action-btn" title="Edit" @click=${this.startEdit}>
              ✎
            </button>
            <button
              class="action-btn delete"
              title="Delete"
              @click=${this.handleDelete}
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
