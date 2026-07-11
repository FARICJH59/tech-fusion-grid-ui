import test from "node:test";
import assert from "node:assert/strict";

import { DeploymentManager } from "../lib/cloud/deployment-manager";

test("deployment manager tracks lifecycle, events, and revision state", () => {
  const manager = new DeploymentManager();
  const deployment = manager.request({
    id: "dep-2",
    tenantId: "tenant-1",
    requestedBy: "user-1",
    service: "worker",
    region: "us-east1",
    targetImage: "img:v1",
  });

  manager.transition(deployment.id, "validated", "validated");
  manager.transition(deployment.id, "approved", "approved");
  manager.setRevision(deployment.id, "worker-r2");
  manager.transition(deployment.id, "completed", "done");

  const current = manager.get(deployment.id);
  assert.equal(current?.status, "completed");
  assert.equal(manager.listEvents(deployment.id).length >= 4, true);
  assert.deepEqual(manager.revisionState("tenant-1", "worker"), ["worker-r2"]);
});
