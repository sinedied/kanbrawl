# Kanbrawl

A minimal live kanban board for AI agents, powered by MCP (Model Context Protocol).

## Overview

- Express 5 server hosting MCP (Streamable HTTP), REST API, SSE, and static client
- Lit 3 web components for the frontend, bundled with Vite
- Single `kanbrawl.json` file for all configuration and task data
- AI agents interact via MCP tools; humans interact via the web UI
- Real-time synchronization between all clients via Server-Sent Events

## Key Technologies and Frameworks

- **Runtime**: Node.js >= 22, TypeScript 5.7 (ES2024, Node16 modules)
- **Server**: Express 5, `@modelcontextprotocol/sdk` (Streamable HTTP transport)
- **Client**: Lit 3 (web components), Vite 6
- **Validation**: Zod for MCP tool input schemas
- **Persistence**: JSON file (`kanbrawl.json`)
- **IDs**: UUID v4 via `uuid` package

## Project Structure

```
src/
  server/            → Express + MCP server (TypeScript, compiled to dist/server/)
    index.ts         → Express app setup, MCP + SSE wiring, startServer()
    store.ts         → BoardStore class (read/write kanbrawl.json, emit events)
    tools.ts         → MCP tool registrations
    api.ts           → REST API router (/api/board, /api/tasks)
    sse.ts           → SSE client manager (broadcast board events)
    types.ts         → Shared TypeScript interfaces
  cli/               → CLI entry point and commands (compiled to dist/cli/)
    cli.ts           → CLI entry point (commander-based, shebang)
    commands/        → CLI subcommand handlers
      start.ts       → start command (HTTP server or --stdio MCP transport)
      task.ts        → task command (create/update tasks via BoardStore)
      init.ts        → init command (interactive AI tool config setup)
  client/            → Lit 3 web client (built by Vite to dist/client/)
    src/app.ts       → Root <kanbrawl-app> component, SSE event handling
    src/api.ts       → fetch-based REST API client
    src/components/  → board.ts, column.ts, task.ts components
    index.html       → Vite entry point
    vite.config.ts   → Vite config with dev proxy to Express
  extension/         → VS Code extension (separate package, bundled with esbuild)
    src/extension.ts → activate/deactivate, server lifecycle, MCP registration
    src/api.ts       → REST + SSE client (Node http, same endpoints as web UI)
    src/board-provider.ts → TreeDataProvider + drag-and-drop controller
    media/icon.svg   → Activity bar icon
    esbuild.mjs      → Bundle config (CJS output, vscode external)
    package.json     → Extension manifest (views, commands, MCP provider)
```

## Development Workflow

```bash
npm install          # Install all dependencies
npm run dev          # Start dev mode (server + Vite HMR)
npm run build        # Build both server and client
npm start            # Run production server
npm run lint         # Run linter (XO)
npm run lint:fix     # Run linter and auto-fix issues
npm test             # Run tests once
npm run test:watch   # Run tests in watch mode
npm run build:server # Build server only (tsc)
npm run build:client # Build client only (vite build)
npm run build:ext    # Build VS Code extension (esbuild)
npm run watch:ext    # Watch-build VS Code extension
npm run clean        # Remove dist/
```

- Dev server runs on port 3000 (Express API/MCP/SSE)
- Dev client runs on port 5173 (Vite with proxy to Express)
- Production: single Express server on port 3000 serves everything

## Linting

