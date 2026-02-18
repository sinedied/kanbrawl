import process from 'node:process';
import * as net from 'node:net';
import * as cp from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as vscode from 'vscode';
import { KanbrawlApiClient, type ConnectionState } from './api.js';
import { BoardTreeProvider, type BoardItem } from './board-provider.js';

let serverPort: number | undefined;
let serverProcess: cp.ChildProcess | undefined;
let apiClient: KanbrawlApiClient | undefined;
let treeProvider: BoardTreeProvider | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let boardInitialized = false;

// ── Server lifecycle ────────────────────────────────────────────────

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function hasKanbrawlJson(): boolean {
  const root = getWorkspaceRoot();
  if (!root) {
    return false;
  }

  return fs.existsSync(path.join(root, 'kanbrawl.json'));
}

function getServerUrl(): string {
  return `http://localhost:${serverPort}`;
}

async function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.once('listening', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => {
        resolve(port);
      });
    });
    server.listen(0);
  });
}

async function waitForServer(
  url: string,
  timeoutMs = 15_000,
): Promise<boolean> {
  const start = Date.now();
  const delay = async (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${url}/api/board`); // eslint-disable-line no-await-in-loop
      if (response.ok) {
        return true;
      }
    } catch {
      // Server not ready yet
    }

    await delay(500); // eslint-disable-line no-await-in-loop
  }

  return false;
}

async function isServerRunning(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/board`);
    return response.ok;
  } catch {
    return false;
  }
}

async function startServer(context: vscode.ExtensionContext): Promise<boolean> {
  // Always pick an unused port to avoid conflicts
  serverPort = await findAvailablePort();
  const url = getServerUrl();

  const root = getWorkspaceRoot();
  if (!root) {
    return false;
  }

  return new Promise((resolve) => {
    const proc = cp.spawn('npx', ['-y', 'kanbrawl', 'start'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env, PORT: String(serverPort) },
    });

    serverProcess = proc;

    const outputChannel = vscode.window.createOutputChannel('Kanbrawl Server');
    context.subscriptions.push(outputChannel);

    let resolved = false;

    proc.stdout?.on('data', (data: Uint8Array) => {
      const text = data.toString();
      outputChannel.appendLine(text);

      // Detect server ready from startup log message
      if (!resolved && text.includes('Kanbrawl server running')) {
        resolved = true;
        updateStatusBar('running');
        resolve(true);
      }
    });

    proc.stderr?.on('data', (data: Uint8Array) => {
      outputChannel.appendLine(data.toString());
    });

    proc.on('error', (error) => {
      outputChannel.appendLine(`Server error: ${error.message}`);
      updateStatusBar('stopped');
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    });

    proc.on('exit', (code) => {
      outputChannel.appendLine(`Server exited with code ${code}`);
      serverProcess = undefined;
      updateStatusBar('stopped');
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    });

    // Fallback: poll for server readiness
    void (async () => {
      const ready = await waitForServer(url);
      if (!resolved) {
        resolved = true;
        updateStatusBar(ready ? 'running' : 'stopped');
        resolve(ready);
      }
    })();
  });
}

function stopServer(): void {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = undefined;
  }

  updateStatusBar('stopped');
}

// ── Status bar ──────────────────────────────────────────────────────

function createStatusBar(): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right
  );
  item.command = 'kanbrawl.openWebUI';
  updateStatusBarItem(item, 'starting');
  item.show();
  return item;
}

function updateStatusBarItem(
  item: vscode.StatusBarItem,
  status: 'starting' | 'running' | 'stopped',
): void {
  switch (status) {
    case 'starting': {
      item.text = '$(loading~spin) Kanbrawl';
      item.tooltip = 'Kanbrawl server starting…';
      item.backgroundColor = undefined;
      break;
    }

    case 'running': {
      item.text = '$(circle-filled) Kanbrawl';
      item.tooltip = `Kanbrawl server running on ${getServerUrl()}`;
      item.backgroundColor = undefined;
      break;
    }

    case 'stopped': {
      item.text = '$(circle-filled) Kanbrawl';
      item.tooltip = 'Kanbrawl server stopped';
      item.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.errorBackground',
      );
      break;
    }
  }
}

function updateStatusBar(status: 'starting' | 'running' | 'stopped'): void {
  if (statusBarItem) {
    updateStatusBarItem(statusBarItem, status);
  }
}

