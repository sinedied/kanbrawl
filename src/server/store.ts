import process from 'node:process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { Task, Column, KanbrawlData, BoardEvent } from './types.js';

const DEFAULT_COLUMNS: Column[] = [
  { name: 'Todo', sortBy: 'priority', sortOrder: 'asc' },
  { name: 'In progress', sortBy: 'created', sortOrder: 'asc' },
  { name: 'Blocked', sortBy: 'created', sortOrder: 'asc' },
  { name: 'Done', sortBy: 'updated', sortOrder: 'desc' },
];

function migrateColumn(col: Column | string): Column {
  if (typeof col === 'string') {
    const lower = col.toLowerCase();
    if (lower === 'todo') {
      return { name: col, sortBy: 'priority', sortOrder: 'asc' };
    }

    if (lower === 'done') {
      return { name: col, sortBy: 'updated', sortOrder: 'desc' };
    }

    return { name: col, sortBy: 'created', sortOrder: 'asc' };
  }

  return {
    name: col.name,
    sortBy: col.sortBy ?? 'created',
    sortOrder: col.sortOrder ?? 'asc',
  };
}

function columnNames(columns: Column[]): string[] {
  return columns.map((c) => c.name);
}

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
      const parsed = JSON.parse(raw) as Partial<KanbrawlData> & {
        columns?: Array<Column | string>;
      };
      const columns = parsed.columns
        ? parsed.columns.map((c) => migrateColumn(c))
        : [...DEFAULT_COLUMNS];
      return {
        columns,
        tasks: parsed.tasks ?? [],
        ...(parsed.theme ? { theme: parsed.theme } : {}),
      };
    }

    const defaults: KanbrawlData = {
      columns: structuredClone(DEFAULT_COLUMNS),
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

  getColumns(): Column[] {
    return structuredClone(this.data.columns);
  }

  getColumnNames(): string[] {
    return columnNames(this.data.columns);
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
    const names = columnNames(this.data.columns);
    const targetColumn = column ?? names[0];
    if (!names.includes(targetColumn)) {
      throw new Error(
        `Column "${targetColumn}" does not exist. Available columns: ${names.join(', ')}`,
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
    const names = columnNames(this.data.columns);
    if (!names.includes(targetColumn)) {
      throw new Error(
        `Column "${targetColumn}" does not exist. Available columns: ${names.join(', ')}`,
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

  updateColumns(columns: Column[]): Column[] {
    if (!Array.isArray(columns) || columns.length === 0) {
      throw new Error('At least one column is required.');
    }

    const processed = columns
      .map((c) => ({
        ...c,
        name: c.name.trim(),
        sortBy: c.sortBy ?? 'created',
        sortOrder: c.sortOrder ?? 'asc',
      }))
      .filter((c) => c.name.length > 0);
    if (processed.length === 0) {
      throw new Error('At least one non-empty column name is required.');
    }

    // Deduplicate by name, keeping first occurrence
    const seen = new Set<string>();
    const unique = processed.filter((c) => {
      if (seen.has(c.name)) return false;
      seen.add(c.name);
      return true;
    });

    const newNames = columnNames(unique);
    const removedNames = columnNames(this.data.columns).filter(
      (n) => !newNames.includes(n),
    );

    // Move tasks from removed columns to the first remaining column
    if (removedNames.length > 0) {
      const fallback = unique[0].name;
      for (const task of this.data.tasks) {
        if (removedNames.includes(task.column)) {
          task.column = fallback;
          task.updatedAt = new Date().toISOString();
        }
      }
    }

    this.data.columns = unique;
    this.save();
    this.emit({ type: 'columns_updated', columns: structuredClone(unique) });
    return structuredClone(unique);
  }
}
