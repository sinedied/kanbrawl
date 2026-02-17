import { Router } from "express";
import type { BoardStore } from "./store.js";

export function createApiRouter(store: BoardStore): Router {
  const router = Router();

  // Get full board state
  router.get("/board", (_req, res) => {
    res.json(store.getBoard());
  });

  // Create a task
  router.post("/tasks", (req, res) => {
    try {
      const { title, description, column } = req.body as {
        title?: string;
        description?: string;
        column?: string;
      };

      if (!title || typeof title !== "string" || title.trim().length === 0) {
        res.status(400).json({ error: "Title is required" });
        return;
      }

      const task = store.createTask(title.trim(), description?.trim(), column);
      res.status(201).json(task);
    } catch (error) {
      res
        .status(400)
        .json({
          error: error instanceof Error ? error.message : String(error),
        });
    }
  });

  // Update a task (title, description, and/or column)
  router.patch("/tasks/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, column } = req.body as {
        title?: string;
        description?: string;
        column?: string;
      };

      // If column is being changed, move the task first
      if (column !== undefined) {
        store.moveTask(id, column);
      }

      // If title or description is being updated
      if (title !== undefined || description !== undefined) {
        const task = store.updateTask(id, { title, description });
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
      const message =
        error instanceof Error ? error.message : String(error);
      const status = message.includes("not found") ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  // Delete a task
  router.delete("/tasks/:id", (req, res) => {
    try {
      store.deleteTask(req.params.id);
      res.status(204).end();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      const status = message.includes("not found") ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  return router;
}
