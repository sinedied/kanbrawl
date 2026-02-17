<div align="center">

# 🥊 Kanbrawl

**A minimal live kanban board built for AI agents**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-Streamable_HTTP-ff6b35?style=flat-square)](https://modelcontextprotocol.io)
[![Express](https://img.shields.io/badge/Express-5-000?style=flat-square&logo=express)](https://expressjs.com)
[![Lit](https://img.shields.io/badge/Lit-3-324fff?style=flat-square&logo=lit&logoColor=white)](https://lit.dev)

[Features](#features) · [Getting Started](#getting-started) · [Configuration](#configuration) · [MCP Tools](#mcp-tools) · [Development](#development)

</div>

---

AI agents manage tasks on a kanban board through MCP tools. Humans follow along in a live web UI that updates in real-time via Server-Sent Events. Both agents and humans can create, edit, move, and delete tasks.

## Features

- **MCP Server** — Exposes kanban operations as MCP tools via Streamable HTTP transport
- **Live Web UI** — Lit 3 web components with real-time SSE updates, dark theme, smooth animations
- **Single JSON file** — All board config and task data lives in `kanbrawl.json`
- **Customizable columns** — Configure column names and count in `kanbrawl.json`
- **Human + Agent editing** — Agents use MCP tools, humans use the web UI; changes sync instantly
- **Zero external dependencies** — No database, no Redis, no WebSocket library

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) >= 18

### Quick Start

```bash
npm install
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the board.

### MCP Client Configuration

Add the following to your MCP client configuration:

```json
{
  "mcpServers": {
    "kanbrawl": {
      "type": "streamable-http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Configuration

All configuration and data is stored in a single `kanbrawl.json` file, auto-created on first run with defaults:

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

Edit the `columns` array to customize your board. Changes take effect on restart.

## MCP Tools

All tools use the `kanbrawl_` prefix and are available via the `/mcp` endpoint.

| Tool | Description | Read-only |
|------|-------------|-----------|
| `kanbrawl_get_board` | Get full board state (columns + tasks) | ✅ |
| `kanbrawl_list_tasks` | List tasks, optionally filtered by column | ✅ |
| `kanbrawl_create_task` | Create a new task | ❌ |
| `kanbrawl_move_task` | Move a task to a different column | ❌ |
| `kanbrawl_update_task` | Update task title/description | ❌ |
| `kanbrawl_delete_task` | Delete a task | ❌ |

## Development

### Dev Mode

Runs the Express server with auto-reload and Vite dev server with HMR:

```bash
npm run dev
```

- Server: [http://localhost:3000](http://localhost:3000) (API, MCP, SSE)
- Client: [http://localhost:5173](http://localhost:5173) (Vite dev with proxy)

### Build

```bash
npm run build          # Build both server and client
npm run build:server   # Build server only
npm run build:client   # Build client only
```

### Project Structure

```
├── src/server/         # Express + MCP server
│   ├── index.ts        # Main entry point
│   ├── store.ts        # BoardStore (JSON file persistence)
│   ├── tools.ts        # MCP tool registrations
│   ├── api.ts          # REST API routes for web UI
│   ├── sse.ts          # Server-Sent Events manager
│   └── types.ts        # Shared TypeScript types
├── client/             # Lit 3 web client
│   ├── src/
│   │   ├── app.ts      # Root app component + SSE handling
│   │   ├── api.ts      # REST API client
│   │   └── components/ # Board, Column, Task components
│   ├── index.html      # Vite entry point
│   └── vite.config.ts  # Vite configuration
├── kanbrawl.json       # Board config + data (auto-created)
└── package.json
```

### Architecture

```
┌──────────────┐     MCP/HTTP      ┌─────────────────────┐
│  AI Agents   │ ──────────────▸   │                     │
└──────────────┘                   │   Express 5 Server  │
                                   │                     │
┌──────────────┐    REST + SSE     │  ┌───────────────┐  │     ┌───────────────┐
│  Web Browser │ ◂─────────────▸   │  │  BoardStore   │──────▸ │ kanbrawl.json │
└──────────────┘                   │  └───────────────┘  │     └───────────────┘
                                   └─────────────────────┘
```
