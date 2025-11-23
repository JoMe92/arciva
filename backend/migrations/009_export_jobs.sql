-- Export jobs table and metadata.
-- Apply using: psql "$DATABASE_URL" -f backend/migrations/009_export_jobs.sql

CREATE TABLE IF NOT EXISTS export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    photo_ids JSONB NOT NULL,
    settings JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    progress INTEGER NOT NULL DEFAULT 0,
    total_photos INTEGER NOT NULL DEFAULT 0,
    exported_files INTEGER NOT NULL DEFAULT 0,
    artifact_path TEXT,
    artifact_filename TEXT,
    artifact_size BIGINT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    CONSTRAINT export_jobs_status_check CHECK (
        status IN ('queued','running','completed','failed','cancelled')
    )
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_project ON export_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);
