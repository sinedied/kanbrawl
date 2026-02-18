import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { BoardStore } from './store.js';

const taskOutputSchema = {
  id: z.string(),
  title: z.string(),
  description: z.string(),
  column: z.string(),
  priority: z
    .enum(['P0', 'P1', 'P2'])
    .describe('P0 = urgent/critical, P1 = normal (default), P2 = low priority'),
  assignee: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
};

export function registerTools(server: McpServer, store: BoardStore): void {
  const columnNames = store.getColumnNames();

  server.registerTool(
    'get_columns',
    {
      title: 'Get Columns',
      description:
        'Get the list of kanban board columns with their task counts.',
      inputSchema: {},
      outputSchema: {
        columns: z.array(
          z.object({
            name: z.string().describe('Column name'),
            taskCount: z.number().describe('Number of tasks in the column'),
            sortBy: z
              .enum(['priority', 'created', 'updated'])
              .describe('Sort field for tasks in this column'),
            sortOrder: z
              .enum(['asc', 'desc'])
              .describe('Sort order for tasks in this column'),
          }),
        ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const allTasks = store.getTasks();
      const columnsWithCounts = store.getColumns().map((col) => ({
        name: col.name,
        taskCount: allTasks.filter((t) => t.column === col.name).length,
        sortBy: col.sortBy,
        sortOrder: col.sortOrder,
      }));
      const structuredContent = { columns: columnsWithCounts };
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(structuredContent, null, 2),
          },
        ],
        structuredContent,
      };
    },
  );

  server.registerTool(
    'list_tasks',
    {
      title: 'List Tasks',
      description:
        'List tasks on the kanban board, optionally filtered by column, priority, and assignee. Results are sorted by priority (P0 first) then by creation date (oldest first).',
      inputSchema: {
        column: z
          .string()
          .optional()
          .describe(
            `Column name to filter by. Defaults to "${columnNames[0]}". Available: ${columnNames.join(', ')}`,
          ),
        priority: z
          .enum(['P0', 'P1', 'P2'])
          .optional()
          .describe(
            'Filter tasks by priority level: P0 = urgent/critical, P1 = normal, P2 = low priority',
          ),
        assignee: z
          .string()
          .optional()
          .describe('Filter tasks by assignee name (case-insensitive match)'),
        max: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe('Maximum number of tasks to return (default: 10)'),
      },
      outputSchema: {
        tasks: z.array(z.object(taskOutputSchema)),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ column, priority, assignee, max }) => {
      const targetColumn = column ?? columnNames[0];
      if (!store.getColumnNames().includes(targetColumn)) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: Column "${targetColumn}" does not exist. Available columns: ${store.getColumnNames().join(', ')}`,
            },
          ],
          isError: true,
        };
      }

      let tasks = store.getTasks(targetColumn);
      if (priority) {
        tasks = tasks.filter((t) => t.priority === priority);
      }

      if (assignee) {
        const lowerAssignee = assignee.toLowerCase();
        tasks = tasks.filter((t) => t.assignee.toLowerCase() === lowerAssignee);
      }

      // Sort by priority ascending (P0 first), then by created date ascending (oldest first)
      tasks.sort((a, b) => {
        const priorityCompare = a.priority.localeCompare(b.priority);
        if (priorityCompare !== 0) return priorityCompare;
        return a.createdAt.localeCompare(b.createdAt);
      });

      const limit = max ?? 10;
      tasks = tasks.slice(0, limit);

      const structuredContent = { tasks };
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(structuredContent, null, 2),
          },
        ],
        structuredContent,
      };
    },
  );

  server.registerTool(
    'create_task',
    {
      title: 'Create Task',
      description: 'Create a new task on the kanban board.',
      inputSchema: {
        title: z
          .string()
          .min(1, 'Title is required')
          .max(200, 'Title must not exceed 200 characters')
          .describe('Task title'),
        description: z
          .string()
          .max(2000, 'Description must not exceed 2000 characters')
          .optional()
          .describe('Task description'),
        column: z
          .string()
          .optional()
          .describe(
            `Column to place task in. Defaults to "${columnNames[0]}". Available: ${columnNames.join(', ')}`,
          ),
        priority: z
          .enum(['P0', 'P1', 'P2'])
          .optional()
          .describe(
            'Task priority: P0 = urgent/critical, P1 = normal (default), P2 = low priority',
          ),
        assignee: z
          .string()
          .max(100)
          .optional()
          .describe('Name of the person or agent assigned to this task'),
      },
      outputSchema: taskOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ title, description, column, priority, assignee }) => {
      try {
        const task = store.createTask(
          title,
          description,
          column,
          priority,
          assignee,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
          structuredContent: task,
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'move_task',
    {
      title: 'Move Task',
      description: 'Move an existing task to a different column.',
      inputSchema: {
        id: z.string().describe('Task ID (UUID)'),
        column: z
          .string()
          .describe(`Target column. Available: ${columnNames.join(', ')}`),
      },
      outputSchema: taskOutputSchema,
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
          content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
          structuredContent: task,
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'update_task',
    {
      title: 'Update Task',
      description:
        "Update a task's title, description, priority, and/or assignee.",
      inputSchema: {
        id: z.string().describe('Task ID (UUID)'),
        title: z.string().min(1).max(200).optional().describe('New task title'),
        description: z
          .string()
          .max(2000)
          .optional()
          .describe('New task description'),
        priority: z
          .enum(['P0', 'P1', 'P2'])
          .optional()
          .describe(
            'New task priority: P0 = urgent/critical, P1 = normal, P2 = low priority',
          ),
        assignee: z
          .string()
          .max(100)
          .optional()
          .describe('New assignee name (empty string to unassign)'),
      },
      outputSchema: taskOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id, title, description, priority, assignee }) => {
      try {
        const task = store.updateTask(id, {
          title,
          description,
          priority,
          assignee,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
          structuredContent: task,
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'delete_task',
    {
      title: 'Delete Task',
      description:
        'Permanently delete a task from the kanban board. Should only be used in case of errorneous or test tasks, as this action cannot be undone!',
      inputSchema: {
        id: z.string().describe('Task ID (UUID) to delete'),
      },
      outputSchema: {
        message: z.string().describe('Confirmation message'),
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
        const structuredContent = {
          message: `Task "${id}" has been deleted.`,
        };
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(structuredContent, null, 2),
            },
          ],
          structuredContent,
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
