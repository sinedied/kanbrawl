import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { Task } from "../types.js";

@customElement("kanbrawl-column")
export class KanbrawlColumn extends LitElement {
  @property() name = "";
  @property({ type: Array }) tasks: Task[] = [];
  @property({ type: Array }) allColumns: string[] = [];
  @state() private showAddForm = false;
  @state() private newTitle = "";
  @state() private newDescription = "";
  @state() private newPriority = "P1";
  @state() private newAssignee = "";
  @state() private dragOver = false;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      background: var(--bg-surface);
      border: 1px solid var(--border-default);
      border-radius: 12px;
      overflow: hidden;
      transition: background 0.3s ease, border-color 0.3s ease;
    }

    :host(.drag-over) {
      border-color: var(--accent);
      background: var(--accent-bg);
    }

    .column-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 18px;
      background: var(--bg-column-header);
      border-bottom: 1px solid var(--border-default);
      transition: background 0.3s ease, border-color 0.3s ease;
      flex-shrink: 0;
    }

    .column-title {
      font-family: 'Space Mono', monospace;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--text-secondary);
    }

    .task-count {
      font-family: 'Space Mono', monospace;
      font-size: 11px;
      color: var(--count-text);
      background: var(--count-bg);
      padding: 3px 8px;
      border-radius: 10px;
      min-width: 24px;
      text-align: center;
      transition: background 0.3s ease, color 0.3s ease;
    }

    .tasks-list {
      flex: 1;
      min-height: 60px;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .tasks-list::-webkit-scrollbar {
      width: 4px;
    }

    .tasks-list::-webkit-scrollbar-track {
      background: transparent;
    }

    .tasks-list::-webkit-scrollbar-thumb {
      background: var(--scrollbar);
      border-radius: 2px;
    }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
      color: var(--empty-text);
      font-size: 13px;
      font-style: italic;
    }

    .add-area {
      padding: 12px;
      border-top: 1px solid var(--border-default);
      transition: border-color 0.3s ease;
      flex-shrink: 0;
    }

    .add-btn {
      width: 100%;
      padding: 10px;
      background: transparent;
      border: 1px dashed var(--border-input);
      border-radius: 8px;
      color: var(--text-muted);
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .add-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
      background: var(--accent-bg);
    }

    .add-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .add-form input,
    .add-form textarea {
      width: 100%;
      padding: 10px 12px;
      background: var(--bg-input);
      border: 1px solid var(--border-input);
      border-radius: 6px;
      color: var(--text-primary);
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      outline: none;
      transition: border-color 0.2s ease, background 0.3s ease;
      box-sizing: border-box;
    }

    .add-form input:focus,
    .add-form textarea:focus {
      border-color: var(--accent);
    }

    .add-form textarea {
      resize: vertical;
      min-height: 60px;
    }

    .add-form select {
      width: 100%;
      padding: 10px 12px;
      background: var(--bg-input);
      border: 1px solid var(--border-input);
      border-radius: 6px;
      color: var(--text-primary);
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      outline: none;
      transition: border-color 0.2s ease, background 0.3s ease;
      box-sizing: border-box;
      cursor: pointer;
    }

    .add-form select:focus {
      border-color: var(--accent);
    }

    .form-row {
      display: flex;
      gap: 8px;
    }

    .form-row > * {
      flex: 1;
    }

    .form-actions {
      display: flex;
      gap: 8px;
    }

    .form-actions button {
      flex: 1;
      padding: 8px;
      border-radius: 6px;
      border: none;
      font-family: 'DM Sans', sans-serif;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-confirm {
      background: var(--accent);
      color: #fff;
    }

    .btn-confirm:hover {
      background: var(--accent-hover);
    }

    .btn-confirm:disabled {
      background: var(--btn-disabled-bg);
      color: var(--btn-disabled-text);
      cursor: not-allowed;
    }

    .btn-cancel {
      background: var(--btn-secondary-bg);
      color: var(--text-secondary);
    }

    .btn-cancel:hover {
      background: var(--btn-secondary-hover);
    }

    @media (max-width: 600px) {
      .column-header {
        padding: 12px 14px;
      }

      .tasks-list {
        padding: 8px;
      }

      .add-area {
        padding: 8px;
      }

      .add-btn {
        padding: 10px;
        font-size: 14px;
      }
    }
  `;

  // --- Drag & drop ---
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("dragover", this._onDragOver);
    this.addEventListener("dragleave", this._onDragLeave);
    this.addEventListener("drop", this._onDrop);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("dragover", this._onDragOver);
    this.removeEventListener("dragleave", this._onDragLeave);
    this.removeEventListener("drop", this._onDrop);
  }

  private _onDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    if (!this.dragOver) {
      this.dragOver = true;
      this.classList.add("drag-over");
    }
  };

  private _onDragLeave = (e: DragEvent) => {
    // Only clear when leaving the host element itself
    const rect = this.getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      this.dragOver = false;
      this.classList.remove("drag-over");
    }
  };

  private _onDrop = (e: DragEvent) => {
    e.preventDefault();
    this.dragOver = false;
    this.classList.remove("drag-over");

    const taskId = e.dataTransfer?.getData("text/plain");
    if (!taskId) return;

    // Only fire if task isn't already in this column
    const existingTask = this.tasks.find((t) => t.id === taskId);
    if (existingTask) return;

    this.dispatchEvent(
      new CustomEvent("update-task", {
        detail: { id: taskId, column: this.name },
        bubbles: true,
        composed: true,
      }),
    );
  };

  private toggleAddForm() {
    this.showAddForm = !this.showAddForm;
    this.newTitle = "";
    this.newDescription = "";
    this.newPriority = "P1";
    this.newAssignee = "";
    if (this.showAddForm) {
      this.updateComplete.then(() => {
        this.shadowRoot?.querySelector<HTMLInputElement>('.add-form input')?.focus();
      });
    }
  }

  private submitTask() {
    if (!this.newTitle.trim()) return;

    this.dispatchEvent(
      new CustomEvent("create-task", {
        detail: {
          title: this.newTitle.trim(),
          description: this.newDescription.trim(),
          column: this.name,
          priority: this.newPriority,
          assignee: this.newAssignee.trim(),
        },
        bubbles: true,
        composed: true,
      }),
    );

    this.showAddForm = false;
    this.newTitle = "";
    this.newDescription = "";
    this.newPriority = "P1";
    this.newAssignee = "";
  }

  private handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.submitTask();
    }
    if (e.key === "Escape") {
      this.toggleAddForm();
    }
  }

  render() {
    return html`
      <div class="column-header">
        <span class="column-title">${this.name}</span>
        <span class="task-count">${this.tasks.length}</span>
      </div>
      <div class="tasks-list">
        ${this.tasks.length === 0
          ? html`<div class="empty-state">No tasks</div>`
          : this.tasks.map(
              (task) => html`
                <kanbrawl-task
                  .task=${task}
                  .allColumns=${this.allColumns}
                ></kanbrawl-task>
              `,
            )}
      </div>
      <div class="add-area">
        ${this.showAddForm
          ? html`
              <div class="add-form">
                <input
                  type="text"
                  placeholder="Task title"
                  .value=${this.newTitle}
                  @input=${(e: InputEvent) =>
                    (this.newTitle = (e.target as HTMLInputElement).value)}
                  @keydown=${this.handleKeydown}
                />
                <textarea
                  placeholder="Description (optional)"
                  .value=${this.newDescription}
                  @input=${(e: InputEvent) =>
                    (this.newDescription = (
                      e.target as HTMLTextAreaElement
                    ).value)}
                  @keydown=${this.handleKeydown}
                ></textarea>
                <div class="form-row">
                  <select
                    .value=${this.newPriority}
                    @change=${(e: Event) =>
                      (this.newPriority = (e.target as HTMLSelectElement).value)}
                  >
                    <option value="P0">P0 – Critical</option>
                    <option value="P1" selected>P1 – Normal</option>
                    <option value="P2">P2 – Low</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Assignee (optional)"
                    .value=${this.newAssignee}
                    @input=${(e: InputEvent) =>
                      (this.newAssignee = (e.target as HTMLInputElement).value)}
                    @keydown=${this.handleKeydown}
                  />
                </div>
                <div class="form-actions">
                  <button
                    class="btn-confirm"
                    ?disabled=${!this.newTitle.trim()}
                    @click=${this.submitTask}
                  >
                    Add task
                  </button>
                  <button class="btn-cancel" @click=${this.toggleAddForm}>
                    Cancel
                  </button>
                </div>
              </div>
            `
          : html`
              <button class="add-btn" @click=${this.toggleAddForm}>
                + Add task
              </button>
            `}
      </div>
    `;
  }
}
