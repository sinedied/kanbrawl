import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Task } from '../types.js';

@customElement('kanbrawl-board')
export class KanbrawlBoard extends LitElement {
  @property({ type: Array }) columns: string[] = [];
  @property({ type: Array }) tasks: Task[] = [];

  // Touch drag state (non-reactive, internal coordination only)
  private _touchDragId: string | undefined = null;
  private _touchTargetColumn: string | undefined = null;
  private _touchTimer: number | undefined = null;
  private _touchGhost: HTMLElement | undefined = null;
  private _touchStartX = 0;
  private _touchStartY = 0;

  static styles = css`
    :host {
      display: block;
      height: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 24px;
      box-sizing: border-box;
    }

    .board {
      display: flex;
      gap: 20px;
      height: 100%;
      min-width: min-content;
    }

    kanbrawl-column {
      flex: 1;
      min-width: 280px;
      max-width: 380px;
      height: 100%;
    }

    kanbrawl-column.folded {
      flex: 0 0 44px;
      min-width: 44px;
      max-width: 44px;
    }

    .touch-ghost {
      position: fixed;
      z-index: 9999;
      padding: 10px 16px;
      background: var(--accent);
      color: #fff;
      border-radius: 8px;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      font-weight: 600;
      pointer-events: none;
      opacity: 0.92;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      transform: scale(1.05);
    }

    @media (max-width: 768px) {
      :host {
        padding: 16px;
      }

      kanbrawl-column {
        min-width: 240px;
      }
    }

    @media (max-width: 600px) {
      :host {
        padding: 12px;
        height: auto;
        overflow-x: hidden;
        overflow-y: visible;
      }

      .board {
        flex-direction: column;
        min-width: 0;
        height: auto;
        gap: 16px;
      }

      kanbrawl-column {
        min-width: 0;
        max-width: none;
      }

      kanbrawl-column.folded {
        flex: 1 0 0%;
        min-width: 0;
        max-width: none;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('touchstart', this._onTouchStart, { passive: true });
    this.addEventListener('touchmove', this._onTouchMove, { passive: false });
    this.addEventListener('touchend', this._onTouchEnd);
    this.addEventListener('touchcancel', this._onTouchEnd);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('touchstart', this._onTouchStart);
    this.removeEventListener('touchmove', this._onTouchMove);
    this.removeEventListener('touchend', this._onTouchEnd);
    this.removeEventListener('touchcancel', this._onTouchEnd);
    this._cleanupTouchDrag();
  }

  private readonly _onTouchStart = (e: TouchEvent) => {
    const path = e.composedPath();

    // Don't initiate drag on interactive elements
    if (
      path.some(
        (element) =>
          element instanceof HTMLElement &&
          (element.tagName === 'INPUT' ||
            element.tagName === 'TEXTAREA' ||
            element.tagName === 'SELECT' ||
            element.tagName === 'BUTTON' ||
            element.classList.contains('edit-form') ||
            element.classList.contains('add-form')),
      )
    ) {
      return;
    }

    const taskElement = path.find(
      (element) =>
        element instanceof HTMLElement && element.tagName === 'KANBRAWL-TASK',
    ) as HTMLElement | undefined;
    if (!taskElement) return;

    const touch = e.touches[0];
    this._touchStartX = touch.clientX;
    this._touchStartY = touch.clientY;

    this._touchTimer = globalThis.setTimeout(() => {
      const taskId = (taskElement as any).task?.id as string | undefined;
      if (!taskId) return;
      this._startTouchDrag(taskId, touch.clientX, touch.clientY);
    }, 300);
  };

  private _startTouchDrag(taskId: string, x: number, y: number) {
    this._touchDragId = taskId;

    const ghost = document.createElement('div');
    ghost.className = 'touch-ghost';
    const task = this.tasks.find((t) => t.id === taskId);
    ghost.textContent = task?.title ?? '';
    ghost.style.left = `${x - 40}px`;
    ghost.style.top = `${y - 20}px`;
    this.shadowRoot!.append(ghost);
    this._touchGhost = ghost;

    // Haptic feedback
    navigator.vibrate?.(50);
  }

  private readonly _onTouchMove = (e: TouchEvent) => {
    // Cancel long-press if finger moved before timer fired
    if (this._touchTimer !== null && !this._touchDragId) {
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - this._touchStartX);
      const dy = Math.abs(touch.clientY - this._touchStartY);
      if (dx > 10 || dy > 10) {
        clearTimeout(this._touchTimer);
        this._touchTimer = null;
      }

      return;
    }

    if (!this._touchDragId) return;
    e.preventDefault(); // Prevent scroll while dragging

    const touch = e.touches[0];

    // Move ghost
    if (this._touchGhost) {
      this._touchGhost.style.left = `${touch.clientX - 40}px`;
      this._touchGhost.style.top = `${touch.clientY - 20}px`;
    }

    // Detect target column
    const columns = this.shadowRoot!.querySelectorAll('kanbrawl-column');
    let foundColumn: string | undefined = null;
    for (const col of columns) {
      const rect = col.getBoundingClientRect();
      if (
        touch.clientX >= rect.left &&
        touch.clientX <= rect.right &&
        touch.clientY >= rect.top &&
        touch.clientY <= rect.bottom
      ) {
        foundColumn = (col as any).name as string;
        break;
      }
    }

    // Update column highlights
    if (foundColumn !== this._touchTargetColumn) {
      for (const col of columns) {
        if ((col as any).name === foundColumn) {
          col.classList.add('drag-over');
        } else {
          col.classList.remove('drag-over');
        }
      }

      this._touchTargetColumn = foundColumn;
    }
  };

  private readonly _onTouchEnd = () => {
    if (this._touchTimer !== null) {
      clearTimeout(this._touchTimer);
      this._touchTimer = null;
    }

    if (this._touchDragId && this._touchTargetColumn) {
      const task = this.tasks.find((t) => t.id === this._touchDragId);
      if (task && task.column !== this._touchTargetColumn) {
        this.dispatchEvent(
          new CustomEvent('update-task', {
            detail: { id: this._touchDragId, column: this._touchTargetColumn },
            bubbles: true,
            composed: true,
          }),
        );
      }
    }

    this._cleanupTouchDrag();
  };

  private _cleanupTouchDrag() {
    if (this._touchTimer !== null) {
      clearTimeout(this._touchTimer);
      this._touchTimer = null;
    }

    if (this._touchGhost) {
      this._touchGhost.remove();
      this._touchGhost = null;
    }

    for (const col of this.shadowRoot?.querySelectorAll('kanbrawl-column') ??
      [])
      col.classList.remove('drag-over');
    this._touchDragId = null;
    this._touchTargetColumn = null;
  }

  render() {
    return html`
      <div class="board">
        ${this.columns.map(
          (column) => html`
            <kanbrawl-column
              .name=${column}
              .tasks=${this.tasks.filter((t) => t.column === column)}
              .allColumns=${this.columns}
            ></kanbrawl-column>
          `,
        )}
      </div>
    `;
  }
}
