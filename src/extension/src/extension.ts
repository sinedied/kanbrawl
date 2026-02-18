import process from 'node:process';
import * as cp from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as vscode from 'vscode';
import { KanbrawlApiClient } from './api.js';
import { BoardTreeProvider } from './board-provider.js';

const DEFAULT_PORT = 3000;

let serverProcess: cp.ChildProcess | undefined;
let apiClient: KanbrawlApiClient | undefined;
let treeProvider: BoardTreeProvider | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;

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
  return `http://localhost:${DEFAULT_PORT}`;
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
  const url = getServerUrl();

  // Check if server is already running (e.g. from another window or manual start)
  if (await isServerRunning(url)) {
    updateStatusBar('running');
    return true;
  }

  const root = getWorkspaceRoot();
  if (!root) {
    return false;
  }

  return new Promise((resolve) => {
    const proc = cp.spawn('npx', ['-y', 'kanbrawl', 'start'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      env: { ...process.env, PORT: String(DEFAULT_PORT) },
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
    vscode.StatusBarAlignment.Left,
    50,
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
      break;
    }

    case 'running': {
      item.text = '$(check) Kanbrawl';
      item.tooltip = `Kanbrawl server running on ${getServerUrl()}`;
      break;
    }

    case 'stopped': {
      item.text = '$(x) Kanbrawl';
      item.tooltip = 'Kanbrawl server stopped';
      break;
    }
  }
}

function updateStatusBar(status: 'starting' | 'running' | 'stopped'): void {
  if (statusBarItem) {
    updateStatusBarItem(statusBarItem, status);
  }
}

// ── Activation ──────────────────────────────────────────────────────

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  // Register init command (always available)
  context.subscriptions.push(
    vscode.commands.registerCommand('kanbrawl.init', async () => {
      const root = getWorkspaceRoot();
      if (!root) {
        void vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }

      const terminal = vscode.window.createTerminal('Kanbrawl Init');
      terminal.show();
      terminal.sendText('npx -y kanbrawl init');
    }),
  );

  // Only proceed if kanbrawl.json exists
  if (!hasKanbrawlJson()) {
    // Set context so welcome view shows
    await vscode.commands.executeCommand(
      'setContext',
      'kanbrawl.hasBoard',
      false,
    );
    return;
  }

  await vscode.commands.executeCommand('setContext', 'kanbrawl.hasBoard', true);

  // Status bar
  statusBarItem = createStatusBar();

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

  // Tree view
  treeProvider = new BoardTreeProvider(apiClient);

  const treeView = vscode.window.createTreeView('kanbrawlBoard', {
    treeDataProvider: treeProvider,
    dragAndDropController: treeProvider,
    canSelectMany: true,
    showCollapseAll: true,
  });

  context.subscriptions.push(
    statusBarItem,
    { dispose: () => apiClient?.dispose() },
    treeProvider,
    treeView,
  );

  // Load initial board data
  if (serverReady) {
    await treeProvider.loadBoard();

    // Connect SSE for live updates
    apiClient.connectSSE((event) => {
      treeProvider?.handleEvent(event);
    });
  }

  // ── MCP server registration ─────────────────────────────────

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
    // ── Commands ────────────────────────────────────────────────
    vscode.commands.registerCommand('kanbrawl.refresh', async () => {
      await treeProvider?.loadBoard();
    }),
    vscode.commands.registerCommand(
      'kanbrawl.moveTask',
      async (item?: {
        kind: string;
        task?: { id: string; title: string; column: string };
      }) => {
        if (item?.kind !== 'task' || !item.task) {
          void vscode.window.showWarningMessage('Select a task to move.');
          return;
        }

        const columns = treeProvider?.getColumnNames() ?? [];
        const otherColumns = columns.filter((c) => c !== item.task!.column);
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
            await apiClient?.moveTask(item.task.id, target);
            // SSE will refresh the tree
          } catch (error) {
            void vscode.window.showErrorMessage(
              `Failed to move task: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      },
    ),
    vscode.commands.registerCommand('kanbrawl.openWebUI', () => {
      void vscode.env.openExternal(vscode.Uri.parse(getServerUrl()));
    }),
  );

  // ── File watcher ────────────────────────────────────────────
  // Watch for kanbrawl.json creation/deletion to toggle views

  const root = getWorkspaceRoot();
  if (root) {
    const pattern = new vscode.RelativePattern(root, 'kanbrawl.json');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    watcher.onDidCreate(async () => {
      await vscode.commands.executeCommand(
        'setContext',
        'kanbrawl.hasBoard',
        true,
      );
      // Restart server if needed
      if (!serverProcess) {
        const ready = await startServer(context);
        if (ready) {
          await treeProvider?.loadBoard();
          apiClient?.connectSSE((event) => {
            treeProvider?.handleEvent(event);
          });
        }
      }
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
}

// ── Deactivation ──────────────────────────────────────────────────

export function deactivate(): void {
  stopServer();
  apiClient?.dispose();
  treeProvider?.dispose();
}
