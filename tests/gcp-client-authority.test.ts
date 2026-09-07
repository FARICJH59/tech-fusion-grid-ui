import test from "node:test";
import assert from "node:assert/strict";

// The client constructor validates WIF configuration even when injected test
// clients are used. These are non-secret test identifiers, not credentials.
process.env.GOOGLE_CLOUD_PROJECT_ID = "test-project";
process.env.GOOGLE_CLOUD_REGION = "us-central1";
process.env.GOOGLE_CLOUD_WIF_PROVIDER = "projects/test/locations/global/workloadIdentityPools/test/providers/test";
process.env.GOOGLE_CLOUD_WIF_SERVICE_ACCOUNT = "test-sa@example.invalid";

test("GcpCloudClient deployService fails closed without TCX authority before SDK mutation", async () => {
  const { GcpCloudClient } = await import("../lib/cloud/gcp-client");
  let createCalls = 0;
  const client = new GcpCloudClient({
    projectId: "test-project",
    region: "us-central1",
    clients: {
      run: {
        createService: async () => {
          createCalls += 1;
        },
      },
      monitoring: null,
      logging: null,
    },
  });

  await assert.rejects(
    client.deployService(
      {
        service: "api",
        image: "gcr.io/test/api:v1",
        region: "us-central1",
        projectId: "test-project",
      },
      undefined as never,
    ),
    /tcx_execution_authority_not_issuer_created/,
  );
  assert.equal(createCalls, 0);
});

test("GcpCloudClient updateTraffic fails closed without TCX authority before SDK mutation", async () => {
  const { GcpCloudClient } = await import("../lib/cloud/gcp-client");
  let updateCalls = 0;
  const client = new GcpCloudClient({
    projectId: "test-project",
    region: "us-central1",
    clients: {
      run: {
        updateService: async () => {
          updateCalls += 1;
        },
      },
      monitoring: null,
      logging: null,
    },
  });

  await assert.rejects(
    client.updateTraffic(
      "api",
      "us-central1",
      [{ revision: "api-r1", percent: 100 }],
      undefined as never,
    ),
    /tcx_execution_authority_not_issuer_created/,
  );
  assert.equal(updateCalls, 0);
});
