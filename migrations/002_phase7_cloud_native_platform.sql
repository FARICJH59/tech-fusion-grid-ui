-- Phase 7: Cloud Native Enterprise Platform
-- Durable runtime state + policy + operations tables

create table if not exists phase7_organizations (
  id text primary key,
  tenant_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists phase7_tenants (
  id text primary key,
  tenant_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists phase7_agents (
  id text primary key,
  tenant_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists phase7_workflows (
  id text primary key,
  tenant_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists phase7_incidents (
  id text primary key,
  tenant_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists phase7_fleet (
  id text primary key,
  tenant_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists phase7_deployments (
  id text primary key,
  tenant_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists phase7_policies (
  id text primary key,
  tenant_id text not null,
  policy_type text not null check (policy_type in ('tenant', 'deployment', 'runtime', 'remediation')),
  version integer not null check (version > 0),
  content jsonb not null default '{}'::jsonb,
  approval_required boolean not null default true,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_phase7_policies_tenant_type_version
  on phase7_policies (tenant_id, policy_type, version desc);

alter table phase7_organizations enable row level security;
alter table phase7_tenants enable row level security;
alter table phase7_agents enable row level security;
alter table phase7_workflows enable row level security;
alter table phase7_incidents enable row level security;
alter table phase7_fleet enable row level security;
alter table phase7_deployments enable row level security;
alter table phase7_policies enable row level security;
