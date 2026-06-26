# Resources API — Take-Home

A small REST API over PostgreSQL. TypeScript + Express + `pg` with raw, parameterized SQL (no ORM). Migrations are plain `.sql` files applied by a script; tests run with Vitest + Supertest.

## Prerequisites

- Node.js 20+
- Docker (for the Postgres container)

## Run it

```bash
cp .env.example .env
npm install
npm run db:up      # start Postgres in Docker
npm run db:reset   # apply migrations + seed deterministic data
npm run dev        # http://localhost:3000
```

## Test it

```bash
npm test
```

Tests run against a real Postgres instance (the same Docker container). Make sure `db:up` and `db:reset` have been run at least once before running tests.

## Endpoints

### `GET /resources`

Returns resources visible to the authenticated caller. Requires `x-user-id` header.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | — | Filter by resource type (`doc`, `sheet`, `slide`) |
| `status` | string | — | Filter by status (`draft`, `published`, `archived`) |
| `page` | integer ≥ 1 | 1 | Page number |
| `limit` | integer ≥ 1 | 10 | Items per page |

**Response:**
```json
{
  "data": [...],
  "pagination": { "page": 1, "limit": 10, "offset": 0 }
}
```

**Errors:**
- `401` — missing `x-user-id` header
- `400` — invalid `page` or `limit` value

### `GET /resources/recent`

Returns the 10 most recently created resources across all owners (internal/admin endpoint, no access control).

### `GET /users/:userId/resources`

Returns resources owned by a specific user.

## Scripts

| Script | What it does |
|--------|-------------|
| `npm run db:up` | Start the Postgres container |
| `npm run db:reset` | Apply migrations, then reseed the DB |
| `npm run dev` | Run the server with live reload |
| `npm run build` | Type-check / compile to `dist/` |
| `npm test` | Run the test suite |

## Design decisions

**Pagination — offset/limit:** Chosen for simplicity given the scope. The trade-off is that concurrent inserts can shift page boundaries (a record added between page 1 and page 2 requests may appear twice or not at all). Cursor-based pagination would be more stable for high-write feeds but adds complexity to filtering.

**Access control — 401 for unauthenticated requests:** `GET /resources` requires `x-user-id`. Returning all resources to an unauthenticated caller would be a data leak. The other two endpoints (`/recent`, `/users/:id/resources`) were left as-is since they were out of scope for this task.

**`viewerId` optional in `findResources()`:** Keeps the shared function usable by callers that legitimately don't need user scoping (e.g. the internal `/recent` endpoint). The access-control condition only activates when `viewerId` is explicitly passed.

**No ORM:** Raw parameterized SQL keeps queries transparent and avoids abstraction overhead for a service this size.

**Index on `resource_shares(user_id)`:** The access-control subquery filters by `user_id`; without an index this is a full table scan on every request. Added in `migrations/0002_indexes.sql`.

## What I'd do with more time

- Add `total` count to pagination response (requires a separate `COUNT(*)` query)
- Apply access control to `GET /resources/recent` and `GET /users/:userId/resources`
- Cursor-based pagination for stability under concurrent writes
- Input validation on `type` and `status` (reject unknown values with `400`)
- `EXPLAIN ANALYZE` on the access-control query against a larger dataset to validate index usage

## What I'm unsure about

- Whether `GET /resources/recent` is intentionally admin-only or should also be user-scoped
- Whether offset/limit is acceptable long-term given the concurrent-write instability
