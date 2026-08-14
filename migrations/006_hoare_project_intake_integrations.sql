-- ============================================================
-- 006_hoare_project_intake_integrations.sql
-- Additive project intake foundation for HOARE + GitHub + PASOR + AEGIS.
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  source_type TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS github_project_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'github',
  repository_id BIGINT NOT NULL,
  owner_login TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  repository_full_name TEXT NOT NULL,
  default_branch TEXT,
  installation_id BIGINT,
  source_sha TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}',
  UNIQUE (tenant_id, repository_id)
);

CREATE TABLE IF NOT EXISTS project_pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('intake','pasor','aegis','hoare','deploy')),
  status TEXT NOT NULL CHECK (status IN ('queued','running','passed','failed','blocked')),
  request_id TEXT,
  artifact_ref TEXT,
  result JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_tenant_idx ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS github_project_sources_tenant_idx ON github_project_sources(tenant_id);
CREATE INDEX IF NOT EXISTS github_project_sources_project_idx ON github_project_sources(project_id);
CREATE INDEX IF NOT EXISTS project_pipeline_runs_tenant_idx ON project_pipeline_runs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS project_pipeline_runs_project_idx ON project_pipeline_runs(project_id, created_at DESC);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_project_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_pipeline_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'projects_tenant_isolation') THEN
    CREATE POLICY projects_tenant_isolation ON projects
      USING (coalesce(auth.jwt() ->> 'tenant_id', '') <> '' AND tenant_id::text = auth.jwt() ->> 'tenant_id')
      WITH CHECK (coalesce(auth.jwt() ->> 'tenant_id', '') <> '' AND tenant_id::text = auth.jwt() ->> 'tenant_id');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'github_project_sources' AND policyname = 'github_project_sources_tenant_isolation') THEN
    CREATE POLICY github_project_sources_tenant_isolation ON github_project_sources
      USING (coalesce(auth.jwt() ->> 'tenant_id', '') <> '' AND tenant_id::text = auth.jwt() ->> 'tenant_id')
      WITH CHECK (coalesce(auth.jwt() ->> 'tenant_id', '') <> '' AND tenant_id::text = auth.jwt() ->> 'tenant_id');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_pipeline_runs' AND policyname = 'project_pipeline_runs_tenant_isolation') THEN
    CREATE POLICY project_pipeline_runs_tenant_isolation ON project_pipeline_runs
      USING (coalesce(auth.jwt() ->> 'tenant_id', '') <> '' AND tenant_id::text = auth.jwt() ->> 'tenant_id')
      WITH CHECK (coalesce(auth.jwt() ->> 'tenant_id', '') <> '' AND tenant_id::text = auth.jwt() ->> 'tenant_id');
  END IF;
END $$;
