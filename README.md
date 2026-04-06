# Relay Tasks

Relay Tasks is a local-first ticket tracker inspired by Linear.
It runs on `localhost`, stores its data in SQLite, and keeps the workflow simple.
It is built for solo developers who want a lightweight backlog they can manage themselves or connect to agents.
Run it with `npm install` and `npm run dev`.

## What This Is

- A personal issue tracker for local development work.
- A small ticket system with labels, status, priority, search, and filtering.
- A local app with both a human UI and an agent-friendly API.

## Why I Built It

I wanted a tracking tool that stayed local, felt lightweight, and did not assume a full team workflow.
I also wanted something agents could use directly to open tickets, update work, and leave notes without adding a hosted service to the stack.
This is meant to stay simple for solo development, not to become a full project management platform.

## What It Includes

- React + Vite frontend
- Express API
- SQLite via `better-sqlite3`
- Public agent API with OpenAPI output
- Local MCP server for agent tooling
- Vitest + Testing Library + Supertest coverage

## Local Run

```bash
npm install
npm run dev
```

This starts:

- the API server at `http://localhost:3000`
- the frontend at `http://localhost:5173`

For a production-style local run:

```bash
npm run build
npm start
```

## Data

- SQLite database path: `data/app.db`
- The schema is created automatically on first boot.
- A few starter labels are seeded only when the labels table is empty.
- Agent-created tickets can store a `source`, an `externalRef`, and ticket notes for audit history.

## Public Agent API

The server exposes a machine-facing API at `http://localhost:3000/api/public/v1`.

- OpenAPI document: `GET /api/public/v1/openapi.json`
- Supported flows: list tickets, create tickets idempotently with `source` + `externalRef`, fetch ticket details, patch ticket fields, and append notes

Example ticket creation:

```bash
curl -X POST http://localhost:3000/api/public/v1/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Investigate sync failure",
    "description": "Triggered from CI pipeline",
    "priority": "high",
    "source": "github-actions",
    "externalRef": "run-4421",
    "note": "Opened automatically from CI.",
    "actorName": "CI Agent"
  }'
```

Example handling update:

```bash
curl -X PATCH http://localhost:3000/api/public/v1/tickets/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "note": "Picked up by the triage agent.",
    "actorName": "Triage Bot"
  }'
```

## MCP Server

This repo also includes a local MCP server that wraps the Relay ticket API and exposes typed tools over stdio.

- Dev command: `npm run mcp:dev`
- Built command: `npm run build:server && npm run mcp`
- Optional API override: set `RELAY_API_URL` if the Relay app is not running on `http://127.0.0.1:3000/api/public/v1`
- Accepted `RELAY_API_URL` formats: `http://127.0.0.1:3000`, `http://127.0.0.1:3000/api`, or `http://127.0.0.1:3000/api/public/v1`

Available tools:

- `relay_list_labels`
- `relay_list_tickets`
- `relay_get_ticket`
- `relay_create_ticket`
- `relay_update_ticket`
- `relay_add_ticket_note`
- `relay_delete_ticket`

Example MCP client config:

```json
{
  "mcpServers": {
    "relay-tasks": {
      "command": "npm",
      "args": ["run", "mcp:dev"],
      "cwd": "/path/to/relay"
    }
  }
}
```

If the app API runs elsewhere, pass `RELAY_API_URL` in the server environment:

```json
{
  "mcpServers": {
    "relay-tasks": {
      "command": "npm",
      "args": ["run", "mcp:dev"],
      "cwd": "/path/to/relay",
      "env": {
        "RELAY_API_URL": "http://127.0.0.1:3000/api/public/v1"
      }
    }
  }
}
```

## Scripts

```bash
npm run dev
npm run mcp:dev
npm test
npm run build
npm run mcp
npm start
```

## Troubleshooting

If `npm install` fails while compiling `better-sqlite3` because `node-gyp` picks an older Python from `pyenv`, rerun:

```bash
PYTHON=/usr/bin/python3 npm install
```
