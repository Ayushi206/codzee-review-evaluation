# Task Manager API

REST API for managing tasks. TypeScript + Express + PostgreSQL.

## Stack

- Node 18+, Express 4, TypeScript
- PostgreSQL with `pg` (plain SQL, no ORM)
- Zod for validation
- Vitest + Supertest

## Setup

Needs Node 18+ and PostgreSQL 13+ (uses `gen_random_uuid()`).
Copy `.env.example` to `.env` and set `DATABASE_URL`.

```bash
npm install
createdb taskmanager
npm run migrate
npm run dev   # http://localhost:3000
```

Tests use an in-memory repository, so no database is needed:

```bash
npm test
npm run typecheck
```

## API

| Method | Path             | Description                              |
|--------|------------------|------------------------------------------|
| GET    | `/health`        | Health check                             |
| POST   | `/api/tasks`     | Create a task                            |
| GET    | `/api/tasks`     | List tasks (filter, search, sort, page)  |
| GET    | `/api/tasks/:id` | Get one task                             |
| PATCH  | `/api/tasks/:id` | Partially update a task                  |
| DELETE | `/api/tasks/:id` | Delete a task                            |

**List query parameters:** `status` (`todo` | `in_progress` | `done`), `priority` (`low` | `medium` | `high`),
`search`, `page` (default 1), `limit` (default 20, max 100),
`sortBy` (`createdAt` | `dueDate` | `priority`), `order` (`asc` | `desc`).

### Examples

```bash
# Create
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Prepare release notes", "priority": "high", "dueDate": "2026-11-01"}'

# List high-priority tasks that are in progress
curl "http://localhost:3000/api/tasks?status=in_progress&priority=high&sortBy=dueDate&order=asc"

# Move a task forward
curl -X PATCH http://localhost:3000/api/tasks/<id> \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'
```

Errors share one shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed", "details": [] } }
```

## Status workflow

`todo -> in_progress -> done`. A task in progress can go back to todo, and a done task can be
reopened to in_progress. Anything else (like todo -> done) returns `409 INVALID_STATUS_TRANSITION`.

## Structure

- `src/modules/tasks`: routes, Zod schemas, service, repository
- `src/db`: pg pool and migration runner
- `migrations`: SQL files
- `tests`: service and API tests