function updateConnectionIndicator(state: ConnectionState): void {
  if (statusBarItem) {
    if (state === 'connected') {
      statusBarItem.text = '$(circle-filled) Kanbrawl';
      statusBarItem.backgroundColor = undefined;
      statusBarItem.tooltip = `Kanbrawl server connected on ${getServerUrl()}`;
    } else {
      statusBarItem.text = '$(circle-filled) Kanbrawl';
      statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.errorBackground',
      );
      statusBarItem.tooltip = 'Kanbrawl server disconnected';
    }
  }
}

// ── Init configuration ──────────────────────────────────────────────

type McpToolConfig = {
  name: string;
  configPath: string;
  serversKey: string;
  entry: Record<string, unknown>;
};

const STDIO_ARGS = ['-y', 'kanbrawl', 'start', '--stdio'];

const MCP_TOOL_CONFIGS: McpToolConfig[] = [
  {
    name: 'VS Code / GitHub Copilot',
    configPath: '.vscode/mcp.json',
    serversKey: 'servers',
    entry: { type: 'stdio', command: 'npx', args: STDIO_ARGS },
  },
  {
    name: 'Claude Code',
    configPath: '.mcp.json',
    serversKey: 'mcpServers',
    entry: { command: 'npx', args: STDIO_ARGS },
  },
  {
    name: 'Cursor',
    configPath: '.cursor/mcp.json',
    serversKey: 'mcpServers',
    entry: { command: 'npx', args: STDIO_ARGS },
  },
  {
    name: 'Gemini CLI',
    configPath: '.gemini/settings.json',
    serversKey: 'mcpServers',
    entry: { command: 'npx', args: STDIO_ARGS },
  },
  {
    name: 'Windsurf',
    configPath: '.windsurf/mcp.json',
    serversKey: 'mcpServers',
    entry: { command: 'npx', args: STDIO_ARGS },
  },
];

const DEFAULT_BOARD = {
  columns: [
    { name: 'Todo', sortBy: 'priority', sortOrder: 'asc' },
    { name: 'In progress', sortBy: 'created', sortOrder: 'asc' },
    { name: 'Blocked', sortBy: 'created', sortOrder: 'asc' },
    { name: 'Done', sortBy: 'updated', sortOrder: 'desc' },
  ],
  tasks: [] as unknown[],
};

const AGENTS_MD_SECTION = `
## Task Management

Use the Kanbrawl MCP tools for task management when working on this project.

### Workflow

- When building a plan, include task creation in it
- Check existing tasks with \`list_tasks\` before creating to avoid duplicates
- Always reload tasks with \`list_tasks\` before starting work on a task to get the latest updates
- Set your name as assignee when you start working on a task
- Move tasks between columns with \`move_task\` to track progress
- Proceed with task execution one at a time, till it's done or blocked then move to the next one
`;

// ── Board setup ─────────────────────────────────────────────────────

async function setupBoard(context: vscode.ExtensionContext): Promise<void> {
  if (boardInitialized) {
    return;
  }

  boardInitialized = true;

  await vscode.commands.executeCommand('setContext', 'kanbrawl.hasBoard', true);

  // Status bar
  statusBarItem = createStatusBar();
  context.subscriptions.push(statusBarItem);

  // Start server
  const serverReady = await startServer(context);
  if (!serverReady) {
    void vscode.window.showWarningMessage(
      'Kanbrawl server failed to start. Check the Output panel for details.',
    );
  }

  // API client
  const url = getServerUrl();
  apiClient = new KanbrawlApiClient(url);
  treeProvider?.setApiClient(apiClient);
  context.subscriptions.push({ dispose: () => apiClient?.dispose() });

  // Load initial board data
  if (serverReady) {
    await treeProvider?.loadBoard();
    apiClient.connectSSE(
      (event) => {
        treeProvider?.handleEvent(event);
      },
      (state) => {
        updateConnectionIndicator(state);
      },
    );
  }

  // MCP server registration
  const mcpProvider: vscode.McpServerDefinitionProvider = {
    provideMcpServerDefinitions(_token) {
      return [
        new vscode.McpHttpServerDefinition(
          'Kanbrawl',
          vscode.Uri.parse(`${url}/mcp`),
        ),
      ];
    },
  };

  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider(
      'kanbrawl.mcp-servers',
      mcpProvider,
    ),
  );
}

