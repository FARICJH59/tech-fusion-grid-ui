import { createClient } from "@supabase/supabase-js";
import { SupabaseBuilderPlanRepository } from "../lib/hoare/builder/plan-repository-supabase";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value?.slice(prefix.length);
}

const planId = arg("plan");
const tenantId = arg("tenant");
const environment = arg("environment") ?? "staging";

if (!planId || !tenantId) {
  console.error("Usage: pnpm hoare:build --plan=<PLAN_ID> --tenant=<TENANT_ID> [--environment=staging]");
  process.exit(2);
}

if (environment !== "staging") {
  console.error("This command currently permits staging only.");
  process.exit(2);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Supabase configuration is required; no deployment was attempted.");
  process.exit(3);
}

const repository = new SupabaseBuilderPlanRepository(createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
}));

const plan = await repository.get(planId, tenantId);
if (!plan) {
  console.error(`Plan ${planId} was not found for tenant ${tenantId}.`);
  process.exit(4);
}

if (plan.status !== "approved") {
  console.error(`Plan ${planId} is ${plan.status}; only approved plans may enter staging execution.`);
  process.exit(5);
}

console.log(JSON.stringify({ planId, tenantId, environment, status: "validated", operations: plan.operations.length }, null, 2));
console.log("Execution authority remains in the HOARE application composition root; this command performs validation only.");
