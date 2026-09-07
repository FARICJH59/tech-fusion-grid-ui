import test from "node:test";
import assert from "node:assert/strict";
import { backendUrl, createRuntimeServiceGraph, validateRuntimeServiceGraph } from "../lib/hoare/deployment/service-contract";

test("runtime service graph keeps backend private and exposes API through frontend", () => {
  const graph = createRuntimeServiceGraph("app-123");
  validateRuntimeServiceGraph(graph);

  assert.equal(graph.frontend.port, 3000);
  assert.equal(graph.backend.port, 8080);
  assert.equal(graph.backend.public, false);
  assert.equal(graph.apiPrefix, "/api");
  assert.equal(backendUrl(graph), "http://127.0.0.1:8080");
});

test("runtime service graph rejects a public backend", () => {
  const graph = createRuntimeServiceGraph("app-123");
  graph.backend.public = true;
  assert.throws(() => validateRuntimeServiceGraph(graph), /backend service must remain private/i);
});
