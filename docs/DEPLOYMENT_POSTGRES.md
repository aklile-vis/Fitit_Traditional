# PostgreSQL Migration Notes

This repository now supports switching between SQLite (default for local
prototyping) and PostgreSQL (recommended for staging/production).

## Environment configuration

Update your `.env` with the following keys:

```
DATABASE_URL=postgresql://user:password@hostname:5432/database
```

A sample configuration lives in `prisma/.env.postgres.example`.

> **Note:** Prisma still needs its datasource provider updated manually. Edit
> `prisma/schema.prisma` and change `provider = "sqlite"` to
> `provider = "postgresql"`, then run the commands below.

## Migrations and schema

1. Install dependencies `npm install` (Prisma generates client files per the
   active datasource).
2. Apply the schema:
   - `npx prisma migrate deploy` (preferred in CI/CD once migrations exist)
   - For local bootstrapping: `npx prisma db push` to sync the schema without
     creating migrations.
3. Regenerate the Prisma client: `npx prisma generate`.

## Verification checklist

- Run `npm run smoke` to ensure the DXF → IFC/GLB/USD pipeline still functions
  after switching databases (the smoke test relies on Prisma models for unit
  ingestion).
- Execute targeted API checks (e.g. `/api/listings`, `/api/units/[id]`) to
  confirm Postgres connectivity.

## SQLite fallback

For single-developer experiments you can stay on SQLite by using:

```
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./prisma/dev.db
```

When switching providers, re-run `npx prisma generate` so the Prisma client
matches the datasource.
