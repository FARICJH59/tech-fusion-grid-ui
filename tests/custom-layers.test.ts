import assert from "node:assert/strict";
import test from "node:test";
import { InMemorySearchSource, FusionSearch } from "../lib/fusion-search";
import { evaluatePolicy } from "../lib/aegis";
import { compileAegis, parseAegis } from "../lib/aegisc";
import { Sentinel } from "../lib/sentinel";
import { HoareCustomLayers } from "../lib/hoare/custom-layers";

const policy = {
  name: "test-policy",
  version: 1,
  rules: [
    { action: "read.documentation", effect: "ALLOW" as const, roles: ["operator"] },
    { action: "deploy.production", effect: "DENY" as const, roles: ["viewer"] },
  ],
};

test("Fusion Search performs ranked multi-source retrieval", async () => {
  const search = new FusionSearch([
    new InMemorySearchSource("docs", [{ id: "1", title: "HOARE Runtime", content: "agent runtime documentation", source: "docs" }]),
    new InMemorySearchSource("repo", [{ id: "2", title: "Sentinel", content: "runtime policy enforcement", source: "repo" }]),
  ]);
  const results = await search.search("runtime", { limit: 10 });
  assert.equal(results.length, 2);
  assert.equal(results[0].score, 1);
});

test("AEGIS evaluates authorization with deterministic default escalation", () => {
  assert.equal(evaluatePolicy(policy, { action: "read.documentation", role: "operator" }), "ALLOW");
  assert.equal(evaluatePolicy(policy, { action: "read.documentation", role: "viewer" }), "ESCALATE");
});

test("AEGISC validates and compiles policy into immutable IR", () => {
  const source = JSON.stringify(policy);
  const parsed = parseAegis(source);
  const ir = compileAegis(parsed);
  assert.equal(ir.name, "test-policy");
  assert.ok(ir.hash);
  assert.ok(Object.isFrozen(ir));
});

test("Sentinel enforces ALLOW and DENY decisions", () => {
  const sentinel = new Sentinel(policy);
  assert.equal(sentinel.evaluate({ action: "read.documentation", role: "operator" }).decision, "ALLOW");
  assert.equal(sentinel.evaluate({ action: "deploy.production", role: "viewer" }).decision, "DENY");
});

test("HOARE custom-layer boundary authorizes before execution", async () => {
  const hoare = new HoareCustomLayers(policy, []);
  const executed = await hoare.executeAuthorized({ action: "read.documentation", role: "operator" }, async () => "executed");
  assert.equal(executed.result, "executed");
  await assert.rejects(() => hoare.executeAuthorized({ action: "deploy.production", role: "viewer" }, async () => "should-not-run"));
});
