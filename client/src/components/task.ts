import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { Task } from "../types.js";

@customElement("kanbrawl-task")
export class KanbrawlTask extends LitElement {
  @property({ type: Object }) task!: Task;
  @property({ type: Array }) allColumns: string[] = [];
  @state() private editing = false;
  @state() private editTitle = "";
  @state() private editDescription = "";
  @state() private showMoveMenu = false;

  static styles = css`
    :host {
      display: block;
      animation: slideIn 0.25s ease-out;
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
      cursor: default;
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

    .task-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 4px;
      line-height: 1.4;
      word-break: break-word;
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
    }

    .task-time {
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      color: var(--text-dimmed);
      letter-spacing: 0.5px;
    }

    .task-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.15s ease;
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

    /* Move menu */
    .move-menu {
      position: absolute;
      top: 100%;
      right: 8px;
      z-index: 10;
      background: var(--bg-surface);
      border: 1px solid var(--border-input);
      border-radius: 8px;
      padding: 4px;
      box-shadow: 0 8px 24px var(--shadow);
      min-width: 140px;
      margin-top: 4px;
    }

    .move-option {
      display: block;
      width: 100%;
      padding: 8px 12px;
      background: none;
      border: none;
      color: var(--text-secondary);
      font-family: 'DM Sans', sans-serif;
      font-size: 12px;
      text-align: left;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.1s ease;
    }

    .move-option:hover {
      background: var(--border-subtle);
      color: var(--accent);
    }

    .move-option.current {
      color: var(--text-placeholder);
      cursor: default;
    }

    .move-option.current:hover {
      background: none;
      color: var(--text-placeholder);
    }

    /* Edit form */
    .edit-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .edit-form input,
    .edit-form textarea {
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
      transition: border-color 0.2s ease, background 0.3s ease;
    }

    .edit-form input:focus,
    .edit-form textarea:focus {
      border-color: var(--accent);
    }

    .edit-form textarea {
      resize: vertical;
      min-height: 50px;
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
  `;

  private formatTime(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  private startEdit() {
    this.editing = true;
    this.editTitle = this.task.title;
    this.editDescription = this.task.description;
    this.showMoveMenu = false;
  }

  private cancelEdit() {
    this.editing = false;
  }

  private saveEdit() {
    if (!this.editTitle.trim()) return;
    this.dispatchEvent(
      new CustomEvent("update-task", {
        detail: {
          id: this.task.id,
          title: this.editTitle.trim(),
          description: this.editDescription.trim(),
        },
        bubbles: true,
        composed: true,
      }),
    );
    this.editing = false;
  }

  private moveToColumn(column: string) {
    if (column === this.task.column) return;
    this.dispatchEvent(
      new CustomEvent("update-task", {
        detail: { id: this.task.id, column },
        bubbles: true,
        composed: true,
      }),
    );
    this.showMoveMenu = false;
  }

  private handleDelete() {
    this.dispatchEvent(
      new CustomEvent("delete-task", {
        detail: { id: this.task.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private toggleMoveMenu() {
    this.showMoveMenu = !this.showMoveMenu;
  }

  private handleEditKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.saveEdit();
    }
    if (e.key === "Escape") {
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
              autofocus
            />
            <textarea
              .value=${this.editDescription}
              @input=${(e: InputEvent) =>
                (this.editDescription = (
                  e.target as HTMLTextAreaElement
                ).value)}
              @keydown=${this.handleEditKeydown}
            ></textarea>
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
        <div class="task-title">${this.task.title}</div>
        ${this.task.description
          ? html`<div class="task-description">${this.task.description}</div>`
          : nothing}
        <div class="task-meta">
          <span class="task-time">${this.formatTime(this.task.updatedAt)}</span>
          <div class="task-actions">
            <button
              class="action-btn"
              title="Move to column"
              @click=${this.toggleMoveMenu}
            >
              ↔
            </button>
            <button
              class="action-btn"
              title="Edit"
              @click=${this.startEdit}
            >
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
        ${this.showMoveMenu
          ? html`
              <div class="move-menu">
                ${this.allColumns.map(
                  (col) => html`
                    <button
                      class="move-option ${col === this.task.column
                        ? "current"
                        : ""}"
                      @click=${() => this.moveToColumn(col)}
                    >
                      ${col === this.task.column ? `● ${col}` : col}
                    </button>
                  `,
                )}
              </div>
            `
          : nothing}
      </div>
    `;
  }
}
