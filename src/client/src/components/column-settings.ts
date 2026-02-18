import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Column, SortBy, SortOrder } from '../types.js';

@customElement('kanbrawl-column-settings')
export class KanbrawlColumnSettings extends LitElement {
  @property({ type: Array }) columns: Column[] = [];
  @state() private editColumns: Column[] = [];
  @state() private open = false;

  static styles = css`
    :host {
      display: inline-block;
    }

    .settings-btn {
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

    .settings-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
      background: var(--accent-bg);
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.15s ease;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .modal {
      background: var(--bg-surface);
      border: 1px solid var(--border-default);
      border-radius: 12px;
      padding: 20px;
      width: 360px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 64px);
      overflow-y: auto;
      box-shadow: 0 8px 30px var(--shadow);
      animation: slideUp 0.2s ease;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .modal-title {
      font-family: 'Space Mono', monospace;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--text-secondary);
      margin: 0 0 16px;
    }

    .column-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }

    .column-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .column-row input {
      flex: 1;
      padding: 8px 10px;
      background: var(--bg-input);
      border: 1px solid var(--border-input);
      border-radius: 6px;
      color: var(--text-primary);
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      outline: none;
      transition: border-color 0.2s ease;
      box-sizing: border-box;
    }

    .column-row input:focus {
      border-color: var(--accent);
    }

    .drag-handle {
      cursor: grab;
      color: var(--text-dimmed);
      font-size: 14px;
      user-select: none;
      padding: 4px;
      flex-shrink: 0;
    }

    .drag-handle:active {
      cursor: grabbing;
    }

    .remove-btn {
      background: none;
      border: none;
      color: var(--text-dimmed);
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 4px;
      font-size: 14px;
      line-height: 1;
      transition: all 0.15s ease;
      flex-shrink: 0;
    }

    .remove-btn:hover {
      color: var(--delete-text);
      background: var(--delete-bg);
    }

    .remove-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .remove-btn:disabled:hover {
      color: var(--text-dimmed);
      background: none;
    }

    .add-column-btn {
      width: 100%;
      padding: 8px;
      background: transparent;
      border: 1px dashed var(--border-input);
      border-radius: 6px;
      color: var(--text-muted);
      font-family: 'DM Sans', sans-serif;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-bottom: 16px;
    }

    .add-column-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
      background: var(--accent-bg);
    }

    .modal-actions {
      display: flex;
      gap: 8px;
    }

    .modal-actions button {
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

    .btn-save {
      background: var(--accent);
      color: #fff;
    }

    .btn-save:hover {
      background: var(--accent-hover);
    }

    .btn-save:disabled {
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

    .move-btns {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex-shrink: 0;
    }

    .move-btn {
      background: none;
      border: none;
      color: var(--text-dimmed);
      cursor: pointer;
      padding: 0 4px;
      font-size: 10px;
      line-height: 1;
      transition: color 0.15s ease;
    }

    .move-btn:hover {
      color: var(--accent);
    }

    .move-btn:disabled {
      opacity: 0.2;
      cursor: not-allowed;
    }

    .move-btn:disabled:hover {
      color: var(--text-dimmed);
    }

    .sort-row {
      display: flex;
      gap: 6px;
      padding: 0 0 0 30px;
      margin-top: -4px;
    }

    .sort-row select {
      flex: 1;
      padding: 5px 8px;
      background: var(--bg-input);
      border: 1px solid var(--border-input);
      border-radius: 5px;
      color: var(--text-secondary);
      font-family: 'DM Sans', sans-serif;
      font-size: 11px;
      outline: none;
      transition: border-color 0.2s ease;
      box-sizing: border-box;
      cursor: pointer;
    }

    .sort-row select:focus {
      border-color: var(--accent);
    }

    .sort-label {
      font-size: 10px;
      color: var(--text-dimmed);
      font-family: 'Space Mono', monospace;
      letter-spacing: 0.5px;
      align-self: center;
      flex-shrink: 0;
    }
  `;

  show() {
    this.editColumns = structuredClone(this.columns);
    this.open = true;
  }

  private close() {
    this.open = false;
  }

