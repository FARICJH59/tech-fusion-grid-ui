import { test } from "node:test";
import assert from "node:assert/strict";
import { RuntimeSupervisor } from "./runtime-supervisor";

test("runtime supervisor deploys and stops an application", async () => {
  const supervisor = new RuntimeSupervisor();
  const command = process.execPath;
  const plan = {
    applicationId: "demo-app",
    root: "/tmp/demo-app",
    services: [
      { id: "demo-backend", command, args: ["-e", "setTimeout(() => {}, 5000)"] },
    ],
  };

  const deployed = supervisor.deploy(plan);
  assert.equal(deployed.applicationId, "demo-app");
  assert.equal(deployed.phase, "running");
  assert.equal(deployed.services.length, 1);

  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(supervisor.status("demo-app")?.services[0]?.state, "running");

  const stopped = supervisor.stop("demo-app");
  assert.equal(stopped?.phase, "stopped");
});
