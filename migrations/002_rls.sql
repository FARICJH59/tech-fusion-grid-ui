-- ============================================================
-- 002_rls.sql
-- Row Level Security policies for multi-tenant isolation.
--
-- IMPORTANT: These policies use `auth.jwt() ->> 'tenantId'` which resolves
-- the claim from the JWT passed to Supabase.  For this to work one of:
--
--   a) Configure your Supabase project JWT secret to match JWT_SECRET so
--      that API access tokens issued by lib/auth.ts are recognised, OR
--   b) Use Supabase Auth session tokens directly for client-side queries.
--
-- Server-side API routes use the service-role client (SUPABASE_SERVICE_ROLE_KEY)
-- which bypasses RLS by default.  The .eq("tenant_id", user.tenantId) filter
-- in each route provides the primary application-level tenant isolation.
-- These policies add defence-in-depth for direct database access.
-- ============================================================

-- ---------------------------------------------------------------------------
-- Enable RLS on all tenant-scoped tables
-- ---------------------------------------------------------------------------

ALTER TABLE telemetry          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_status      ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helper: extract tenant ID from the JWT passed to Supabase.
-- Falls back to NULL so policies fail closed when no JWT is present.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() ->> 'tenantId', '')::UUID;
$$;

-- ---------------------------------------------------------------------------
-- telemetry
-- ---------------------------------------------------------------------------

CREATE POLICY "telemetry_tenant_isolation"
  ON telemetry
  FOR ALL
  USING (tenant_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- audit_events
-- ---------------------------------------------------------------------------

CREATE POLICY "audit_events_tenant_isolation"
  ON audit_events
  FOR ALL
  USING (tenant_id = current_tenant_id());

-- Operators and admins may insert audit events for their own tenant.
CREATE POLICY "audit_events_insert"
  ON audit_events
  FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- devices
-- ---------------------------------------------------------------------------

CREATE POLICY "devices_tenant_isolation"
  ON devices
  FOR ALL
  USING (tenant_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- execution_history
-- ---------------------------------------------------------------------------

CREATE POLICY "execution_history_tenant_isolation"
  ON execution_history
  FOR ALL
  USING (tenant_id = current_tenant_id());

-- ---------------------------------------------------------------------------
-- health_status (read-only for authenticated tenants; service role writes)
-- ---------------------------------------------------------------------------

CREATE POLICY "health_status_read"
  ON health_status
  FOR SELECT
  USING (current_tenant_id() IS NOT NULL);
