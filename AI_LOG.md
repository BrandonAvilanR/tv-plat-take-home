# AI Usage Log

## Tools used

- **Claude (Claude Code)** — used at two specific points during development for concept clarification and a syntax question.

## Where I used it and why

**Pagination strategy:**
I was deciding between offset/limit and cursor-based pagination. I asked Claude to explain the trade-offs. It confirmed that offset/limit was the right call for this scope and explained why cursor-based is more stable under concurrent writes. I used that explanation to write the trade-offs section in the README and PR description.

**Access control subquery — double `$N` reference:**
When writing the `viewerId` condition I was unsure whether I could reference the same parameter placeholder twice in one condition:
```sql
(owner_id = $1 OR id IN (SELECT resource_id FROM resource_shares WHERE user_id = $1))
```
I asked Claude to confirm this was valid. It confirmed that Postgres resolves `$N` by position in the params array, so reusing the same index is correct and only one `params.push()` is needed.

## How I verified the output

- Ran `npm run db:reset` and used `curl` to manually test each endpoint against the seed data
- Ran `npm test` against the real Postgres Docker instance to confirm all cases passed
- Did not use AI to write tests — wrote them myself based on the seed data counts
