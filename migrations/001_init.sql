-- ============================================================
-- 001_init.sql
-- Initial schema: tenants, users, devices, telemetry,
-- audit_events, execution_history, health_status
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('admin', 'operator', 'viewer', 'service');

CREATE TABLE IF NOT EXISTS users (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email        TEXT        NOT NULL UNIQUE,
  role         user_role   NOT NULL DEFAULT 'viewer',
  display_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_tenant_id_idx ON users(tenant_id);

-- ---------------------------------------------------------------------------
-- Devices
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_key   TEXT        NOT NULL,
  display_name TEXT,
  device_type  TEXT        NOT NULL DEFAULT 'inverter',
  mqtt_topic   TEXT,
  last_seen_at TIMESTAMPTZ,
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, device_key)
);

CREATE INDEX IF NOT EXISTS devices_tenant_id_idx ON devices(tenant_id);

-- ---------------------------------------------------------------------------
-- Telemetry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS telemetry (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id   UUID        NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  payload     JSONB       NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partition-friendly index: most queries filter by tenant and look back in time
CREATE INDEX IF NOT EXISTS telemetry_tenant_received_idx ON telemetry(tenant_id, received_at DESC);
CREATE INDEX IF NOT EXISTS telemetry_device_received_idx ON telemetry(device_id, received_at DESC);

-- Auto-expire rows older than 30 days (requires pg_partman or a cron job in
-- production; this index assists the manual purge query).
CREATE INDEX IF NOT EXISTS telemetry_received_at_idx ON telemetry(received_at);

-- ---------------------------------------------------------------------------
-- Audit events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  details     TEXT        NOT NULL DEFAULT '',
  metadata    JSONB       NOT NULL DEFAULT '{}',
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_tenant_ts_idx ON audit_events(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS audit_events_actor_idx     ON audit_events(actor_id);

-- ---------------------------------------------------------------------------
-- Execution history
-- ---------------------------------------------------------------------------
CREATE TYPE execution_status AS ENUM ('queued', 'running', 'succeeded', 'failed', 'cancelled');

CREATE TABLE IF NOT EXISTS execution_history (
  id           UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID             NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  initiated_by UUID             REFERENCES users(id) ON DELETE SET NULL,
  workflow     TEXT             NOT NULL,
  status       execution_status NOT NULL DEFAULT 'queued',
  input        JSONB            NOT NULL DEFAULT '{}',
  output       JSONB,
  error        TEXT,
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exec_history_tenant_idx  ON execution_history(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS exec_history_status_idx  ON execution_history(status);

-- ---------------------------------------------------------------------------
-- Health status
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_status (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT        NOT NULL,
  status       TEXT        NOT NULL, -- 'ok' | 'degraded' | 'down'
  details      JSONB       NOT NULL DEFAULT '{}',
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS health_status_service_idx ON health_status(service_name, recorded_at DESC);

-- ---------------------------------------------------------------------------
-- Utility: updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['tenants', 'users', 'devices'] LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER %I_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;
