-- Ensure asset.format is always populated for downstream consumers.
-- Apply using: psql "$DATABASE_URL" -f backend/migrations/007_asset_format_not_null.sql

UPDATE assets
SET format = 'UNKNOWN'
WHERE format IS NULL;

ALTER TABLE assets
    ALTER COLUMN format SET DEFAULT 'UNKNOWN',
    ALTER COLUMN format SET NOT NULL;
