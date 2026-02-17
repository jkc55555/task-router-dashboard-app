# Resolve failed migration `20250217000000_add_user_and_user_id`

Prisma has marked this migration as **failed** in the production DB, so `migrate deploy` will not run until you resolve it.

You need to run the following **against your Railway production database** (set `DATABASE_URL` to Railway’s Postgres URL).

---

## Option A: Roll back and let deploy re-apply (simplest)

Use this if you’re okay re-running the migration (e.g. it failed due to a transient error or the DB was empty/clean).

1. **From your machine** (with Railway DB URL):

   ```bash
   cd backend
   export DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/railway?sslmode=require"
   npx prisma migrate resolve --rolled-back "20250217000000_add_user_and_user_id"
   ```

2. Redeploy on Railway. The next startup will run `prisma migrate deploy` and apply the migration again.

If the migration had **partially** applied (e.g. some columns exist), it might fail again. In that case use Option B.

---

## Option B: Manually complete migration, then mark as applied

Use this if the migration ran partially and you want to bring the DB in line with the schema without re-running the same SQL.

1. **Generate the "missing" SQL** (from current DB state → your schema):

   ```bash
   cd backend
   export DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/railway?sslmode=require"
   npx prisma migrate diff \
     --from-url "$DATABASE_URL" \
     --to-schema prisma/schema.prisma \
     --script > forward.sql
   ```

2. **Apply that SQL** (no migration history change):

   ```bash
   npx prisma db execute --url "$DATABASE_URL" --file forward.sql
   ```

3. **Mark the failed migration as applied** so Prisma stops blocking:

   ```bash
   npx prisma migrate resolve --applied "20250217000000_add_user_and_user_id"
   ```

4. Redeploy. `migrate deploy` will see the migration as applied and will continue with any later migrations.

---

## Getting Railway’s `DATABASE_URL`

- Railway project → your Postgres service → **Variables** or **Connect**.
- Use the full URL (often `DATABASE_URL` or `POSTGRES_URL`), e.g.  
  `postgresql://postgres:PASSWORD@containers-us-west-xxx.railway.app:PORT/railway`
- If you use the internal hostname `postgres.railway.internal:5432`, that only works from inside Railway. For running commands from your machine, use the **public** connection URL from the dashboard.

---

## One-liner (Option A) from project root

```bash
cd backend && DATABASE_URL="YOUR_RAILWAY_DATABASE_URL" npx prisma migrate resolve --rolled-back "20250217000000_add_user_and_user_id"
```

Replace `YOUR_RAILWAY_DATABASE_URL` with the real URL from Railway.

---

## Option C: Container still sees "failed" (internal vs public URL)

If you ran `migrate resolve --applied` from your machine using **DATABASE_PUBLIC_URL** but the container still fails with P3009, the container may be using the **internal** URL (`postgres.railway.internal:5432`). In some setups that can point at a different instance, or the resolve didn't affect the DB the container uses.

### C1. Make the backend use the same (public) URL we fixed

1. In **Railway** → your **Postgres** service → **Variables** → copy the value of **`DATABASE_PUBLIC_URL`** (full connection string).
2. Go to your **backend** service → **Variables**.
3. Set **`DATABASE_URL`** to that exact value (paste the public URL).  
   If it's currently a reference like `${{Postgres.DATABASE_URL}}`, replace it with the pasted public URL so the backend uses the same database we fixed.
4. **Redeploy** the backend. The container will connect with the public URL and should see the migration as applied.

After the app is stable you can try switching `DATABASE_URL` back to the internal reference if you prefer.

### C2. Fix the migration row directly in the database

If C1 doesn't help (or you can't change the backend URL), fix the **same** database the container uses by updating Prisma's migration table.

Using the **public** URL (or any URL that reaches the same DB as the container), run the SQL below in Railway's Postgres **Query** tab (or with `psql` / `prisma db execute`).

**To mark as rolled back** (so deploy will re-apply the migration):

```sql
UPDATE "_prisma_migrations"
SET "rolled_back_at" = NOW()
WHERE "migration_name" = '20250217000000_add_user_and_user_id'
  AND "finished_at" IS NULL
  AND ("rolled_back_at" IS NULL OR "rolled_back_at" IS NOT NULL);
```

**To mark as applied** (so deploy will not re-run it):

```sql
UPDATE "_prisma_migrations"
SET "finished_at" = COALESCE("started_at", NOW()), "applied_steps_count" = 1, "logs" = NULL
WHERE "migration_name" = '20250217000000_add_user_and_user_id'
  AND "finished_at" IS NULL;
```

Or via CLI (mark as applied example):

```bash
cd backend
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@metro.proxy.rlwy.net:18481/railway"
npx prisma db execute --url "$DATABASE_URL" --stdin <<'SQL'
UPDATE "_prisma_migrations"
SET "finished_at" = COALESCE("started_at", NOW()), "applied_steps_count" = 1, "logs" = NULL
WHERE "migration_name" = '20250217000000_add_user_and_user_id'
  AND "finished_at" IS NULL;
SQL
```

Then redeploy the backend.
