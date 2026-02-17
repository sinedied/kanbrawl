import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { startAction } from './commands/start.js';
import { taskAction } from './commands/task.js';
import { initAction } from './commands/init.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(
  readFileSync(resolve(__dirname, '../../package.json'), 'utf8'),
) as { version: string };

export function run(arguments_: string[]): void {
  const program = new Command();

  program
    .name('kanbrawl')
    .description('A minimal live kanban board for AI agents, powered by MCP')
    .version(version);

  program
    .command('start', { isDefault: true })
    .description('Start the Kanbrawl server')
    .option('--stdio', 'Use stdio transport for MCP (instead of HTTP server)')
    .action(startAction);

  program
    .command('task <title>')
    .description('Create or update a task on the board')
    .option('-d, --description <text>', 'Task description')
    .option('-c, --column <name>', 'Target column')
    .option('-p, --priority <level>', 'Priority level (0, 1, or 2)', '1')
    .option('-a, --assignee <name>', 'Task assignee')
    .option('-u, --update', 'Update existing task by title match')
    .action(taskAction);

  program
    .command('init')
    .description('Initialize Kanbrawl configuration for your AI tools')
    .action(initAction);

  program.parse(arguments_);
}
