import assert from "node:assert/strict";
import test from "node:test";
import { CloudflareEdgeProvider } from "@/lib/hoare/network/cloudflare-edge-provider";

const domain = { hostname: "api.example.com", zoneId: "zone-1" } as const;

function fakeRequest(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: "tenant-1",
    transactionId: "tx-1",
    attemptId: "attempt-1",
    recordId: "record-1",
    record: { type: "A", name: "api.example.com", content: "192.0.2.10" },
    authority: {} as never,
    ...overrides,
  };
}

test("Cloudflare provider requires an explicit credential provider", () => {
  assert.throws(
    () => new CloudflareEdgeProvider({ domain, tenantZoneBinding: new Map([["tenant-1", "zone-1"]]) }),
    /cloudflare_credential_provider_required/,
  );
});

test("tenant-to-zone binding is enforced before external mutation", async () => {
  let calls = 0;
  const provider = new CloudflareEdgeProvider({
    domain,
    token: "test-token",
    tenantZoneBinding: new Map([["tenant-1", "other-zone"]]),
    fetchImpl: (async () => {
      calls += 1;
      return new Response(null, { status: 200 });
    }) as typeof fetch,
  });

  await assert.rejects(() => provider.updateDnsRecord(fakeRequest() as never), /cloudflare_zone_tenant_binding_invalid/);
  assert.equal(calls, 0);
});

test("hostname binding is enforced before external mutation", async () => {
  let calls = 0;
  const provider = new CloudflareEdgeProvider({
    domain,
    token: "test-token",
    tenantZoneBinding: new Map([["tenant-1", "zone-1"]]),
    fetchImpl: (async () => {
      calls += 1;
      return new Response(null, { status: 200 });
    }) as typeof fetch,
  });

  await assert.rejects(
    () => provider.updateDnsRecord(fakeRequest({ record: { type: "A", name: "other.example.com", content: "192.0.2.10" } }) as never),
    /cloudflare_hostname_mismatch/,
  );
  assert.equal(calls, 0);
});

test("forged authority is rejected before the Cloudflare call", async () => {
  let calls = 0;
  const provider = new CloudflareEdgeProvider({
    domain,
    token: "test-token",
    tenantZoneBinding: new Map([["tenant-1", "zone-1"]]),
    fetchImpl: (async () => {
      calls += 1;
      return new Response(null, { status: 200 });
    }) as typeof fetch,
  });

  await assert.rejects(() => provider.updateDnsRecord(fakeRequest() as never));
  assert.equal(calls, 0);
});