// ── Activation ──────────────────────────────────────────────────────

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  // Tree provider (always created — shows welcome view when empty)
  treeProvider = new BoardTreeProvider(context.extensionPath);
  const treeView = vscode.window.createTreeView('kanbrawlBoard', {
    treeDataProvider: treeProvider,
    dragAndDropController: treeProvider,
    canSelectMany: true,
    showCollapseAll: true,
  });

  // ── Commands ──────────────────────────────────────────────────

  context.subscriptions.push(
    treeProvider,
    treeView,
    // Init
    vscode.commands.registerCommand('kanbrawl.init', async () => {
      const root = getWorkspaceRoot();
      if (!root) {
        void vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }

      type ToolItem = vscode.QuickPickItem & { config: McpToolConfig };
      const items: ToolItem[] = MCP_TOOL_CONFIGS.map((c) => ({
        label: c.name,
        config: c,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder: 'Select AI tools to configure',
        title: 'Kanbrawl Setup',
      });

      if (!selected || selected.length === 0) {
        return;
      }

      // Create kanbrawl.json if needed
      const boardPath = path.join(root, 'kanbrawl.json');
      if (!fs.existsSync(boardPath)) {
        fs.writeFileSync(
          boardPath,
          JSON.stringify(DEFAULT_BOARD, null, 2) + '\n',
        );
      }

      // Write MCP config files
      for (const item of selected) {
        const { config } = item;
        const fullPath = path.join(root, config.configPath);
        const dir = path.dirname(fullPath);

        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        let existing: Record<string, unknown> = {};
        if (fs.existsSync(fullPath)) {
          try {
            existing = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as Record<
              string,
              unknown
            >;
          } catch {}
        }

        const servers =
          (existing[config.serversKey] as Record<string, unknown>) ?? {};
        servers.kanbrawl = config.entry;
        existing[config.serversKey] = servers;

        fs.writeFileSync(fullPath, JSON.stringify(existing, null, 2) + '\n');
      }

      // Update AGENTS.md
      const agentsPath = path.join(root, 'AGENTS.md');
      if (fs.existsSync(agentsPath)) {
        const content = fs.readFileSync(agentsPath, 'utf8');
        if (!content.includes('Kanbrawl MCP tools')) {
          fs.writeFileSync(
            agentsPath,
            content.trimEnd() + '\n' + AGENTS_MD_SECTION,
            'utf8',
          );
        }
      } else {
        fs.writeFileSync(
          agentsPath,
          `# AGENTS.md\n${AGENTS_MD_SECTION}`,
          'utf8',
        );
      }

      void vscode.window.showInformationMessage(
        'Kanbrawl initialized successfully!',
      );
    }),

    // Refresh
    vscode.commands.registerCommand('kanbrawl.refresh', async () => {
      await treeProvider?.loadBoard();
    }),

    // Open Web UI
    vscode.commands.registerCommand('kanbrawl.openWebUI', () => {
      void vscode.env.openExternal(vscode.Uri.parse(getServerUrl()));
    }),

    // Add Task
    vscode.commands.registerCommand(
      'kanbrawl.addTask',
      async (item?: BoardItem) => {
        if (!apiClient) {
          return;
        }

        const title = await vscode.window.showInputBox({
          prompt: 'New task title',
          placeHolder: 'Enter task title',
          validateInput: (v) => (v.trim() ? undefined : 'Title is required'),
        });

        if (!title) {
          return;
        }

        const description = await vscode.window.showInputBox({
          prompt: 'Task description (optional, press Enter to skip)',
          placeHolder: 'Enter description',
        });

        if (description === undefined) {
          return;
        }

        // Column picker — pre-select if context-clicked on a column
        const contextColumn =
          item?.kind === 'column' ? item.column.name : undefined;
        let column: string | undefined = contextColumn;

        if (!contextColumn) {
          const columns = treeProvider?.getColumnNames() ?? [];
          if (columns.length > 0) {
            const picked = await vscode.window.showQuickPick(columns, {
              placeHolder: 'Select column (default: first column)',
            });
            if (picked === undefined) {
              return;
            }

            column = picked || undefined;
          }
        }

        const priorityPick = await vscode.window.showQuickPick(
          [
            { label: 'P0', description: 'Critical' },
            { label: 'P1', description: 'Normal' },
            { label: 'P2', description: 'Low' },
          ],
          { placeHolder: 'Select priority (default: P1)' },
        );

        if (priorityPick === undefined) {
          return;
        }

        const assignee = await vscode.window.showInputBox({
          prompt: 'Assignee (optional, press Enter to skip)',
          placeHolder: 'Enter assignee name',
        });

        if (assignee === undefined) {
          return;
        }

        try {
          await apiClient.createTask({
            title: title.trim(),
            description: description || undefined,
            column,
            priority: priorityPick?.label ?? undefined,
            assignee: assignee || undefined,
          });
        } catch (error) {
          void vscode.window.showErrorMessage(
            `Failed to create task: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      },
    ),

    // Edit Task
    vscode.commands.registerCommand(
      'kanbrawl.editTask',
      async (item?: BoardItem) => {
        if (!apiClient || item?.kind !== 'task') {
          return;
        }

        const { task } = item;

        type FieldItem = vscode.QuickPickItem & {
          field: 'title' | 'description' | 'priority' | 'assignee';
        };

        const fields: FieldItem[] = [
          {
            label: 'Title',
            description: task.title,
            field: 'title',
          },
          {
            label: 'Description',
            description: task.description || '(empty)',
            field: 'description',
          },
          {
            label: 'Priority',
            description: task.priority,
            field: 'priority',
          },
          {
            label: 'Assignee',
            description: task.assignee || '(none)',
            field: 'assignee',
          },
        ];

        const selected = await vscode.window.showQuickPick(fields, {
          placeHolder: `Edit "${task.title}"`,
        });

        if (!selected) {
          return;
        }

        let value: string | undefined;

        switch (selected.field) {
          case 'title': {
            value = await vscode.window.showInputBox({
              prompt: 'Task title',
              value: task.title,
              validateInput: (v) =>
                v.trim() ? undefined : 'Title is required',
            });
            break;
          }

          case 'description': {
            value = await vscode.window.showInputBox({
              prompt: 'Task description (leave empty to clear)',
              value: task.description,
            });
            break;
          }

          case 'priority': {
            const pick = await vscode.window.showQuickPick(
              [
                { label: 'P0', description: 'Critical' },
                { label: 'P1', description: 'Normal' },
                { label: 'P2', description: 'Low' },
              ],
              { placeHolder: 'Select priority' },
            );
            value = pick?.label;
            break;
          }

          case 'assignee': {
            value = await vscode.window.showInputBox({
              prompt: 'Assignee name (leave empty to clear)',
              value: task.assignee,
            });
            break;
          }
        }

        if (value === undefined) {
          return;
        }

        try {
          await apiClient.updateTask(task.id, { [selected.field]: value });
        } catch (error) {
          void vscode.window.showErrorMessage(
            `Failed to update task: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      },
    ),

    // Move Task
    vscode.commands.registerCommand(
      'kanbrawl.moveTask',
      async (item?: BoardItem) => {
        if (!apiClient || item?.kind !== 'task') {
          void vscode.window.showWarningMessage('Select a task to move.');
          return;
        }

        const columns = treeProvider?.getColumnNames() ?? [];
        const otherColumns = columns.filter((c) => c !== item.task.column);

        if (otherColumns.length === 0) {
          void vscode.window.showInformationMessage(
            'No other columns to move to.',
          );
          return;
        }

        const target = await vscode.window.showQuickPick(otherColumns, {
          placeHolder: `Move "${item.task.title}" to…`,
        });

        if (target) {
          try {
            await apiClient.moveTask(item.task.id, target);
          } catch (error) {
            void vscode.window.showErrorMessage(
              `Failed to move task: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      },
    ),

    // Delete Task
    vscode.commands.registerCommand(
      'kanbrawl.deleteTask',
      async (item?: BoardItem) => {
        if (!apiClient || item?.kind !== 'task') {
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          `Delete task "${item.task.title}"?`,
          { modal: true },
          'Delete',
        );

        if (confirm === 'Delete') {
          try {
            await apiClient.deleteTask(item.task.id);
          } catch (error) {
            void vscode.window.showErrorMessage(
              `Failed to delete task: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      },
    ),
  );

  // ── File watcher ────────────────────────────────────────────

  const root = getWorkspaceRoot();
  if (root) {
    const pattern = new vscode.RelativePattern(root, 'kanbrawl.json');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    watcher.onDidCreate(async () => {
      await setupBoard(context);
    });

    watcher.onDidDelete(async () => {
      await vscode.commands.executeCommand(
        'setContext',
        'kanbrawl.hasBoard',
        false,
      );
    });

    context.subscriptions.push(watcher);
  }

  // ── Initialize board if exists ──────────────────────────────

  if (hasKanbrawlJson()) {
    await setupBoard(context);
  } else {
    await vscode.commands.executeCommand(
      'setContext',
      'kanbrawl.hasBoard',
      false,
    );
  }
}

// ── Deactivation ──────────────────────────────────────────────────

export function deactivate(): void {
  stopServer();
  apiClient?.dispose();
  treeProvider?.dispose();
}
