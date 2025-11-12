-- Adds JPEG+RAW pairing metadata plus persisted annotation fields.
-- Apply using: psql "$DATABASE_URL" -f backend/migrations/005_add_pairing_and_annotations.sql

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS stack_pairs_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS rating SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS color_label TEXT NOT NULL DEFAULT 'None',
    ADD COLUMN IF NOT EXISTS picked BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS rejected BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS project_asset_pairs (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    basename TEXT NOT NULL,
    jpeg_asset_id UUID NOT NULL UNIQUE REFERENCES assets(id) ON DELETE CASCADE,
    raw_asset_id UUID NOT NULL UNIQUE REFERENCES assets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_project_asset_pairs_project_basename UNIQUE (project_id, basename)
);

ALTER TABLE project_assets
    ADD COLUMN IF NOT EXISTS pair_id UUID NULL REFERENCES project_asset_pairs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS project_assets_pair_id_idx ON project_assets(pair_id);

CREATE OR REPLACE FUNCTION trg_project_asset_pairs_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_asset_pairs_updated_at ON project_asset_pairs;
CREATE TRIGGER trg_project_asset_pairs_updated_at
    BEFORE UPDATE ON project_asset_pairs
    FOR EACH ROW
    EXECUTE FUNCTION trg_project_asset_pairs_touch_updated_at();
