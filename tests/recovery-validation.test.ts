import test from "node:test";
import assert from "node:assert/strict";

import { failureInjector } from "../lib/testing/failure-injector";
import { recoveryValidator } from "../lib/testing/recovery-validator";

test("recovery validator computes recovery reports for DR validation", () => {
  const failure = failureInjector.inject("regional-service-failure", "tenant-1");
  const report = recoveryValidator.validate(failure, {
    detectionMs: 900,
    rollbackMs: 1800,
    verificationMs: 800,
  });

  assert.equal(report.recovered, true);
  assert.equal(report.recoveryTimeMs, 3500);
  assert.equal(report.reliabilityScore > 0, true);
});
