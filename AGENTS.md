# Kanbrawl

A minimal live kanban board for AI agents, powered by MCP (Model Context Protocol).

## Overview

- Express 5 server hosting MCP (Streamable HTTP), REST API, SSE, and static client
- Lit 3 web components for the frontend, bundled with Vite
- Single `kanbrawl.json` file for all configuration and task data
- AI agents interact via MCP tools; humans interact via the web UI
- Real-time synchronization between all clients via Server-Sent Events

## Key Technologies and Frameworks

- **Runtime**: Node.js >= 18, TypeScript 5.7 (ES2022, Node16 modules)
- **Server**: Express 5, `@modelcontextprotocol/sdk` (Streamable HTTP transport)
- **Client**: Lit 3 (web components), Vite 6
- **Validation**: Zod for MCP tool input schemas
- **Persistence**: JSON file (`kanbrawl.json`)
- **IDs**: UUID v4 via `uuid` package

## Project Structure

```
src/server/        → Express + MCP server (TypeScript, compiled to dist/server/)
  index.ts         → Main entry, Express app setup, MCP + SSE wiring
  store.ts         → BoardStore class (read/write kanbrawl.json, emit events)
  tools.ts         → MCP tool registrations (kanbrawl_* prefix)
  api.ts           → REST API router (/api/board, /api/tasks)
  sse.ts           → SSE client manager (broadcast board events)
  types.ts         → Shared TypeScript interfaces

client/            → Lit 3 web client (built by Vite to dist/client/)
  src/app.ts       → Root <kanbrawl-app> component, SSE event handling
  src/api.ts       → fetch-based REST API client
  src/components/  → board.ts, column.ts, task.ts components
  index.html       → Vite entry point
  vite.config.ts   → Vite config with dev proxy to Express
```

## Development Workflow

```bash
npm install          # Install all dependencies
npm run dev          # Start dev mode (server + Vite HMR)
npm run build        # Build both server and client
npm start            # Run production server
npm run build:server # Build server only (tsc)
npm run build:client # Build client only (vite build)
npm run clean        # Remove dist/
```

- Dev server runs on port 3000 (Express API/MCP/SSE)
- Dev client runs on port 5173 (Vite with proxy to Express)
- Production: single Express server on port 3000 serves everything

## Coding Guidelines

- **TypeScript strict mode** enabled for both server and client
- **ES modules** throughout (`"type": "module"` in package.json)
- Server uses **Node16 module resolution**; client uses **bundler resolution**
- Lit components use **experimental decorators** (`@customElement`, `@property`, `@state`)
- MCP tools follow **snake_case** naming with `kanbrawl_` prefix
- All MCP tools include `title`, `description`, `inputSchema` (Zod), and `annotations`
- REST API follows standard HTTP conventions (POST=create, PATCH=update, DELETE=delete)
- Board mutations always go through `BoardStore` methods which persist to disk and emit events
- SSE events: `board_sync`, `task_created`, `task_updated`, `task_moved`, `task_deleted`

## Constraints and Requirements

- No database — single JSON file for simplicity
- `kanbrawl.json` is auto-created with default columns on first run
- Column changes require server restart (columns are read at startup)
- MCP transport is stateless (new transport per request, no sessions)
- The web UI is a live viewer AND editor — both humans and agents can modify tasks
