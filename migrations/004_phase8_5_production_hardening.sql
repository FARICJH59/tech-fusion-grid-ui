-- Phase 8.5: Production Hardening and Autonomous Control Validation

create table if not exists cloud_actions (
  id text primary key,
  tenant_id text not null,
  organization_id text not null,
  deployment_id text,
  action_type text not null,
  resource text not null,
  impact text,
  risk_level text not null,
  ai_recommendation text,
  approval_status text not null default 'pending',
  execution_status text not null default 'requested',
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cloud_actions_deployment_fk foreign key (deployment_id) references deployments(id) on delete set null
);

create table if not exists deployments (
  id text primary key,
  tenant_id text not null,
  organization_id text not null,
  service text not null,
  region text not null,
  status text not null,
  target_image text,
  previous_revision text,
  next_revision text,
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists deployment_events (
  id text primary key,
  deployment_id text not null references deployments(id) on delete cascade,
  tenant_id text not null,
  organization_id text not null,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists approval_requests (
  id text primary key,
  tenant_id text not null,
  organization_id text not null,
  action_id text not null references cloud_actions(id) on delete cascade,
  status text not null,
  requested_by text not null,
  approved_by text,
  reason text,
  delegation_chain jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists policies (
  id text primary key,
  tenant_id text not null,
  organization_id text not null,
  policy_type text not null,
  scope text not null,
  active_version integer not null default 1,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists policy_versions (
  id text primary key,
  policy_id text not null references policies(id) on delete cascade,
  tenant_id text not null,
  organization_id text not null,
  version integer not null,
  definition jsonb not null,
  change_summary text,
  approved_by text,
  approved_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  unique (policy_id, version)
);

create table if not exists incidents (
  id text primary key,
  tenant_id text not null,
  organization_id text not null,
  service text not null,
  severity text not null,
  status text not null,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists incident_timeline (
  id text primary key,
  incident_id text not null references incidents(id) on delete cascade,
  tenant_id text not null,
  organization_id text not null,
  stage text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists slo_definitions (
  id text primary key,
  tenant_id text not null,
  organization_id text not null,
  service text not null,
  availability_target numeric not null,
  latency_target_ms integer not null,
  error_rate_target numeric not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, organization_id, service)
);

create table if not exists slo_events (
  id text primary key,
  slo_definition_id text not null references slo_definitions(id) on delete cascade,
  tenant_id text not null,
  organization_id text not null,
  event_type text not null,
  reliability_score numeric not null,
  breached boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists dr_events (
  id text primary key,
  tenant_id text not null,
  organization_id text not null,
  scenario text not null,
  phase text not null,
  status text not null,
  recovery_time_ms integer,
  reliability_score numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists secret_access_logs (
  id text primary key,
  tenant_id text not null,
  organization_id text not null,
  secret_name text not null,
  provider text not null,
  actor_id text not null,
  actor_role text not null,
  action text not null,
  granted boolean not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_cloud_actions_tenant_org_created
  on cloud_actions (tenant_id, organization_id, created_at desc);
create index if not exists idx_deployments_tenant_org_service
  on deployments (tenant_id, organization_id, service, updated_at desc);
create index if not exists idx_deployment_events_deployment_created
  on deployment_events (deployment_id, created_at desc);
create index if not exists idx_approval_requests_action_status
  on approval_requests (action_id, status, updated_at desc);
create index if not exists idx_policies_tenant_org_type
  on policies (tenant_id, organization_id, policy_type, updated_at desc);
create index if not exists idx_policy_versions_policy_version
  on policy_versions (policy_id, version desc);
create index if not exists idx_incidents_tenant_org_status
  on incidents (tenant_id, organization_id, status, updated_at desc);
create index if not exists idx_incident_timeline_incident_created
  on incident_timeline (incident_id, created_at desc);
create index if not exists idx_slo_definitions_tenant_org
  on slo_definitions (tenant_id, organization_id, service);
create index if not exists idx_slo_events_definition_created
  on slo_events (slo_definition_id, created_at desc);
create index if not exists idx_dr_events_tenant_org_created
  on dr_events (tenant_id, organization_id, created_at desc);
create index if not exists idx_secret_access_logs_tenant_org_created
  on secret_access_logs (tenant_id, organization_id, created_at desc);

create or replace function phase85_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['cloud_actions', 'deployments', 'approval_requests', 'policies', 'incidents', 'slo_definitions'] loop
    execute format(
      'create or replace trigger %I_updated_at before update on %I for each row execute function phase85_set_updated_at()',
      tbl,
      tbl
    );
  end loop;
end;
$$;

create or replace function phase85_rls_allowed_role() returns boolean language sql stable as $$
  select coalesce(current_setting('request.jwt.claim.role', true), '') in ('admin', 'operator', 'security-admin', 'service');
$$;

create or replace function phase85_rls_tenant_org_match(tenant text, org text) returns boolean language sql stable as $$
  select
    coalesce(current_setting('request.jwt.claim.tenant_id', true), '') = tenant
    and coalesce(current_setting('request.jwt.claim.organization_id', true), '') = org;
$$;

alter table cloud_actions enable row level security;
alter table deployments enable row level security;
alter table deployment_events enable row level security;
alter table approval_requests enable row level security;
alter table policies enable row level security;
alter table policy_versions enable row level security;
alter table incidents enable row level security;
alter table incident_timeline enable row level security;
alter table slo_definitions enable row level security;
alter table slo_events enable row level security;
alter table dr_events enable row level security;
alter table secret_access_logs enable row level security;

alter table cloud_actions force row level security;
alter table deployments force row level security;
alter table deployment_events force row level security;
alter table approval_requests force row level security;
alter table policies force row level security;
alter table policy_versions force row level security;
alter table incidents force row level security;
alter table incident_timeline force row level security;
alter table slo_definitions force row level security;
alter table slo_events force row level security;
alter table dr_events force row level security;
alter table secret_access_logs force row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'cloud_actions','deployments','deployment_events','approval_requests','policies','policy_versions',
    'incidents','incident_timeline','slo_definitions','slo_events','dr_events','secret_access_logs'
  ] loop
    execute format('drop policy if exists %I_select on %I', tbl, tbl);
    execute format('drop policy if exists %I_insert on %I', tbl, tbl);
    execute format('drop policy if exists %I_update on %I', tbl, tbl);
    execute format('drop policy if exists %I_delete on %I', tbl, tbl);

    execute format(
      'create policy %I_select on %I for select using (phase85_rls_allowed_role() and phase85_rls_tenant_org_match(tenant_id, organization_id))',
      tbl,
      tbl
    );
    execute format(
      'create policy %I_insert on %I for insert with check (phase85_rls_allowed_role() and phase85_rls_tenant_org_match(tenant_id, organization_id))',
      tbl,
      tbl
    );
    execute format(
      'create policy %I_update on %I for update using (phase85_rls_allowed_role() and phase85_rls_tenant_org_match(tenant_id, organization_id)) with check (phase85_rls_allowed_role() and phase85_rls_tenant_org_match(tenant_id, organization_id))',
      tbl,
      tbl
    );
    execute format(
      'create policy %I_delete on %I for delete using (phase85_rls_allowed_role() and phase85_rls_tenant_org_match(tenant_id, organization_id))',
      tbl,
      tbl
    );
  end loop;
end;
$$;
