import {
  mkdtempSync,
  rmSync,
  readFileSync,
  existsSync,
  writeFileSync,
} from 'node:fs';
import process from 'node:process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BoardStore } from '../server/store.js';
import { taskAction } from './commands/task.js';
import { writeConfigFile, updateAgentsMd } from './commands/init.js';

// --- Task command tests ---
describe('task command', () => {
  let dir: string;
  let originalCwd: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kanbrawl-cli-test-'));
    originalCwd = process.cwd();
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates a task with defaults', () => {
    taskAction('My task', { priority: '1' });
    const store = new BoardStore(join(dir, 'kanbrawl.json'));
    const tasks = store.getTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('My task');
    expect(tasks[0].priority).toBe('P1');
    expect(tasks[0].column).toBe('Todo');
  });

  it('creates a task with all options', () => {
    taskAction('Full task', {
      description: 'A description',
      column: 'In progress',
      priority: '0',
      assignee: 'alice',
    });
    const store = new BoardStore(join(dir, 'kanbrawl.json'));
    const tasks = store.getTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Full task');
    expect(tasks[0].description).toBe('A description');
    expect(tasks[0].column).toBe('In progress');
    expect(tasks[0].priority).toBe('P0');
    expect(tasks[0].assignee).toBe('alice');
  });

  it('updates an existing task with --update', () => {
    taskAction('Update me', { priority: '1' });
    taskAction('Update me', {
      update: true,
      description: 'Updated desc',
      priority: '2',
      assignee: 'bob',
    });
    const store = new BoardStore(join(dir, 'kanbrawl.json'));
    const tasks = store.getTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].description).toBe('Updated desc');
    expect(tasks[0].priority).toBe('P2');
    expect(tasks[0].assignee).toBe('bob');
  });

  it('updates task column with --update --column', () => {
    taskAction('Move me', { priority: '1' });
    taskAction('Move me', {
      update: true,
      column: 'Done',
      priority: '1',
    });
    const store = new BoardStore(join(dir, 'kanbrawl.json'));
    const tasks = store.getTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].column).toBe('Done');
  });

  it('sets exitCode when updating a non-existent task', () => {
    // Ensure kanbrawl.json exists
    new BoardStore(join(dir, 'kanbrawl.json')); // eslint-disable-line no-new
    const originalExitCode = process.exitCode;
    taskAction('Does not exist', { update: true, priority: '1' });
    expect(process.exitCode).toBe(1);
    process.exitCode = originalExitCode;
  });
});

// --- Init command helper tests ---
describe('init helpers', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kanbrawl-init-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe('writeConfigFile', () => {
    it('creates a new config file with kanbrawl entry', () => {
      writeConfigFile(
        {
          name: 'Test Tool',
          configPath: '.test/mcp.json',
          serversKey: 'mcpServers',
          generateEntry: () => ({ command: 'npx', args: ['kanbrawl'] }),
        },
        dir,
      );

      const filePath = join(dir, '.test/mcp.json');
      expect(existsSync(filePath)).toBe(true);

      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      expect(data.mcpServers.kanbrawl).toEqual({
        command: 'npx',
        args: ['kanbrawl'],
      });
    });

    it('merges into an existing config file', () => {
      const filePath = join(dir, 'mcp.json');
      writeFileSync(
        filePath,
        JSON.stringify({
          mcpServers: { other: { command: 'other-tool' } },
        }),
      );

      writeConfigFile(
        {
          name: 'Test',
          configPath: 'mcp.json',
          serversKey: 'mcpServers',
          generateEntry: () => ({ command: 'npx', args: ['kanbrawl'] }),
        },
        dir,
      );

      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      expect(data.mcpServers.other).toEqual({ command: 'other-tool' });
      expect(data.mcpServers.kanbrawl).toEqual({
        command: 'npx',
        args: ['kanbrawl'],
      });
    });
  });

  describe('updateAgentsMd', () => {
    it('creates AGENTS.md when it does not exist', () => {
      updateAgentsMd(dir);
      const content = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
      expect(content).toContain('# AGENTS.md');
      expect(content).toContain('Kanbrawl - AI Task Board');
      expect(content).toContain('create_task');
    });

    it('appends to existing AGENTS.md', () => {
      writeFileSync(join(dir, 'AGENTS.md'), '# My Project\n\nExisting content');
      updateAgentsMd(dir);
      const content = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
      expect(content).toContain('# My Project');
      expect(content).toContain('Existing content');
      expect(content).toContain('Kanbrawl - AI Task Board');
    });

    it('skips if Kanbrawl section already exists', () => {
      const original =
        '# Project\n\n## Kanbrawl - AI Task Board\n\nAlready here';
      writeFileSync(join(dir, 'AGENTS.md'), original);
      updateAgentsMd(dir);
      const content = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
      expect(content).toBe(original);
    });
  });
});
