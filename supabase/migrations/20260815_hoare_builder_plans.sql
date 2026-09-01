create table if not exists public.hoare_builder_plans (
  id text primary key,
  tenant_id text not null,
  status text not null,
  plan jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hoare_builder_plans_tenant_idx
  on public.hoare_builder_plans (tenant_id, updated_at desc);

alter table public.hoare_builder_plans enable row level security;

-- Application/service-role access is intentionally separate from tenant-facing policy.
-- Add tenant claims/RLS policies at deployment composition time once the project's
-- canonical tenant claim is confirmed; do not infer tenant identity from request data.
