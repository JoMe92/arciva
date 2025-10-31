-- Add preview flag and ordering to project assets
ALTER TABLE project_assets
    ADD COLUMN IF NOT EXISTS is_preview BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS preview_order INTEGER;

-- Backfill existing rows to ensure consistent ordering
WITH ranked AS (
    SELECT
        project_id,
        asset_id,
        ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY added_at DESC) - 1 AS rn
    FROM project_assets
    WHERE is_preview = TRUE
)
UPDATE project_assets pa
SET preview_order = ranked.rn
FROM ranked
WHERE pa.project_id = ranked.project_id
  AND pa.asset_id = ranked.asset_id;

