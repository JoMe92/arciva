-- Adds a JSONB column for storing the full EXIF metadata extracted with exiftool.
-- Apply using: psql "$DATABASE_URL" -f backend/migrations/004_add_metadata_json.sql

ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS metadata_json JSONB NULL;
