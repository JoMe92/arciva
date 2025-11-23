-- Image Hub schema upgrade: global asset metadata + per-project state.
-- Apply using: psql "$DATABASE_URL" -f backend/migrations/006_image_hub.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Assets: rename storage column and add normalized format + pixel signature data.
ALTER TABLE assets RENAME COLUMN storage_key TO storage_uri;

ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS format TEXT,
    ADD COLUMN IF NOT EXISTS pixel_format TEXT,
    ADD COLUMN IF NOT EXISTS pixel_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_pixel_signature
    ON assets(pixel_format, pixel_hash)
    WHERE pixel_hash IS NOT NULL;

-- Project links now get stable IDs and timestamps.
ALTER TABLE project_assets
    ADD COLUMN IF NOT EXISTS link_id UUID,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE project_assets
SET link_id = gen_random_uuid()
WHERE link_id IS NULL;

ALTER TABLE project_assets
    ALTER COLUMN link_id SET NOT NULL,
    ALTER COLUMN link_id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN added_at SET DEFAULT NOW();

ALTER TABLE project_assets
    DROP CONSTRAINT IF EXISTS project_assets_pkey;

ALTER TABLE project_assets
    ADD CONSTRAINT project_assets_pkey PRIMARY KEY (link_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_assets_project_asset
    ON project_assets(project_id, asset_id);

-- Metadata state per project link.
CREATE TABLE IF NOT EXISTS asset_metadata_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID NOT NULL UNIQUE REFERENCES project_assets(link_id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL DEFAULT 0,
    color_label TEXT NOT NULL DEFAULT 'None',
    picked BOOLEAN NOT NULL DEFAULT FALSE,
    rejected BOOLEAN NOT NULL DEFAULT FALSE,
    edits JSONB,
    source_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION trg_asset_metadata_states_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_asset_metadata_states_updated_at ON asset_metadata_states;
CREATE TRIGGER trg_asset_metadata_states_updated_at
    BEFORE UPDATE ON asset_metadata_states
    FOR EACH ROW
    EXECUTE FUNCTION trg_asset_metadata_states_touch_updated_at();

INSERT INTO asset_metadata_states (id, link_id, rating, color_label, picked, rejected, created_at, updated_at)
SELECT gen_random_uuid(),
       pa.link_id,
        COALESCE(a.rating, 0),
        COALESCE(a.color_label::text, 'None'),
        COALESCE(a.picked, FALSE),
        COALESCE(a.rejected, FALSE),
        COALESCE(pa.added_at, NOW()),
        COALESCE(pa.added_at, NOW())
FROM project_assets pa
JOIN assets a ON a.id = pa.asset_id
ON CONFLICT (link_id) DO NOTHING;

-- Cleanup legacy columns now that metadata lives per link.
ALTER TABLE assets
    DROP COLUMN IF EXISTS rating,
    DROP COLUMN IF EXISTS color_label,
    DROP COLUMN IF EXISTS picked,
    DROP COLUMN IF EXISTS rejected;

-- Ensure project_assets.updated_at auto-updates.
CREATE OR REPLACE FUNCTION trg_project_assets_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_assets_updated_at ON project_assets;
CREATE TRIGGER trg_project_assets_updated_at
    BEFORE UPDATE ON project_assets
    FOR EACH ROW
    EXECUTE FUNCTION trg_project_assets_touch_updated_at();

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
