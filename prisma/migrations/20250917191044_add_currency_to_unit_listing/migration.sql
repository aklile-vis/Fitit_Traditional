-- Add currency column with ETB default
ALTER TABLE "unit_listings" ADD COLUMN "currency" TEXT DEFAULT 'ETB';

-- Backfill null currency values to ETB for consistency
UPDATE "unit_listings" SET "currency" = 'ETB' WHERE "currency" IS NULL;
