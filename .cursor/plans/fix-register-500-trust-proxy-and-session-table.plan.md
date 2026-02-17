---
name: ""
overview: ""
todos: []
isProject: false
---

# Fix registration 500: trust proxy + session table

**Status: Built (Option A)**

---

## Problem

1. **express-rate-limit** throws `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` because Railway sends `X-Forwarded-For` but Express `trust proxy` is false.
2. **connect-pg-simple** fails with `relation "session" does not exist` because the `session` table was never created in Postgres.

---

## Plan as built

### 1. Enable Express trust proxy — Done

**File:** [backend/src/index.ts](backend/src/index.ts)

- Added `app.set('trust proxy', 1);` immediately after `const app = express();`, before any `app.use(...)`.
- Express now trusts the proxy’s `X-Forwarded-For` so express-rate-limit can identify clients and no longer throws.

### 2. Create the `session` table (Option A — Prisma migration) — Done

- **Migration:** [backend/prisma/migrations/20250217210000_add_session_table/migration.sql](backend/prisma/migrations/20250217210000_add_session_table/migration.sql)
- Creates the `session` table with columns `sid`, `sess`, `expire`, primary key on `sid`, and index on `expire` (connect-pg-simple schema).
- On the next backend deploy, Railway runs `prisma migrate deploy` and creates the table.

### 3. What you need to do

- **Redeploy the backend** on Railway so the trust-proxy change and the new migration run.
- Test: open the app, go to Create account, submit the form. Registration should succeed with no 500 from session or rate-limit.

---

## Summary


| Fix                            | Status | What was done                                                                                                                                   |
| ------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Rate limiter / X-Forwarded-For | Done   | `app.set('trust proxy', 1);` added in [backend/src/index.ts](backend/src/index.ts).                                                             |
| Session table                  | Done   | Prisma migration [20250217210000_add_session_table](backend/prisma/migrations/20250217210000_add_session_table/migration.sql) added (Option A). |


