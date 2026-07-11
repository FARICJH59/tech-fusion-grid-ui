-- Phase 8: Autonomous Cloud Control Plane

create table if not exists phase8_deployments (
  id text primary key,
  tenant_id text not null,
  service text not null,
  region text not null,
  status text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists phase8_cloud_action_events (
  id text primary key,
  tenant_id text not null,
  action_type text not null,
  resource text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists phase8_policy_decisions (
  id text primary key,
  tenant_id text not null,
  action_id text not null,
  decision text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists phase8_incidents (
  id text primary key,
  tenant_id text not null,
  service text not null,
  severity text not null,
  status text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table phase8_deployments enable row level security;
alter table phase8_cloud_action_events enable row level security;
alter table phase8_policy_decisions enable row level security;
alter table phase8_incidents enable row level security;
