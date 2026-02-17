import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Task } from "../types.js";

@customElement("kanbrawl-board")
export class KanbrawlBoard extends LitElement {
  @property({ type: Array }) columns: string[] = [];
  @property({ type: Array }) tasks: Task[] = [];

  static styles = css`
    :host {
      display: block;
      height: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 24px;
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
    }
  `;

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
