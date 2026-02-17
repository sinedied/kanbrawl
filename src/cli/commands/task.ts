import process from 'node:process';
import { BoardStore } from '../../server/store.js';

type TaskOptions = {
  description?: string;
  column?: string;
  priority?: string;
  assignee?: string;
  update?: boolean;
};

export function taskAction(title: string, options: TaskOptions): void {
  const store = new BoardStore();
  const priority = options.priority
    ? (`P${options.priority}` as const)
    : undefined;

  if (options.update) {
    const tasks = store.getTasks();
    const existing = tasks.find(
      (t) => t.title.toLowerCase() === title.toLowerCase(),
    );

    if (!existing) {
      console.error(`Error: No task found with title "${title}"`);
      process.exitCode = 1;
      return;
    }

    const updates: Record<string, string | undefined> = {};
    if (options.description !== undefined) {
      updates.description = options.description;
    }

    if (priority !== undefined) {
      updates.priority = priority;
    }

    if (options.assignee !== undefined) {
      updates.assignee = options.assignee;
    }

    const updated = store.updateTask(existing.id, updates);

    if (options.column) {
      store.moveTask(existing.id, options.column);
    }

    console.log(`✅ Task updated: ${updated.title} (${updated.id})`);
  } else {
    const task = store.createTask(
      title,
      options.description,
      options.column,
      priority,
      options.assignee,
    );
    console.log(`✅ Task created: ${task.title} (${task.id})`);
  }
}
