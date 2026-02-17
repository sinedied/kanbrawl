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

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      background: #12121c;
      border: 1px solid #1e1e30;
      border-radius: 12px;
      overflow: hidden;
    }

    .column-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 18px;
      background: linear-gradient(180deg, #16162a 0%, #12121c 100%);
      border-bottom: 1px solid #1e1e30;
    }

    .column-title {
      font-family: 'Space Mono', monospace;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #8888a8;
    }

    .task-count {
      font-family: 'Space Mono', monospace;
      font-size: 11px;
      color: #4a4a6a;
      background: #1a1a2e;
      padding: 3px 8px;
      border-radius: 10px;
      min-width: 24px;
      text-align: center;
    }

    .tasks-list {
      flex: 1;
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
      background: #2a2a3e;
      border-radius: 2px;
    }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
      color: #3a3a4e;
      font-size: 13px;
      font-style: italic;
    }

    .add-area {
      padding: 12px;
      border-top: 1px solid #1e1e30;
    }

    .add-btn {
      width: 100%;
      padding: 10px;
      background: transparent;
      border: 1px dashed #2a2a3e;
      border-radius: 8px;
      color: #5a5a7a;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .add-btn:hover {
      border-color: #ff6b35;
      color: #ff6b35;
      background: rgba(255, 107, 53, 0.05);
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
      background: #0e0e18;
      border: 1px solid #2a2a3e;
      border-radius: 6px;
      color: #e8e6e3;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      outline: none;
      transition: border-color 0.2s ease;
      box-sizing: border-box;
    }

    .add-form input:focus,
    .add-form textarea:focus {
      border-color: #ff6b35;
    }

    .add-form textarea {
      resize: vertical;
      min-height: 60px;
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
      background: #ff6b35;
      color: #0a0a0f;
    }

    .btn-confirm:hover {
      background: #ff8c61;
    }

    .btn-confirm:disabled {
      background: #3a3a4e;
      color: #6b6b7b;
      cursor: not-allowed;
    }

    .btn-cancel {
      background: #1e1e30;
      color: #8888a8;
    }

    .btn-cancel:hover {
      background: #2a2a3e;
    }
  `;

  private toggleAddForm() {
    this.showAddForm = !this.showAddForm;
    this.newTitle = "";
    this.newDescription = "";
  }

  private submitTask() {
    if (!this.newTitle.trim()) return;

    this.dispatchEvent(
      new CustomEvent("create-task", {
        detail: {
          title: this.newTitle.trim(),
          description: this.newDescription.trim(),
          column: this.name,
        },
        bubbles: true,
        composed: true,
      }),
    );

    this.showAddForm = false;
    this.newTitle = "";
    this.newDescription = "";
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
                  autofocus
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
