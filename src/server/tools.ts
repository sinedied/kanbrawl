import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { BoardStore } from "./store.js";

export function registerTools(
  server: McpServer,
  store: BoardStore,
): void {
  const columns = store.getColumns();

  server.registerTool(
    "get_columns",
    {
      title: "Get Columns",
      description: `Get the list of kanban board columns with task counts.

Returns:
  JSON array of objects, each with:
  - name (string): Column name
  - taskCount (number): Number of tasks in the column

Example return:
  [{ "name": "Todo", "taskCount": 3 }, { "name": "In progress", "taskCount": 1 }, { "name": "Done", "taskCount": 5 }]`,
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const allTasks = store.getTasks();
      const columnsWithCounts = store.getColumns().map((name) => ({
        name,
        taskCount: allTasks.filter((t) => t.column === name).length,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(columnsWithCounts, null, 2) }],
      };
    },
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List Tasks",
      description: `List tasks on the kanban board, optionally filtered by column and priority.

Args:
  - column (string, optional): Filter tasks to a specific column. Defaults to "${columns[0]}". Available columns: ${columns.join(", ")}
  - priority (string, optional): Filter tasks by priority level. One of: P0, P1, P2

Returns:
  JSON array of tasks, each with: id, title, description, column, priority (P0-P2), assignee, createdAt, updatedAt

Examples:
  - List todo tasks (default): {}
  - List tasks in "In progress": { "column": "In progress" }
  - List high-priority todo tasks: { "priority": "P0" }
  - List all P1 tasks in "Done": { "column": "Done", "priority": "P1" }`,
      inputSchema: {
        column: z
          .string()
          .optional()
          .describe(
            `Column name to filter by. Defaults to "${columns[0]}". Available: ${columns.join(", ")}`,
          ),
        priority: z
          .enum(["P0", "P1", "P2"])
          .optional()
          .describe("Filter tasks by priority level"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ column, priority }) => {
      const targetColumn = column ?? columns[0];
      if (!store.getColumns().includes(targetColumn)) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Column "${targetColumn}" does not exist. Available columns: ${store.getColumns().join(", ")}`,
            },
          ],
          isError: true,
        };
      }
      let tasks = store.getTasks(targetColumn);
      if (priority) {
        tasks = tasks.filter((t) => t.priority === priority);
      }
      return {
        content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }],
      };
    },
  );

  server.registerTool(
    "create_task",
    {
      title: "Create Task",
      description: `Create a new task on the kanban board.

Args:
  - title (string, required): Task title (1-200 chars)
  - description (string, optional): Task description (max 2000 chars)
  - column (string, optional): Column to place the task in. Defaults to "${columns[0]}". Available: ${columns.join(", ")}
  - priority (string, optional): Task priority. One of: P0, P1, P2. Defaults to P1
  - assignee (string, optional): Name of the person or agent assigned to this task

Returns:
  The created task as JSON with: id, title, description, column, priority, assignee, createdAt, updatedAt`,
      inputSchema: {
        title: z
          .string()
          .min(1, "Title is required")
          .max(200, "Title must not exceed 200 characters")
          .describe("Task title"),
        description: z
          .string()
          .max(2000, "Description must not exceed 2000 characters")
          .optional()
          .describe("Task description"),
        column: z
          .string()
          .optional()
          .describe(
            `Column to place task in. Defaults to "${columns[0]}". Available: ${columns.join(", ")}`,
          ),
        priority: z
          .enum(["P0", "P1", "P2"])
          .optional()
          .describe("Task priority. Defaults to P1"),
        assignee: z
          .string()
          .max(100)
          .optional()
          .describe("Name of the person or agent assigned to this task"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ title, description, column, priority, assignee }) => {
      try {
        const task = store.createTask(title, description, column, priority, assignee);
        return {
          content: [{ type: "text", text: JSON.stringify(task, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "move_task",
    {
      title: "Move Task",
      description: `Move an existing task to a different column.

Args:
  - id (string, required): The task ID (UUID)
  - column (string, required): Target column name. Available: ${columns.join(", ")}

Returns:
  The updated task as JSON

Errors:
  - If the task ID is not found
  - If the column name is invalid`,
      inputSchema: {
        id: z.string().describe("Task ID (UUID)"),
        column: z
          .string()
          .describe(
            `Target column. Available: ${columns.join(", ")}`,
          ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id, column }) => {
      try {
        const task = store.moveTask(id, column);
        return {
          content: [{ type: "text", text: JSON.stringify(task, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "update_task",
    {
      title: "Update Task",
      description: `Update a task's title, description, priority, and/or assignee.

Args:
  - id (string, required): The task ID (UUID)
  - title (string, optional): New title (1-200 chars)
  - description (string, optional): New description (max 2000 chars)
  - priority (string, optional): New priority. One of: P0, P1, P2
  - assignee (string, optional): New assignee name (empty string to unassign)

Returns:
  The updated task as JSON

Errors:
  - If the task ID is not found`,
      inputSchema: {
        id: z.string().describe("Task ID (UUID)"),
        title: z
          .string()
          .min(1)
          .max(200)
          .optional()
          .describe("New task title"),
        description: z
          .string()
          .max(2000)
          .optional()
          .describe("New task description"),
        priority: z
          .enum(["P0", "P1", "P2"])
          .optional()
          .describe("New task priority"),
        assignee: z
          .string()
          .max(100)
          .optional()
          .describe("New assignee name (empty string to unassign)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id, title, description, priority, assignee }) => {
      try {
        const task = store.updateTask(id, { title, description, priority, assignee });
        return {
          content: [{ type: "text", text: JSON.stringify(task, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete Task",
      description: `Permanently delete a task from the kanban board.

Args:
  - id (string, required): The task ID (UUID) to delete

Returns:
  Confirmation message

Errors:
  - If the task ID is not found`,
      inputSchema: {
        id: z.string().describe("Task ID (UUID) to delete"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      try {
        store.deleteTask(id);
        return {
          content: [
            { type: "text", text: `Task "${id}" has been deleted.` },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
