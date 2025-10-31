-- Adds ingest-tracking fields introduced in 2025-10-30 backend changes.
-- Run this against the same database url the app uses, e.g.:
--   psql "$DATABASE_URL" -f backend/migrations/002_add_asset_ingest_columns.sql

ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS last_error TEXT NULL,
    ADD COLUMN IF NOT EXISTS metadata_warnings TEXT NULL,
    ADD COLUMN IF NOT EXISTS reference_count INTEGER NULL;

UPDATE assets
SET reference_count = COALESCE(reference_count, 1)
WHERE reference_count IS NULL;

ALTER TABLE assets
    ALTER COLUMN reference_count SET DEFAULT 1,
    ALTER COLUMN reference_count SET NOT NULL;

-- optional: keep default for future inserts managed by SQLAlchemy
