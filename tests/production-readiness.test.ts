import test from "node:test";
import assert from "node:assert/strict";
import { generateProductionReadinessReport } from "../lib/production-readiness";

test("production readiness framework fails closed when production identity is not configured", async () => {
  const names = [
    "GOOGLE_CLOUD_PROJECT_ID",
    "GOOGLE_CLOUD_REGION",
    "GOOGLE_CLOUD_WIF_PROVIDER",
    "GOOGLE_CLOUD_WIF_SERVICE_ACCOUNT",
  ] as const;
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) delete process.env[name];
  try {
    const report = await generateProductionReadinessReport();
    assert.equal(report.googleCloud.cloudRun, false);
    assert.equal(report.googleCloud.iam, false);
  } finally {
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
});
