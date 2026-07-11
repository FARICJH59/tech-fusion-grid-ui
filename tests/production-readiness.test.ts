import test from "node:test";
import assert from "node:assert/strict";

import { generateProductionReadinessReport } from "../lib/production-readiness";

test("production readiness framework validates cloud, supabase, redis, and emqx controls", async () => {
  const report = await generateProductionReadinessReport();

  assert.equal(report.googleCloud.cloudRun, true);
  assert.equal(report.googleCloud.iam, true);
  assert.equal(report.supabase.migrations, true);
  assert.equal(report.supabase.rls, true);
  assert.equal(report.redis.persistence, true);
  assert.equal(report.emqx.tls, true);
});
