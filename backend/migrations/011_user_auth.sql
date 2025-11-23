-- User accounts and per-record ownership.
-- Apply using: psql "$DATABASE_URL" -f backend/migrations/011_user_auth.sql

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO users (id, email, password_hash)
VALUES ('00000000-0000-0000-0000-000000000001', 'dev@arciva.local', 'argon2id$v=19$m=65536,t=3,p=4$devplaceholder$invalid')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id UUID;
UPDATE projects SET user_id = COALESCE(user_id, '00000000-0000-0000-0000-000000000001');
ALTER TABLE projects ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE projects ADD CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

ALTER TABLE project_assets ADD COLUMN IF NOT EXISTS user_id UUID;
UPDATE project_assets pa
SET user_id = p.user_id
FROM projects p
WHERE pa.project_id = p.id
  AND pa.user_id IS NULL;
UPDATE project_assets SET user_id = COALESCE(user_id, '00000000-0000-0000-0000-000000000001');
ALTER TABLE project_assets ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE project_assets ADD CONSTRAINT fk_project_assets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_project_assets_user ON project_assets(user_id);

ALTER TABLE assets ADD COLUMN IF NOT EXISTS user_id UUID;
WITH asset_users AS (
    SELECT DISTINCT ON (pa.asset_id) pa.asset_id, pa.user_id
    FROM project_assets pa
    WHERE pa.user_id IS NOT NULL
    ORDER BY pa.asset_id, pa.added_at DESC
)
UPDATE assets a
SET user_id = au.user_id
FROM asset_users au
WHERE a.id = au.asset_id
  AND a.user_id IS NULL;
UPDATE assets SET user_id = COALESCE(user_id, '00000000-0000-0000-0000-000000000001');
ALTER TABLE assets ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE assets ADD CONSTRAINT fk_assets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_id);

ALTER TABLE export_jobs ADD COLUMN IF NOT EXISTS user_id UUID;
UPDATE export_jobs ej
SET user_id = p.user_id
FROM projects p
WHERE ej.project_id = p.id
  AND ej.user_id IS NULL;
UPDATE export_jobs SET user_id = COALESCE(user_id, '00000000-0000-0000-0000-000000000001');
ALTER TABLE export_jobs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE export_jobs ADD CONSTRAINT fk_export_jobs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_export_jobs_user ON export_jobs(user_id);

ALTER TABLE bulk_image_exports ADD COLUMN IF NOT EXISTS user_id UUID;
UPDATE bulk_image_exports SET user_id = COALESCE(user_id, '00000000-0000-0000-0000-000000000001');
ALTER TABLE bulk_image_exports ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE bulk_image_exports ADD CONSTRAINT fk_bulk_image_exports_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_bulk_image_exports_user ON bulk_image_exports(user_id);
