-- ============================================================
-- 002_knowledge_substrate.sql
-- Durable governed knowledge records and immutable versions.
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id    TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, project_id, id)
);

CREATE INDEX IF NOT EXISTS knowledge_records_tenant_project_idx
  ON knowledge_records(tenant_id, project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS knowledge_versions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id           UUID NOT NULL REFERENCES knowledge_records(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id          TEXT NOT NULL,
  version             INTEGER NOT NULL,
  candidate_id        TEXT NOT NULL,
  title               TEXT NOT NULL,
  url                 TEXT,
  content             TEXT,
  snippet             TEXT,
  confidence_score    DOUBLE PRECISION NOT NULL,
  provenance          JSONB NOT NULL,
  version_hash        TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (record_id, version),
  UNIQUE (tenant_id, project_id, version_hash)
);

CREATE INDEX IF NOT EXISTS knowledge_versions_scope_idx
  ON knowledge_versions(tenant_id, project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS knowledge_versions_record_idx
  ON knowledge_versions(record_id, version DESC);

CREATE OR REPLACE FUNCTION set_knowledge_record_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS knowledge_records_updated_at ON knowledge_records;
CREATE TRIGGER knowledge_records_updated_at
BEFORE UPDATE ON knowledge_records
FOR EACH ROW EXECUTE FUNCTION set_knowledge_record_updated_at();
