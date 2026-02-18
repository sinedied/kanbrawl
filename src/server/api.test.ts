import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { BoardStore } from './store.js';
import { createApiRouter } from './api.js';

function createTestApp() {
  const dir = mkdtempSync(join(tmpdir(), 'kanbrawl-test-'));
  const filePath = join(dir, 'kanbrawl.json');
  const store = new BoardStore(filePath);
  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter(store));
  return { app, store, dir };
}

describe('REST API', () => {
  let app: express.Express;
  let store: BoardStore;
  let dir: string;

  beforeEach(() => {
    ({ app, store, dir } = createTestApp());
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  // --- GET /api/board ---
  describe('GET /api/board', () => {
    it('returns default board with columns and empty tasks', async () => {
      const res = await request(app).get('/api/board');
      expect(res.status).toBe(200);
      expect(res.body.columns.map((c: { name: string }) => c.name)).toEqual([
        'Todo',
        'In progress',
        'Blocked',
        'Done',
      ]);
      expect(res.body.tasks).toEqual([]);
    });
  });

  // --- POST /api/tasks ---
  describe('POST /api/tasks', () => {
    it('creates a task with minimal fields', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ title: 'Test task' });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Test task');
      expect(res.body.column).toBe('Todo');
      expect(res.body.priority).toBe('P1');
      expect(res.body.id).toBeDefined();
    });

    it('creates a task with all fields', async () => {
      const res = await request(app).post('/api/tasks').send({
        title: 'Full task',
        description: 'A detailed description',
        column: 'In progress',
        priority: 'P0',
        assignee: 'agent-1',
      });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Full task');
      expect(res.body.description).toBe('A detailed description');
      expect(res.body.column).toBe('In progress');
      expect(res.body.priority).toBe('P0');
      expect(res.body.assignee).toBe('agent-1');
    });

    it('returns 400 when title is missing', async () => {
      const res = await request(app).post('/api/tasks').send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/title/i);
    });

    it('returns 400 when title is empty string', async () => {
      const res = await request(app).post('/api/tasks').send({ title: '   ' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid column', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ title: 'Task', column: 'Nonexistent' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/does not exist/i);
    });
  });

  // --- PATCH /api/tasks/:id ---
  describe('PATCH /api/tasks/:id', () => {
    it('updates task title', async () => {
      const created = await request(app)
        .post('/api/tasks')
        .send({ title: 'Original' });

      const res = await request(app)
        .patch(`/api/tasks/${created.body.id}`)
        .send({ title: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated');
    });

    it('updates task description and priority', async () => {
      const created = await request(app)
        .post('/api/tasks')
        .send({ title: 'Task' });

      const res = await request(app)
        .patch(`/api/tasks/${created.body.id}`)
        .send({ description: 'New desc', priority: 'P0' });

      expect(res.status).toBe(200);
      expect(res.body.description).toBe('New desc');
      expect(res.body.priority).toBe('P0');
    });

    it('moves task to a different column', async () => {
      const created = await request(app)
        .post('/api/tasks')
        .send({ title: 'Task' });

      const res = await request(app)
        .patch(`/api/tasks/${created.body.id}`)
        .send({ column: 'Done' });

      expect(res.status).toBe(200);
      expect(res.body.column).toBe('Done');
    });

    it('moves and updates task in one request', async () => {
      const created = await request(app)
        .post('/api/tasks')
        .send({ title: 'Task' });

      const res = await request(app)
        .patch(`/api/tasks/${created.body.id}`)
        .send({ column: 'In progress', title: 'Renamed', assignee: 'bob' });

      expect(res.status).toBe(200);
      expect(res.body.column).toBe('In progress');
      expect(res.body.title).toBe('Renamed');
      expect(res.body.assignee).toBe('bob');
    });

    it('returns 404 for non-existent task', async () => {
      const res = await request(app)
        .patch('/api/tasks/00000000-0000-0000-0000-000000000000')
        .send({ title: 'Nope' });

      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid column on move', async () => {
      const created = await request(app)
        .post('/api/tasks')
        .send({ title: 'Task' });

      const res = await request(app)
        .patch(`/api/tasks/${created.body.id}`)
        .send({ column: 'Nonexistent' });

      expect(res.status).toBe(400);
    });
  });

  // --- DELETE /api/tasks/:id ---
  describe('DELETE /api/tasks/:id', () => {
    it('deletes a task', async () => {
      const created = await request(app)
        .post('/api/tasks')
        .send({ title: 'To delete' });

      const res = await request(app).delete(`/api/tasks/${created.body.id}`);

      expect(res.status).toBe(204);

      // Verify it's gone
      const board = await request(app).get('/api/board');
      expect(board.body.tasks).toHaveLength(0);
    });

    it('returns 404 for non-existent task', async () => {
      const res = await request(app).delete(
        '/api/tasks/00000000-0000-0000-0000-000000000000',
      );

      expect(res.status).toBe(404);
    });
  });

  // --- PUT /api/columns ---
  describe('PUT /api/columns', () => {
    it('updates columns', async () => {
      const res = await request(app)
        .put('/api/columns')
        .send({
          columns: [
            { name: 'Backlog', sortBy: 'created', sortOrder: 'asc' },
            { name: 'Active', sortBy: 'priority', sortOrder: 'asc' },
            { name: 'Done', sortBy: 'updated', sortOrder: 'desc' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.columns.map((c: { name: string }) => c.name)).toEqual([
        'Backlog',
        'Active',
        'Done',
      ]);
    });

    it('returns 400 when columns is not an array', async () => {
      const res = await request(app)
        .put('/api/columns')
        .send({ columns: 'not-an-array' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when columns is missing', async () => {
      const res = await request(app).put('/api/columns').send({});

      expect(res.status).toBe(400);
    });

    it('moves tasks from removed columns to first remaining column', async () => {
      // Create a task in "Blocked"
      await request(app)
        .post('/api/tasks')
        .send({ title: 'Blocked task', column: 'Blocked' });

      // Remove "Blocked" column
      await request(app)
        .put('/api/columns')
        .send({
          columns: [
            { name: 'Todo', sortBy: 'priority', sortOrder: 'asc' },
            { name: 'In progress', sortBy: 'created', sortOrder: 'asc' },
            { name: 'Done', sortBy: 'updated', sortOrder: 'desc' },
          ],
        });

      const board = await request(app).get('/api/board');
      expect(board.body.tasks[0].column).toBe('Todo');
    });
  });
});
