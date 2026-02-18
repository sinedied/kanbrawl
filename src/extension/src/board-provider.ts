import * as vscode from 'vscode';
import {
  type Task,
  type Column,
  type KanbrawlData,
  type BoardEvent,
  type Priority,
  type KanbrawlApiClient,
} from './api.js';

// ── Priority icons ──────────────────────────────────────────────────

const PRIORITY_ICONS: Record<Priority, vscode.ThemeIcon> = {
  P0: new vscode.ThemeIcon(
    'circle-filled',
    new vscode.ThemeColor('charts.red'),
  ),
  P1: new vscode.ThemeIcon(
    'circle-outline',
    new vscode.ThemeColor('charts.yellow'),
  ),
  P2: new vscode.ThemeIcon('circle-large-outline'),
};

// ── Tree item types ─────────────────────────────────────────────────

export type BoardItem =
  | { kind: 'column'; column: Column; tasks: Task[] }
  | { kind: 'task'; task: Task };

// ── Sort helpers ────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<Priority, number> = { P0: 0, P1: 1, P2: 2 };

function sortTasks(tasks: Task[], column: Column): Task[] {
  const sorted = [...tasks];
  const dir = column.sortOrder === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    switch (column.sortBy) {
      case 'priority': {
        return (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) * dir;
      }

      case 'created': {
        return (
          (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) *
          dir
        );
      }

      case 'updated': {
        return (
          (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) *
          dir
        );
      }
    }

    return 0;
  });

  return sorted;
}

// ── Tree MIME type ──────────────────────────────────────────────────

const TREE_MIME = 'application/vnd.code.tree.kanbrawlBoard';

// ── BoardTreeProvider ───────────────────────────────────────────────

export class BoardTreeProvider
  implements
    vscode.TreeDataProvider<BoardItem>,
    vscode.TreeDragAndDropController<BoardItem>
{
  // Tree change events
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    BoardItem | BoardItem[] | undefined | void
  >();

  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // Drag and drop
  readonly dragMimeTypes: readonly string[] = [TREE_MIME];
  readonly dropMimeTypes: readonly string[] = [TREE_MIME];

  // State
  private board: KanbrawlData = { columns: [], tasks: [] };

  constructor(private readonly api: KanbrawlApiClient) {}

  // ── Data loading ────────────────────────────────────────────────

  async loadBoard(): Promise<void> {
    try {
      this.board = await this.api.getBoard();
      this._onDidChangeTreeData.fire();
    } catch {
      // Will retry on next SSE reconnect or manual refresh
    }
  }

  handleEvent(event: BoardEvent): void {
    switch (event.type) {
      case 'board_sync': {
        this.board = event.board;
        break;
      }

      case 'task_created': {
        this.board = {
          ...this.board,
          tasks: [...this.board.tasks, event.task],
        };
        break;
      }

      case 'task_updated':
      case 'task_moved': {
        this.board = {
          ...this.board,
          tasks: this.board.tasks.map((t) =>
            t.id === event.task.id ? event.task : t,
          ),
        };
        break;
      }

      case 'task_deleted': {
        this.board = {
          ...this.board,
          tasks: this.board.tasks.filter((t) => t.id !== event.taskId),
        };
        break;
      }

      case 'columns_updated': {
        this.board = {
          ...this.board,
          columns: event.columns,
        };
        break;
      }
    }

    this._onDidChangeTreeData.fire();
  }

  getColumnNames(): string[] {
    return this.board.columns.map((c) => c.name);
  }

  // ── TreeDataProvider ────────────────────────────────────────────

  getTreeItem(element: BoardItem): vscode.TreeItem {
    if (element.kind === 'column') {
      const { column, tasks } = element;
      const item = new vscode.TreeItem(
        `${column.name} (${tasks.length})`,
        tasks.length > 0
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.contextValue = 'column';
      item.iconPath = new vscode.ThemeIcon('layout');
      item.tooltip = `${column.name} — sorted by ${column.sortBy} (${column.sortOrder})`;
      return item;
    }

    // Task
    const { task } = element;
    const item = new vscode.TreeItem(
      task.title,
      vscode.TreeItemCollapsibleState.None,
    );
    item.id = task.id;
    item.contextValue = 'task';
    item.iconPath = PRIORITY_ICONS[task.priority] ?? PRIORITY_ICONS.P1;
    item.description = task.assignee || undefined;

    const lines = [`**${task.priority}** — ${task.title}`];
    if (task.description) {
      lines.push(task.description);
    }

    if (task.assignee) {
      lines.push(`Assignee: ${task.assignee}`);
    }

    lines.push(`Updated: ${new Date(task.updatedAt).toLocaleString()}`);
    item.tooltip = new vscode.MarkdownString(lines.join('\n\n'));

    return item;
  }

  getChildren(element?: BoardItem): BoardItem[] {
    if (!element) {
      // Root — return columns with their tasks
      return this.board.columns.map((column) => {
        const tasks = sortTasks(
          this.board.tasks.filter((t) => t.column === column.name),
          column,
        );
        return { kind: 'column' as const, column, tasks };
      });
    }

    if (element.kind === 'column') {
      return element.tasks.map((task) => ({
        kind: 'task' as const,
        task,
      }));
    }

    return [];
  }

  getParent(element: BoardItem): BoardItem | undefined {
    if (element.kind === 'task') {
      const column = this.board.columns.find(
        (c) => c.name === element.task.column,
      );
      if (column) {
        const tasks = sortTasks(
          this.board.tasks.filter((t) => t.column === column.name),
          column,
        );
        return { kind: 'column', column, tasks };
      }
    }

    return undefined;
  }

  // ── Drag & Drop ─────────────────────────────────────────────────

  handleDrag(
    source: readonly BoardItem[],
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ): void {
    const taskIds = source
      .filter(
        (item): item is BoardItem & { kind: 'task' } => item.kind === 'task',
      )
      .map((item) => item.task.id);

    if (taskIds.length > 0) {
      dataTransfer.set(TREE_MIME, new vscode.DataTransferItem(taskIds));
    }
  }

  async handleDrop(
    target: BoardItem | undefined,
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    if (!target) {
      return;
    }

    const transferItem = dataTransfer.get(TREE_MIME);
    if (!transferItem) {
      return;
    }

    const taskIds = transferItem.value as string[];
    const targetColumn =
      target.kind === 'column' ? target.column.name : target.task.column;

    const moves = taskIds.map(async (id) => {
      try {
        await this.api.moveTask(id, targetColumn);
      } catch (error) {
        void vscode.window.showErrorMessage(
          `Failed to move task: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    await Promise.all(moves);
    // SSE event will trigger tree refresh
  }

  // ── Dispose ─────────────────────────────────────────────────────

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
