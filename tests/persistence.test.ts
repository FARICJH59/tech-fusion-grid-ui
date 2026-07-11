import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migrationPath = "/home/runner/work/tech-fusion-grid-ui/tech-fusion-grid-ui/migrations/004_phase8_5_production_hardening.sql";

test("phase 8.5 migration defines durable production persistence tables and RLS", () => {
  const sql = readFileSync(migrationPath, "utf8");

  const requiredTables = [
    "cloud_actions",
    "deployments",
    "deployment_events",
    "approval_requests",
    "policies",
    "policy_versions",
    "incidents",
    "incident_timeline",
    "slo_definitions",
    "slo_events",
    "dr_events",
    "secret_access_logs",
  ];

  for (const table of requiredTables) {
    assert.match(sql, new RegExp(`create table if not exists ${table}`));
    assert.match(sql, new RegExp(`alter table ${table} enable row level security`));
  }

  assert.match(sql, /create index if not exists idx_cloud_actions_tenant_org_created/);
  assert.match(sql, /foreign key \(deployment_id\) references deployments\(id\)/);
  assert.match(sql, /phase85_rls_tenant_org_match/);
});