- **Linter**: [XO](https://github.com/xojs/xo) with Prettier integration for consistent code formatting
- XO wraps ESLint with opinionated defaults; project-specific overrides are in `package.json` under `"xo"`
- Prettier config is also in `package.json` (single quotes, bracket spacing)
- Run `npm run lint` to check for issues, `npm run lint:fix` to auto-fix

## Testing

- **Framework**: Vitest with supertest for HTTP assertions
- Test files live next to source files: `src/server/*.test.ts`
- `store.test.ts` — BoardStore unit tests (CRUD, persistence, events, column management)
- `api.test.ts` — REST API endpoint tests (supertest against Express app)
- `tools.test.ts` — MCP tool tests (in-memory MCP client ↔ server via `InMemoryTransport`)
- Each test suite creates a temp `BoardStore` backed by a disposable JSON file, cleaned up in `afterEach`
- **New server features (API routes, MCP tools, store methods) must include corresponding tests**
- **A task is only considered complete when `npm run build`, `npm run lint`, and `npm test` all pass**
- Run all three checks before submitting changes to ensure nothing is broken

## Coding Guidelines

- **TypeScript strict mode** enabled for both server and client
- **ES modules** throughout (`"type": "module"` in package.json)
- Server uses **Node16 module resolution**; client uses **bundler resolution**
- Lit components use **experimental decorators** (`@customElement`, `@property`, `@state`)
- MCP tools follow **snake_case** naming
- All MCP tools include `title`, `description`, `inputSchema` (Zod), and `annotations`
- REST API follows standard HTTP conventions (POST=create, PATCH=update, DELETE=delete)
- Board mutations always go through `BoardStore` methods which persist to disk and emit events
- Tasks have `priority` (P0, P1, P2; default P1) and optional `assignee` (string name)
- Web UI uses drag-and-drop for moving tasks between columns (no move button)
- SSE events: `board_sync`, `task_created`, `task_updated`, `task_moved`, `task_deleted`

## VS Code Extension

The `src/extension/` directory contains a VS Code extension that:
- **Provides MCP tools to Copilot** via `vscode.lm.registerMcpServerDefinitionProvider()` using HTTP transport
- **Shows a sidebar TreeView** with kanban columns as groups and tasks as items
- **Manages the Kanbrawl server** as a child process (spawns `kanbrawl start` automatically)
- **Uses the same REST API + SSE** as the web UI for data (no direct JSON file access)
- **Supports drag-and-drop** to move tasks between columns

### Extension Development

```bash
npm run build:ext    # Build extension (production)
npm run watch:ext    # Watch-build for development
```

To test: open the workspace in VS Code, press F5 with the extension development host configured to `src/extension`.

### Extension Architecture

- `extension.ts`: Spawns `kanbrawl start` child process, registers MCP server (HTTP), creates TreeView, connects SSE
- `api.ts`: REST + SSE client using Node `http` module, inline type definitions matching `src/server/types.ts`
- `boardProvider.ts`: `TreeDataProvider` + `TreeDragAndDropController` — columns as root items, tasks as children with priority icons and assignee descriptions
- Activation: contributed views and commands trigger activation — the `kanbrawl.init` command works even without a `kanbrawl.json`
- The extension uses **CommonJS** (`"module": "commonjs"`) and is bundled with esbuild (separate from the ESM server/client code)

## Constraints and Requirements

- No database — single JSON file for simplicity
- `kanbrawl.json` is auto-created with default columns on first run
- Column changes require server restart (columns are read at startup)
- MCP transport is stateless (new transport per request, no sessions)
- The web UI is a live viewer AND editor — both humans and agents can modify tasks

## CLI

The `kanbrawl` CLI (also aliased as `kb`) provides the following commands:

```bash
kanbrawl                    # Start HTTP server (default)
kanbrawl start              # Start HTTP server
kanbrawl start --stdio      # Start MCP server over stdio transport
kanbrawl task "title"       # Create a task
kanbrawl task "title" -u    # Update existing task by title match
kanbrawl init               # Interactive setup for AI tools
kanbrawl --version          # Show version
kanbrawl --help             # Show help
```

### `task` command options

- `-d, --description <text>` — Task description
- `-c, --column <name>` — Target column
- `-p, --priority <level>` — Priority (0, 1, or 2; default 1)
- `-a, --assignee <name>` — Task assignee
- `-u, --update` — Update existing task by title match instead of creating

### `init` command

Interactive setup that:
1. Prompts to select AI tools (VS Code Copilot, Claude Code, Cursor, Gemini CLI, Windsurf)
2. Generates MCP config files with stdio transport for each selected tool
3. Creates `kanbrawl.json` with default columns if missing
4. Appends a Kanbrawl usage section to `AGENTS.md`

### Stdio MCP transport

Use `kanbrawl start --stdio` to run a stdio-based MCP server (no HTTP, no web UI). This is the transport used in generated MCP config files for AI tools (`npx -y kanbrawl start --stdio`).

## Task Management

Use the Kanbrawl MCP tools for task management when working on this project.
NEVER read the TODO file, it's only a scratchpad.

### Workflow

- When building a plan, include task creation in it
- Check existing tasks with \`list_tasks\` before creating to avoid duplicates
- Always reload tasks with \`list_tasks\` before starting work on a task to get the latest updates
- Set your name as assignee when you start working on a task
- Move tasks between columns with \`move_task\` to track progress
- Proceed with task execution one at a time, till it's done or blocked then move to the next one
