-- ============================================================
-- 005_phase9_account_billing_foundation.sql
-- Phase 9 additive account-first SaaS schema foundation
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  owner_id    UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug),
  UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id              UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  provider                  TEXT NOT NULL DEFAULT 'stripe',
  provider_customer_id      TEXT,
  provider_subscription_id  TEXT UNIQUE,
  plan_tier                 TEXT NOT NULL DEFAULT 'free',
  status                    TEXT NOT NULL DEFAULT 'active',
  current_period_start      TIMESTAMPTZ,
  current_period_end        TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id    UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  provider_invoice_id TEXT,
  currency           TEXT NOT NULL DEFAULT 'usd',
  amount_due_cents   BIGINT NOT NULL DEFAULT 0,
  amount_paid_cents  BIGINT NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'open',
  issued_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at            TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  type        TEXT NOT NULL CHECK (type IN ('purchase', 'grant', 'consume', 'reconcile')),
  amount      INTEGER NOT NULL CHECK (amount >= 0),
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_records (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  metric_key     TEXT NOT NULL,
  quantity       NUMERIC NOT NULL DEFAULT 0,
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata       JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS agent_registry (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  agent_key      TEXT NOT NULL,
  display_name   TEXT NOT NULL,
  runtime        TEXT NOT NULL,
  version        TEXT NOT NULL DEFAULT 'v1',
  status         TEXT NOT NULL DEFAULT 'active',
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, agent_key)
);

CREATE TABLE IF NOT EXISTS deployment_history_v2 (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  deployment_id  UUID REFERENCES deployments(id) ON DELETE SET NULL,
  destination    TEXT NOT NULL,
  version        TEXT NOT NULL,
  status         TEXT NOT NULL,
  cost_cents     BIGINT NOT NULL DEFAULT 0,
  deployed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata       JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS cost_analytics_daily (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id     UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  usage_date       DATE NOT NULL,
  provider         TEXT NOT NULL,
  total_cost_cents BIGINT NOT NULL DEFAULT 0,
  tokens_input     BIGINT NOT NULL DEFAULT 0,
  tokens_output    BIGINT NOT NULL DEFAULT 0,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, workspace_id, usage_date, provider)
);

CREATE INDEX IF NOT EXISTS workspaces_org_idx ON workspaces(organization_id);
CREATE INDEX IF NOT EXISTS subscriptions_tenant_idx ON subscriptions(tenant_id, status);
CREATE INDEX IF NOT EXISTS invoices_tenant_idx ON invoices(tenant_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS credit_ledger_tenant_idx ON credit_ledger(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_records_tenant_metric_idx ON usage_records(tenant_id, metric_key, recorded_at DESC);
CREATE INDEX IF NOT EXISTS agent_registry_tenant_idx ON agent_registry(tenant_id, status);
CREATE INDEX IF NOT EXISTS deployment_history_v2_tenant_idx ON deployment_history_v2(tenant_id, deployed_at DESC);
CREATE INDEX IF NOT EXISTS cost_analytics_tenant_date_idx ON cost_analytics_daily(tenant_id, usage_date DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'phase85_set_updated_at') THEN
    EXECUTE 'CREATE OR REPLACE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION phase85_set_updated_at()';
    EXECUTE 'CREATE OR REPLACE TRIGGER workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION phase85_set_updated_at()';
    EXECUTE 'CREATE OR REPLACE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION phase85_set_updated_at()';
    EXECUTE 'CREATE OR REPLACE TRIGGER agent_registry_updated_at BEFORE UPDATE ON agent_registry FOR EACH ROW EXECUTE FUNCTION phase85_set_updated_at()';
  ELSE
    EXECUTE 'CREATE OR REPLACE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
    EXECUTE 'CREATE OR REPLACE TRIGGER workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
    EXECUTE 'CREATE OR REPLACE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
    EXECUTE 'CREATE OR REPLACE TRIGGER agent_registry_updated_at BEFORE UPDATE ON agent_registry FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  END IF;
END $$;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_history_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_analytics_daily ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'workspaces' AND policyname = 'workspaces_tenant_isolation'
  ) THEN
    CREATE POLICY workspaces_tenant_isolation ON workspaces
      USING (tenant_id::text = auth.jwt() ->> 'tenant_id')
      WITH CHECK (tenant_id::text = auth.jwt() ->> 'tenant_id');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'subscriptions_tenant_isolation'
  ) THEN
    CREATE POLICY subscriptions_tenant_isolation ON subscriptions
      USING (tenant_id::text = auth.jwt() ->> 'tenant_id')
      WITH CHECK (tenant_id::text = auth.jwt() ->> 'tenant_id');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'invoices_tenant_isolation'
  ) THEN
    CREATE POLICY invoices_tenant_isolation ON invoices
      USING (tenant_id::text = auth.jwt() ->> 'tenant_id')
      WITH CHECK (tenant_id::text = auth.jwt() ->> 'tenant_id');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'credit_ledger' AND policyname = 'credit_ledger_tenant_isolation'
  ) THEN
    CREATE POLICY credit_ledger_tenant_isolation ON credit_ledger
      USING (tenant_id::text = auth.jwt() ->> 'tenant_id')
      WITH CHECK (tenant_id::text = auth.jwt() ->> 'tenant_id');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'usage_records' AND policyname = 'usage_records_tenant_isolation'
  ) THEN
    CREATE POLICY usage_records_tenant_isolation ON usage_records
      USING (tenant_id::text = auth.jwt() ->> 'tenant_id')
      WITH CHECK (tenant_id::text = auth.jwt() ->> 'tenant_id');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agent_registry' AND policyname = 'agent_registry_tenant_isolation'
  ) THEN
    CREATE POLICY agent_registry_tenant_isolation ON agent_registry
      USING (tenant_id::text = auth.jwt() ->> 'tenant_id')
      WITH CHECK (tenant_id::text = auth.jwt() ->> 'tenant_id');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'deployment_history_v2' AND policyname = 'deployment_history_v2_tenant_isolation'
  ) THEN
    CREATE POLICY deployment_history_v2_tenant_isolation ON deployment_history_v2
      USING (tenant_id::text = auth.jwt() ->> 'tenant_id')
      WITH CHECK (tenant_id::text = auth.jwt() ->> 'tenant_id');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cost_analytics_daily' AND policyname = 'cost_analytics_daily_tenant_isolation'
  ) THEN
    CREATE POLICY cost_analytics_daily_tenant_isolation ON cost_analytics_daily
      USING (tenant_id::text = auth.jwt() ->> 'tenant_id')
      WITH CHECK (tenant_id::text = auth.jwt() ->> 'tenant_id');
  END IF;
END $$;
