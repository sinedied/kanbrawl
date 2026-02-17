import { Router } from 'express';
import type { BoardStore } from './store.js';

export function createApiRouter(store: BoardStore): Router {
  const router = Router();

  // Get full board state
  router.get('/board', (_request, res) => {
    res.json(store.getBoard());
  });

  // Create a task
  router.post('/tasks', (request, res) => {
    try {
      const { title, description, column, priority, assignee } =
        request.body as {
          title?: string;
          description?: string;
          column?: string;
          priority?: string;
          assignee?: string;
        };

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        res.status(400).json({ error: 'Title is required' });
        return;
      }

      const task = store.createTask(
        title.trim(),
        description?.trim(),
        column,
        priority,
        assignee?.trim(),
      );
      res.status(201).json(task);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Update a task (title, description, and/or column)
  router.patch('/tasks/:id', (request, res) => {
    try {
      const { id } = request.params;
      const { title, description, column, priority, assignee } =
        request.body as {
          title?: string;
          description?: string;
          column?: string;
          priority?: string;
          assignee?: string;
        };

      // If column is being changed, move the task first
      if (column !== undefined) {
        store.moveTask(id, column);
      }

      // If any updatable fields are being changed
      if (
        title !== undefined ||
        description !== undefined ||
        priority !== undefined ||
        assignee !== undefined
      ) {
        const task = store.updateTask(id, {
          title,
          description,
          priority,
          assignee,
        });
        res.json(task);
      } else {
        // Only column was changed, return the task
        const task = store.getTask(id);
        if (!task) {
          res.status(404).json({ error: `Task "${id}" not found` });
          return;
        }

        res.json(task);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = message.includes('not found') ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  // Delete a task
  router.delete('/tasks/:id', (request, res) => {
    try {
      store.deleteTask(request.params.id);
      res.status(204).end();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = message.includes('not found') ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  // Update columns
  router.put('/columns', (request, res) => {
    try {
      const { columns } = request.body as { columns?: string[] };
      if (!columns || !Array.isArray(columns)) {
        res.status(400).json({ error: 'columns must be an array of strings' });
        return;
      }

      const updated = store.updateColumns(columns);
      res.json({ columns: updated });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
