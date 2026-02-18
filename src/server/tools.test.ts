import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { BoardStore } from './store.js';
import { registerTools } from './tools.js';

async function createTestMcp() {
  const dir = mkdtempSync(join(tmpdir(), 'kanbrawl-mcp-test-'));
  const filePath = join(dir, 'kanbrawl.json');
  const store = new BoardStore(filePath);

  const mcpServer = new McpServer({
    name: 'kanbrawl-test',
    version: '1.0.0',
  });
  registerTools(mcpServer, store);

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });

  await mcpServer.connect(serverTransport);
  await client.connect(clientTransport);

  return { client, store, dir, mcpServer };
}

async function callTool(
  client: Client,
  name: string,
  arguments_: Record<string, unknown> = {},
) {
  const result = await client.callTool({ name, arguments: arguments_ });
  const textContent = result.content as Array<{ type: string; text: string }>;
  const text = textContent[0]?.text ?? '';
  return {
    ...result,
    text,
    json: () => JSON.parse(text),
    structured: result.structuredContent as Record<string, unknown> | undefined,
  };
}

describe('MCP Tools', () => {
  let client: Client;
  let store: BoardStore;
  let dir: string;
  let mcpServer: McpServer;

  beforeEach(async () => {
    ({ client, store, dir, mcpServer } = await createTestMcp());
  });

  afterEach(async () => {
    await client.close();
    await mcpServer.close();
    rmSync(dir, { recursive: true, force: true });
  });

  // --- get_columns ---
  describe('get_columns', () => {
    it('returns default columns with zero task counts', async () => {
      const result = await callTool(client, 'get_columns');
      const data = result.json();

      expect(data.columns).toEqual([
        { name: 'Todo', taskCount: 0, sortBy: 'priority', sortOrder: 'asc' },
        {
          name: 'In progress',
          taskCount: 0,
          sortBy: 'created',
          sortOrder: 'asc',
        },
        {
          name: 'Blocked',
          taskCount: 0,
          sortBy: 'created',
          sortOrder: 'asc',
        },
        { name: 'Done', taskCount: 0, sortBy: 'updated', sortOrder: 'desc' },
      ]);
      expect(result.structured).toEqual(data);
    });

    it('reflects task counts after creating tasks', async () => {
      await callTool(client, 'create_task', { title: 'Task 1' });
      await callTool(client, 'create_task', { title: 'Task 2' });
      await callTool(client, 'create_task', {
        title: 'Task 3',
        column: 'Done',
      });

      const result = await callTool(client, 'get_columns');
      const data = result.json();

      const todoCol = data.columns.find(
        (c: { name: string }) => c.name === 'Todo',
      );
      const doneCol = data.columns.find(
        (c: { name: string }) => c.name === 'Done',
      );
      expect(todoCol.taskCount).toBe(2);
      expect(doneCol.taskCount).toBe(1);
    });
  });

  // --- list_tasks ---
  describe('list_tasks', () => {
    it('returns empty array when no tasks', async () => {
      const result = await callTool(client, 'list_tasks');
      expect(result.json().tasks).toEqual([]);
      expect(result.structured).toEqual({ tasks: [] });
    });

    it('lists tasks in default column (Todo)', async () => {
      await callTool(client, 'create_task', { title: 'A' });
      await callTool(client, 'create_task', { title: 'B', column: 'Done' });

      const result = await callTool(client, 'list_tasks');
      const { tasks } = result.json();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('A');
    });

    it('lists tasks in a specific column', async () => {
      await callTool(client, 'create_task', { title: 'A' });
      await callTool(client, 'create_task', { title: 'B', column: 'Done' });

      const result = await callTool(client, 'list_tasks', { column: 'Done' });
      const { tasks } = result.json();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('B');
    });

    it('filters by priority', async () => {
      await callTool(client, 'create_task', { title: 'Low', priority: 'P2' });
      await callTool(client, 'create_task', { title: 'High', priority: 'P0' });

      const result = await callTool(client, 'list_tasks', { priority: 'P0' });
      const { tasks } = result.json();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('High');
    });

    it('returns error for invalid column', async () => {
      const result = await callTool(client, 'list_tasks', {
        column: 'Nonexistent',
      });
      expect(result.isError).toBe(true);
      expect(result.text).toMatch(/does not exist/i);
    });

    it('filters by assignee (case-insensitive)', async () => {
      await callTool(client, 'create_task', {
        title: 'Mine',
        assignee: 'Alice',
      });
      await callTool(client, 'create_task', {
        title: 'Theirs',
        assignee: 'Bob',
      });

      const result = await callTool(client, 'list_tasks', {
        assignee: 'alice',
      });
      const { tasks } = result.json();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Mine');
    });

    it('limits results with max param (default 10)', async () => {
      for (let index = 0; index < 12; index++) {
        // eslint-disable-next-line no-await-in-loop
        await callTool(client, 'create_task', { title: `Task ${index}` });
      }

      const result = await callTool(client, 'list_tasks');
      expect(result.json().tasks).toHaveLength(10);
    });

    it('respects custom max param', async () => {
      for (let index = 0; index < 5; index++) {
        // eslint-disable-next-line no-await-in-loop
        await callTool(client, 'create_task', { title: `Task ${index}` });
      }

      const result = await callTool(client, 'list_tasks', { max: 3 });
      expect(result.json().tasks).toHaveLength(3);
    });

    it('sorts by priority (P0 first) then by created date', async () => {
      await callTool(client, 'create_task', {
        title: 'Low',
        priority: 'P2',
      });
      await callTool(client, 'create_task', {
        title: 'High',
        priority: 'P0',
      });
      await callTool(client, 'create_task', {
        title: 'Normal',
        priority: 'P1',
      });
      await callTool(client, 'create_task', {
        title: 'High2',
        priority: 'P0',
      });

      const result = await callTool(client, 'list_tasks', { max: 100 });
      const titles = result.json().tasks.map((t: { title: string }) => t.title);
      expect(titles).toEqual(['High', 'High2', 'Normal', 'Low']);
    });
  });

  // --- create_task ---
  describe('create_task', () => {
    it('creates a task with defaults', async () => {
      const result = await callTool(client, 'create_task', {
        title: 'New task',
      });
      const task = result.json();

      expect(task.title).toBe('New task');
      expect(task.column).toBe('Todo');
      expect(task.priority).toBe('P1');
      expect(task.description).toBe('');
      expect(task.assignee).toBe('');
      expect(task.id).toBeDefined();
      expect(task.createdAt).toBeDefined();
      expect(result.structured).toEqual(task);
    });

    it('creates a task with all fields', async () => {
      const result = await callTool(client, 'create_task', {
        title: 'Full task',
        description: 'Details',
        column: 'In progress',
        priority: 'P0',
        assignee: 'agent-x',
      });
      const task = result.json();

      expect(task.title).toBe('Full task');
      expect(task.description).toBe('Details');
      expect(task.column).toBe('In progress');
      expect(task.priority).toBe('P0');
      expect(task.assignee).toBe('agent-x');
    });

    it('returns error for invalid column', async () => {
      const result = await callTool(client, 'create_task', {
        title: 'Task',
        column: 'Fake',
      });
      expect(result.isError).toBe(true);
      expect(result.text).toMatch(/does not exist/i);
    });
  });

  // --- move_task ---
  describe('move_task', () => {
    it('moves a task to another column', async () => {
      const created = await callTool(client, 'create_task', {
        title: 'Movable',
      });
      const taskId = created.json().id;

      const result = await callTool(client, 'move_task', {
        id: taskId,
        column: 'Done',
      });
      const task = result.json();
      expect(task.column).toBe('Done');
    });

    it('returns error for non-existent task', async () => {
      const result = await callTool(client, 'move_task', {
        id: '00000000-0000-0000-0000-000000000000',
        column: 'Done',
      });
      expect(result.isError).toBe(true);
      expect(result.text).toMatch(/not found/i);
    });

    it('returns error for invalid column', async () => {
      const created = await callTool(client, 'create_task', { title: 'Task' });
      const result = await callTool(client, 'move_task', {
        id: created.json().id,
        column: 'Nonexistent',
      });
      expect(result.isError).toBe(true);
      expect(result.text).toMatch(/does not exist/i);
    });
  });

  // --- update_task ---
  describe('update_task', () => {
    it('updates task title', async () => {
      const created = await callTool(client, 'create_task', {
        title: 'Original',
      });
      const result = await callTool(client, 'update_task', {
        id: created.json().id,
        title: 'Updated',
      });
      expect(result.json().title).toBe('Updated');
    });

    it('updates multiple fields', async () => {
      const created = await callTool(client, 'create_task', { title: 'Task' });
      const result = await callTool(client, 'update_task', {
        id: created.json().id,
        description: 'New desc',
        priority: 'P2',
        assignee: 'someone',
      });
      const task = result.json();
      expect(task.description).toBe('New desc');
      expect(task.priority).toBe('P2');
      expect(task.assignee).toBe('someone');
    });

    it('returns error for non-existent task', async () => {
      const result = await callTool(client, 'update_task', {
        id: '00000000-0000-0000-0000-000000000000',
        title: 'Nope',
      });
      expect(result.isError).toBe(true);
      expect(result.text).toMatch(/not found/i);
    });
  });

  // --- delete_task ---
  describe('delete_task', () => {
    it('deletes a task', async () => {
      const created = await callTool(client, 'create_task', {
        title: 'To delete',
      });
      const taskId = created.json().id;

      const result = await callTool(client, 'delete_task', { id: taskId });
      expect(result.isError).toBeUndefined();
      expect(result.structured).toHaveProperty('message');
      expect((result.structured as { message: string }).message).toMatch(
        /deleted/i,
      );

      // Verify it's gone
      const list = await callTool(client, 'list_tasks');
      expect(list.json().tasks).toHaveLength(0);
    });

    it('returns error for non-existent task', async () => {
      const result = await callTool(client, 'delete_task', {
        id: '00000000-0000-0000-0000-000000000000',
      });
      expect(result.isError).toBe(true);
      expect(result.text).toMatch(/not found/i);
    });
  });

  // --- tool listing ---
  describe('tool discovery', () => {
    it('lists all registered tools', async () => {
      const { tools } = await client.listTools();
      const toolNames = tools.map((t) => t.name).sort();
      expect(toolNames).toEqual([
        'create_task',
        'delete_task',
        'get_columns',
        'list_tasks',
        'move_task',
        'update_task',
      ]);
    });
  });
});
