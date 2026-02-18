import process from 'node:process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { checkbox } from '@inquirer/prompts';
import { BoardStore } from '../../server/store.js';

export type McpConfig = {
  name: string;
  configPath: string;
  serversKey: string;
  generateEntry: () => Record<string, unknown>;
};

const STDIO_COMMAND = 'npx';
const STDIO_ARGS = ['-y', 'kanbrawl', 'start', '--stdio'];

const MCP_CONFIGS: McpConfig[] = [
  {
    name: 'VS Code / GitHub Copilot',
    configPath: '.vscode/mcp.json',
    serversKey: 'servers',
    generateEntry: () => ({
      type: 'stdio',
      command: STDIO_COMMAND,
      args: STDIO_ARGS,
    }),
  },
  {
    name: 'Claude Code',
    configPath: '.mcp.json',
    serversKey: 'mcpServers',
    generateEntry: () => ({
      command: STDIO_COMMAND,
      args: STDIO_ARGS,
    }),
  },
  {
    name: 'Cursor',
    configPath: '.cursor/mcp.json',
    serversKey: 'mcpServers',
    generateEntry: () => ({
      command: STDIO_COMMAND,
      args: STDIO_ARGS,
    }),
  },
  {
    name: 'Gemini CLI',
    configPath: '.gemini/settings.json',
    serversKey: 'mcpServers',
    generateEntry: () => ({
      command: STDIO_COMMAND,
      args: STDIO_ARGS,
    }),
  },
  {
    name: 'Windsurf',
    configPath: '.windsurf/mcp.json',
    serversKey: 'mcpServers',
    generateEntry: () => ({
      command: STDIO_COMMAND,
      args: STDIO_ARGS,
    }),
  },
];

const AGENTS_MD_SECTION = `
## Task Management

Use the Kanbrawl MCP tools for task management when working on this project.

### Workflow

- When building a plan, include task creation in it
- Check existing tasks with \`list_tasks\` before creating to avoid duplicates
- Always reload tasks with \`list_tasks\` before starting work on a task to get the latest updates
- Always set your name as assignee when working on a task
- Move tasks between columns with \`move_task\` to track progress
`;

export function writeConfigFile(config: McpConfig, cwd: string): void {
  const fullPath = resolve(cwd, config.configPath);
  const dir = dirname(fullPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  let existing: Record<string, unknown> = {};
  if (existsSync(fullPath)) {
    try {
      existing = JSON.parse(readFileSync(fullPath, 'utf8')) as Record<
        string,
        unknown
      >;
    } catch {}
  }

  const servers =
    (existing[config.serversKey] as Record<string, unknown>) ?? {};
  servers.kanbrawl = config.generateEntry();
  existing[config.serversKey] = servers;

  writeFileSync(fullPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
  console.log(`  ✅ ${config.configPath}`);
}

export function updateAgentsMd(cwd: string): void {
  const agentsPath = resolve(cwd, 'AGENTS.md');

  if (existsSync(agentsPath)) {
    const content = readFileSync(agentsPath, 'utf8');
    if (content.includes('Kanbrawl MCP tools')) {
      console.log(
        '  ⏭️  AGENTS.md already contains Kanbrawl section, skipping',
      );
      return;
    }

    writeFileSync(
      agentsPath,
      content.trimEnd() + '\n' + AGENTS_MD_SECTION,
      'utf8',
    );
  } else {
    writeFileSync(agentsPath, `# AGENTS.md\n${AGENTS_MD_SECTION}`, 'utf8');
  }

  console.log('  ✅ AGENTS.md');
}

export async function initAction(): Promise<void> {
  console.log('🥊 Kanbrawl Setup\n');

  const selected = await checkbox<McpConfig>({
    message: 'Select AI tools to configure:',
    choices: MCP_CONFIGS.map((config) => ({
      name: config.name,
      value: config,
    })),
  });

  if (selected.length === 0) {
    console.log('No tools selected. Exiting.');
    return;
  }

  const cwd = process.cwd();

  // Create kanbrawl.json if it doesn't exist
  console.log('\n📋 Setting up board...');
  const boardPath = resolve(cwd, 'kanbrawl.json');
  if (existsSync(boardPath)) {
    console.log('  ⏭️  kanbrawl.json already exists, skipping');
  } else {
    new BoardStore(boardPath); // eslint-disable-line no-new
    console.log('  ✅ kanbrawl.json');
  }

  // Write MCP config files
  console.log('\n🔧 Writing MCP configuration...');
  for (const config of selected) {
    writeConfigFile(config, cwd);
  }

  // Update AGENTS.md
  console.log('\n📝 Updating AGENTS.md...');
  updateAgentsMd(cwd);

  console.log(
    '\n🎉 Kanbrawl is ready! Run `kanbrawl start` to launch the server.',
  );
}
