import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "migrations",
  "004_phase8_5_production_hardening.sql"
);

test("phase 8.5 migration defines durable production persistence tables and RLS", () => {
  assert.equal(
    existsSync(migrationPath),
    true,
    `Missing migration file: ${migrationPath}`
  );

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
  ];

  for (const table of requiredTables) {
    assert.match(
      sql,
      new RegExp(`create\\s+table\\s+(if\\s+not\\s+exists\\s+)?${table}`, "i"),
      `Migration missing table definition: ${table}`
    );
  }

  const requiredSecurityControls = [
    "enable row level security",
    "create policy",
  ];

  for (const control of requiredSecurityControls) {
    assert.match(
      sql,
      new RegExp(control, "i"),
      `Migration missing security control: ${control}`
    );
  }
});8
