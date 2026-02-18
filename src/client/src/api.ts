import type { Column } from './types.js';

const API_BASE = '';

export async function fetchBoard() {
  const res = await fetch(`${API_BASE}/api/board`);
  if (!res.ok) throw new Error(`Failed to fetch board: ${res.statusText}`);
  return res.json();
}

export async function createTask(
  title: string,
  description: string,
  column: string,
  priority?: string,
  assignee?: string,
) {
  const res = await fetch(`${API_BASE}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, column, priority, assignee }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error ?? 'Failed to create task');
  }

  return res.json();
}

export async function updateTask(
  id: string,
  fields: {
    title?: string;
    description?: string;
    column?: string;
    priority?: string;
    assignee?: string;
  },
) {
  const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error ?? 'Failed to update task');
  }

  return res.json();
}

export async function deleteTask(id: string) {
  const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 204) {
    const error = await res.json();
    throw new Error(error.error ?? 'Failed to delete task');
  }
}

export async function updateColumns(columns: Column[]) {
  const res = await fetch(`${API_BASE}/api/columns`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ columns }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error ?? 'Failed to update columns');
  }

  return res.json();
}
