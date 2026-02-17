import process from 'node:process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { Task, KanbrawlData, BoardEvent } from './types.js';

const DEFAULT_COLUMNS = ['Todo', 'In progress', 'Blocked', 'Done'];

export class BoardStore {
  private readonly data: KanbrawlData;
  private readonly filePath: string;
  private listeners: Array<(event: BoardEvent) => void> = [];

  constructor(filePath?: string) {
    this.filePath = filePath ?? resolve(process.cwd(), 'kanbrawl.json');
    this.data = this.load();
  }

  private load(): KanbrawlData {
    if (existsSync(this.filePath)) {
      const raw = readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<KanbrawlData>;
      return {
        columns: parsed.columns ?? DEFAULT_COLUMNS,
        tasks: parsed.tasks ?? [],
        ...(parsed.theme ? { theme: parsed.theme } : {}),
      };
    }

    const defaults: KanbrawlData = {
      columns: [...DEFAULT_COLUMNS],
      tasks: [],
    };
    this.save(defaults);
    return defaults;
  }

  private save(data?: KanbrawlData): void {
    writeFileSync(
      this.filePath,
      JSON.stringify(data ?? this.data, null, 2) + '\n',
      'utf8',
    );
  }

  private emit(event: BoardEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  onChange(listener: (event: BoardEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getBoard(): KanbrawlData {
    return structuredClone(this.data);
  }

  getColumns(): string[] {
    return [...this.data.columns];
  }

  getTasks(column?: string): Task[] {
    const tasks = column
      ? this.data.tasks.filter((t) => t.column === column)
      : this.data.tasks;
    return structuredClone(tasks);
  }

  getTask(id: string): Task | undefined {
    const task = this.data.tasks.find((t) => t.id === id);
    return task ? structuredClone(task) : undefined;
  }

  createTask(
    title: string,
    description?: string,
    column?: string,
    priority?: string,
    assignee?: string,
  ): Task {
    const targetColumn = column ?? this.data.columns[0];
    if (!this.data.columns.includes(targetColumn)) {
      throw new Error(
        `Column "${targetColumn}" does not exist. Available columns: ${this.data.columns.join(', ')}`,
      );
    }

    const now = new Date().toISOString();
    const task: Task = {
      id: uuidv4(),
      title,
      description: description ?? '',
      column: targetColumn,
      priority: (priority as Task['priority']) ?? 'P1',
      assignee: assignee ?? '',
      createdAt: now,
      updatedAt: now,
    };

    this.data.tasks.push(task);
    this.save();
    this.emit({ type: 'task_created', task: structuredClone(task) });
    return structuredClone(task);
  }

  moveTask(id: string, targetColumn: string): Task {
    if (!this.data.columns.includes(targetColumn)) {
      throw new Error(
        `Column "${targetColumn}" does not exist. Available columns: ${this.data.columns.join(', ')}`,
      );
    }

    const task = this.data.tasks.find((t) => t.id === id);
    if (!task) {
      throw new Error(`Task with id "${id}" not found.`);
    }

    const fromColumn = task.column;
    task.column = targetColumn;
    task.updatedAt = new Date().toISOString();
    this.save();
    this.emit({
      type: 'task_moved',
      task: structuredClone(task),
      fromColumn,
    });
    return structuredClone(task);
  }

  updateTask(
    id: string,
    fields: {
      title?: string;
      description?: string;
      priority?: string;
      assignee?: string;
    },
  ): Task {
    const task = this.data.tasks.find((t) => t.id === id);
    if (!task) {
      throw new Error(`Task with id "${id}" not found.`);
    }

    if (fields.title !== undefined) task.title = fields.title;
    if (fields.description !== undefined) task.description = fields.description;
    if (fields.priority !== undefined)
      task.priority = fields.priority as Task['priority'];
    if (fields.assignee !== undefined) task.assignee = fields.assignee;
    task.updatedAt = new Date().toISOString();
    this.save();
    this.emit({ type: 'task_updated', task: structuredClone(task) });
    return structuredClone(task);
  }

  deleteTask(id: string): void {
    const index = this.data.tasks.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error(`Task with id "${id}" not found.`);
    }

    this.data.tasks.splice(index, 1);
    this.save();
    this.emit({ type: 'task_deleted', taskId: id });
  }

  updateColumns(columns: string[]): string[] {
    if (!Array.isArray(columns) || columns.length === 0) {
      throw new Error('At least one column is required.');
    }

    const trimmed = columns.map((c) => c.trim()).filter((c) => c.length > 0);
    if (trimmed.length === 0) {
      throw new Error('At least one non-empty column name is required.');
    }

    const unique = [...new Set(trimmed)];
    const removedColumns = this.data.columns.filter((c) => !unique.includes(c));

    // Move tasks from removed columns to the first remaining column
    if (removedColumns.length > 0) {
      const fallback = unique[0];
      for (const task of this.data.tasks) {
        if (removedColumns.includes(task.column)) {
          task.column = fallback;
          task.updatedAt = new Date().toISOString();
        }
      }
    }

    this.data.columns = unique;
    this.save();
    this.emit({ type: 'columns_updated', columns: [...unique] });
    return [...unique];
  }
}
