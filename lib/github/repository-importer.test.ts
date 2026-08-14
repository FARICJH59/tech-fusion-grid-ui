import assert from "node:assert/strict";
import test from "node:test";
import { importGitHubRepository } from "./repository-importer";

test("imports repository metadata without persisting GitHub credentials", async () => {
  let authorizationHeader = "";
  const result = await importGitHubRepository(
    {
      tenantId: "ten_0123456789abcdef0123456789abcdef",
      owner: "FARICJH59",
      repo: "example",
    },
    "short-lived-test-token",
    async (_input, init) => {
      authorizationHeader = String(new Headers(init?.headers).get("Authorization"));
      return new Response(
        JSON.stringify({
          id: 123,
          name: "example",
          private: true,
          default_branch: "main",
          clone_url: "https://github.com/FARICJH59/example.git",
        }),
        { status: 200 },
      );
    },
  );

  assert.equal(result.tenantId, "ten_0123456789abcdef0123456789abcdef");
  assert.equal(result.ref, "main");
  assert.equal(result.private, true);
  assert.equal(result.provenanceHash.length, 64);
  assert.doesNotMatch(JSON.stringify(result), /short-lived-test-token/);
  assert.equal(authorizationHeader, "Bearer short-lived-test-token");
});

test("rejects non-HOARE tenant identifiers", async () => {
  await assert.rejects(
    () => importGitHubRepository({ tenantId: "user-id", owner: "a", repo: "b" }, "token"),
    /Invalid public tenant ID/,
  );
});
