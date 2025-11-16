-- Bulk image export jobs for the "download all images" feature.
-- Apply using: psql "$DATABASE_URL" -f backend/migrations/010_bulk_image_exports.sql

CREATE TABLE IF NOT EXISTS bulk_image_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_ids JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    progress INTEGER NOT NULL DEFAULT 0,
    processed_files INTEGER NOT NULL DEFAULT 0,
    total_files INTEGER NOT NULL DEFAULT 0,
    artifact_path TEXT,
    artifact_filename TEXT,
    artifact_size BIGINT,
    date_basis TEXT NOT NULL DEFAULT 'capture-date',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    CONSTRAINT bulk_image_exports_status_check CHECK (
        status IN ('queued','running','completed','failed','cancelled')
    )
);

CREATE INDEX IF NOT EXISTS idx_bulk_image_exports_status ON bulk_image_exports(status);
