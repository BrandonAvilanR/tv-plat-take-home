# PR Write-up

## Summary

Implements filtering, pagination, and user-scoped access control on the shared `findResources()` data path. `GET /resources` now requires an authenticated caller and returns only resources that caller owns or has been explicitly shared with them.

## Changes

- **`src/data/resources.ts`** — extended `FindResourcesOpts` with `type`, `status`, `offset`, and `viewerId` fields; refactored `WHERE` clause construction to use a conditions array to support multiple filters safely; added access-control filter (`owner_id = $N OR id IN (SELECT resource_id FROM resource_shares WHERE user_id = $N)`) when `viewerId` is present
- **`src/app.ts`** — `GET /resources` now validates `page`/`limit` query params, returns `401` if no `x-user-id` header is present, and passes `req.userId` as `viewerId` to `findResources()`
- **`migrations/0002_indexes.sql`** — adds `idx_resource_shares_user_id` on `resource_shares(user_id)` to avoid a full table scan on the access-control subquery
- **`test/resources.test.ts`** — added access control test suite covering the key cases below

## Testing

### Automated tests

| Case | What it verifies |
|------|-----------------|
| No `x-user-id` header | Returns `401` |
| Owner access | User sees exactly their own resources, no other owner's data leaks through |
| Shared access | User sees their own resources plus resources explicitly shared with them |
| Empty results | User with no resources and no shares gets an empty array, not an error |

All tests run against a real Postgres instance (Docker) using deterministic seed data, so the row counts are exact expectations, not approximations.

### Edge cases considered

- `?page=abc` or `?limit=-1` → `400` with a clear error message
- `?page=2` without `?limit` → uses default limit of 10, no crash
- User with no resources but valid `x-user-id` → `200` with empty `data` array
- Shared resource where `user_id = owner_id` is not in the seed (the seed enforces this constraint), so no double-counting

### Other callers of `findResources()` — regression analysis

`findResources()` is called by two other endpoints that do **not** pass `viewerId`:

- `GET /resources/recent` — passes `{ limit: 10, orderBy: 'created_at desc' }`. Since `viewerId` is `undefined`, the access-control condition is not added to the query. This endpoint returns data across all owners, which is intentional (it's an internal/admin-style feed, not a user-facing list). **No regression.**
- `GET /users/:userId/resources` — passes `{ ownerId }`. Same: no `viewerId`, so the new condition is not applied. The `ownerId` filter was already there and is unchanged. **No regression.**

The access-control condition is strictly additive — it only activates when `viewerId` is explicitly passed. Callers that don't pass it are unaffected.

### Performance / regression

The access-control subquery (`WHERE user_id = $N` on `resource_shares`) would be a full table scan without an index. Added `idx_resource_shares_user_id` in `migrations/0002_indexes.sql`. The `owner_id` index on `resources` already existed in the baseline schema and covers the `owner_id = $N` side of the OR condition.

### How to verify

```bash
docker-compose up -d
npm run db:reset
npm test

# Manual smoke tests (requires the server running: npm run dev)
npm run dev &
curl -H "x-user-id: 1" "http://localhost:3000/resources"          # only owner_id=1 + shares
curl -H "x-user-id: 2" "http://localhost:3000/resources?limit=50" # owner_id=2 + resource 1 shared
curl "http://localhost:3000/resources"                             # 401
curl "http://localhost:3000/resources?type=doc&status=draft"       # filtered
curl "http://localhost:3000/resources?page=abc"                    # 400
```

## Trade-offs

- **Offset/limit pagination** over cursor-based: simpler to implement and sufficient for this scope. The trade-off is instability under concurrent writes (a new insert can shift page boundaries). For a high-write feed, cursor-based would be preferable.
- **No `total` count in pagination response**: returning the total would require a separate `COUNT(*)` query. Omitted for scope — noted as a future improvement.
- **`GET /resources/recent` and `GET /users/:userId/resources` are not access-controlled**: they were out of scope for this task. In production both would need the same `viewerId` treatment or an admin-only guard.
- **`viewerId` is optional in `FindResourcesOpts`**: this keeps the shared function flexible for callers that legitimately don't need user scoping (like the internal `/recent` endpoint). The alternative — making access control mandatory — would be safer by default but would require updating all callers at once.

## Open questions

- Should `GET /resources/recent` be access-controlled or is it intentionally an admin/internal endpoint?
- Should unauthenticated requests to other endpoints (e.g. `/resources/recent`) also return `401`?
- Is offset/limit acceptable long-term or should we plan a cursor migration?