  private handleOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('overlay')) {
      this.close();
    }
  }

  private updateColumnName(index: number, value: string) {
    this.editColumns = this.editColumns.map((c, index_) =>
      index_ === index ? { ...c, name: value } : c,
    );
  }

  private updateSortBy(index: number, value: SortBy) {
    this.editColumns = this.editColumns.map((c, index_) =>
      index_ === index ? { ...c, sortBy: value } : c,
    );
  }

  private updateSortOrder(index: number, value: SortOrder) {
    this.editColumns = this.editColumns.map((c, index_) =>
      index_ === index ? { ...c, sortOrder: value } : c,
    );
  }

  private async addColumn() {
    this.editColumns = [
      ...this.editColumns,
      { name: '', sortBy: 'created', sortOrder: 'asc' },
    ];
    await this.updateComplete;
    const inputs =
      this.shadowRoot?.querySelectorAll<HTMLInputElement>('.column-row input');
    inputs?.[inputs.length - 1]?.focus();
  }

  private removeColumn(index: number) {
    this.editColumns = this.editColumns.filter((_, index_) => index_ !== index);
  }

  private moveColumn(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= this.editColumns.length) return;
    const cols = [...this.editColumns];
    [cols[index], cols[target]] = [cols[target], cols[index]];
    this.editColumns = cols;
  }

  private get isValid(): boolean {
    const trimmed = this.editColumns
      .map((c) => c.name.trim())
      .filter((c) => c.length > 0);
    if (trimmed.length === 0) return false;
    // Check for duplicates
    return new Set(trimmed).size === trimmed.length;
  }

  private save() {
    if (!this.isValid) return;
    const columns = this.editColumns
      .filter((c) => c.name.trim().length > 0)
      .map((c) => ({ ...c, name: c.name.trim() }));
    this.dispatchEvent(
      new CustomEvent('update-columns', {
        detail: { columns },
        bubbles: true,
        composed: true,
      }),
    );
    this.close();
  }

  private handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') this.close();
    if (e.key === 'Enter') this.save();
  }

  render() {
    return html`
      <button
        class="settings-btn"
        title="Configure columns"
        @click=${this.show}
      >
        ⚙
      </button>
      ${this.open
        ? html`
            <div class="overlay" @click=${this.handleOverlayClick}>
              <div class="modal" @keydown=${this.handleKeydown}>
                <h2 class="modal-title">Columns</h2>
                <div class="column-list">
                  ${this.editColumns.map(
                    (col, index) => html`
                      <div class="column-row">
                        <div class="move-btns">
                          <button
                            class="move-btn"
                            ?disabled=${index === 0}
                            @click=${() => {
                              this.moveColumn(index, -1);
                            }}
                            title="Move up"
                          >
                            ▲
                          </button>
                          <button
                            class="move-btn"
                            ?disabled=${index === this.editColumns.length - 1}
                            @click=${() => {
                              this.moveColumn(index, 1);
                            }}
                            title="Move down"
                          >
                            ▼
                          </button>
                        </div>
                        <input
                          type="text"
                          .value=${col.name}
                          placeholder="Column name"
                          @input=${(e: InputEvent) => {
                            this.updateColumnName(
                              index,
                              (e.target as HTMLInputElement).value,
                            );
                          }}
                        />
                        <button
                          class="remove-btn"
                          ?disabled=${this.editColumns.length <= 1}
                          @click=${() => {
                            this.removeColumn(index);
                          }}
                          title="Remove column"
                        >
                          ✕
                        </button>
                      </div>
                      <div class="sort-row">
                        <span class="sort-label">Sort</span>
                        <select
                          .value=${col.sortBy}
                          @change=${(e: Event) => {
                            this.updateSortBy(
                              index,
                              (e.target as HTMLSelectElement).value as SortBy,
                            );
                          }}
                        >
                          <option value="priority">Priority</option>
                          <option value="created">Created</option>
                          <option value="updated">Updated</option>
                        </select>
                        <select
                          .value=${col.sortOrder}
                          @change=${(e: Event) => {
                            this.updateSortOrder(
                              index,
                              (e.target as HTMLSelectElement)
                                .value as SortOrder,
                            );
                          }}
                        >
                          <option value="asc">Ascending</option>
                          <option value="desc">Descending</option>
                        </select>
                      </div>
                    `,
                  )}
                </div>
                <button class="add-column-btn" @click=${this.addColumn}>
                  + Add column
                </button>
                <div class="modal-actions">
                  <button
                    class="btn-save"
                    ?disabled=${!this.isValid}
                    @click=${this.save}
                  >
                    Save
                  </button>
                  <button class="btn-cancel" @click=${this.close}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          `
        : null}
    `;
  }
}
