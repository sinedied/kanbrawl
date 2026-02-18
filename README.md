<div align="center">

# 🥊 Kanbrawl

**A minimal live kanban board built for AI agents**

[![Build](https://img.shields.io/github/actions/workflow/status/sinedied/kanbrawl/ci.yml?style=flat-square&label=build&logo=github)](https://github.com/sinedied/kanbrawl/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/kanbrawl?style=flat-square&logo=npm&logoColor=white&color=cb3837)](https://www.npmjs.com/package/kanbrawl)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D22-5fa04e?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-orange?style=flat-square)](LICENSE)

[Features](#features) · [Getting Started](#getting-started) · [CLI](#cli) · [Configuration](#configuration) · [MCP Tools](#mcp-tools) · [Architecture](#architecture) · [Development](#development)

![Animation showing the Copilot agent using Kanbrawl](./docs/images/demo.gif)

</div>

---

AI agents manage tasks on a kanban board through [MCP](https://modelcontextprotocol.io) tools. Humans follow along in a live web UI that updates in real-time via Server-Sent Events. Both agents and humans can create, edit, move, and delete tasks — all changes sync instantly.

## Features

- 🤖 **MCP Server** — Exposes kanban operations as MCP tools via HTTP or stdio
- 🖥️ **Live Web UI** — View updates in real-time and edit/update tasks with drag-and-drop
- ⌨️ **CLI** — Easy setup to configure your AI tools, create and update tasks from the terminal
- 📄 **Single JSON file** — All board config and task data lives in `kanbrawl.json`
- 🔧 **Customizable** — Configure columns to fit your workflow
- 📦 **Zero infrastructure** — No database, no external services

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) >= 22

### Quick Start

Run the interactive setup in your project directory:

```bash
npx kanbrawl init
```

This will:
1. Let you select your AI tools (VS Code Copilot, Claude Code, Cursor, Gemini CLI, Windsurf)
2. Generate the appropriate MCP config files using stdio transport
3. Create a `kanbrawl.json` board file with default columns
4. Append a Kanbrawl usage section to `AGENTS.md`

That's it — your AI agent can now use MCP tools to manage tasks on the board.

### View the Board

To launch the web UI and HTTP MCP server:

```bash
npx kanbrawl start
```

Open [http://localhost:3000](http://localhost:3000) to view the board.

### Manual MCP Configuration

If you prefer to configure your MCP client manually instead of using `kanbrawl init`:

**Stdio transport** (recommended):

```json
{
  "mcpServers": {
    "kanbrawl": {
      "command": "npx",
      "args": ["-y", "kanbrawl", "start", "--stdio"]
    }
  }
}
```

**HTTP transport** (requires a running server):

```json
{
  "mcpServers": {
    "kanbrawl": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

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

### `task` command

Create or update tasks directly from the terminal:

```bash
kanbrawl task "Fix login bug" -p 0 -a alice -c "In progress"
kanbrawl task "Fix login bug" -u -c "Done"
```

| Option | Description |
|--------|-------------|
| `-d, --description <text>` | Task description |
| `-c, --column <name>` | Target column |
| `-p, --priority <level>` | Priority (0, 1, or 2; default 1) |
| `-a, --assignee <name>` | Task assignee |
| `-u, --update` | Update existing task by title match |

### `init` command

Interactive setup that:
1. Prompts to select AI tools (VS Code Copilot, Claude Code, Cursor, Gemini CLI, Windsurf)
2. Generates MCP config files with stdio transport for each selected tool
3. Creates `kanbrawl.json` with default columns if missing
4. Appends a Kanbrawl usage section to `AGENTS.md`

## Configuration

All configuration and data is stored in `kanbrawl.json`, auto-created on first run:

```json
{
  "columns": ["Todo", "In progress", "Blocked", "Done"],
  "theme": "dark",
  "tasks": []
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `columns` | `string[]` | `["Todo", "In progress", "Blocked", "Done"]` | Column names and order |
| `theme` | `"light"` \| `"dark"` | System preference | UI theme override |
| `tasks` | `Task[]` | `[]` | Task objects (managed by the app) |

> [!TIP]
> Edit the `columns` array to customize your board layout. Changes take effect on restart.

## MCP Tools

All tools are available via the `/mcp` endpoint.

| Tool | Description | Read-only |
|------|-------------|-----------|
| `get_columns` | Get columns with task counts | ✅ |
| `list_tasks` | List tasks, filtered by column (default: first) and priority | ✅ |
| `create_task` | Create a new task (with priority, assignee) | ❌ |
| `move_task` | Move a task to a different column | ❌ |
| `update_task` | Update task fields (title, description, priority, assignee) | ❌ |
| `delete_task` | Delete a task | ❌ |

## Architecture

```mermaid
graph LR
  subgraph Clients
    A["🤖 AI Agents"]
    B["🖥️ Web Browser"]
  end

  subgraph Server ["Express 5 Server"]
    MCP["MCP Endpoint<br/><code>/mcp</code>"]
    API["REST API<br/><code>/api/*</code>"]
    SSE["SSE Endpoint<br/><code>/events</code>"]
    Store["BoardStore"]
  end

  DB[("kanbrawl.json")]

  A -- "MCP tools<br/>(Streamable HTTP)" --> MCP
  B -- "REST calls" --> API
  B -. "real-time events" .-o SSE

  MCP --> Store
  API --> Store
  Store -- "read/write" --> DB
  Store -- "emit events" --> SSE
```

**How it works:**

1. **AI agents** call MCP tools (e.g. `create_task`) via the `/mcp` Streamable HTTP endpoint
2. **Humans** interact through the web UI, which calls the REST API at `/api/*`
3. All mutations flow through the **BoardStore**, which persists data to `kanbrawl.json` and emits change events
4. The **SSE manager** broadcasts events to all connected browser clients for real-time updates

## Development

### Dev Mode

Runs the Express server with auto-reload and Vite dev server with HMR:

```bash
npm run dev
```

| Service | URL | Description |
|---------|-----|-------------|
| Server | [localhost:3000](http://localhost:3000) | API, MCP, SSE |
| Client | [localhost:5173](http://localhost:5173) | Vite dev with proxy |

### Build

```bash
npm run build          # Build both server and client
npm run build:server   # Build server only (tsc)
npm run build:client   # Build client only (vite)
npm run clean          # Remove dist/
```

