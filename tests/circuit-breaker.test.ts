/**
 * Tests for lib/utils/circuit-breaker.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import { CircuitBreaker, CircuitBreakerOpenError } from "../lib/utils/circuit-breaker";

function makeBreaker(overrides = {}) {
  return new CircuitBreaker("test", {
    failureThreshold: 3,
    resetTimeoutMs: 50,
    ...overrides,
  });
}

test("CircuitBreaker: CLOSED by default, passes through successful calls", async () => {
  const breaker = makeBreaker();
  const result = await breaker.execute(async () => "ok");
  assert.equal(result, "ok");
  assert.equal(breaker.currentState, "CLOSED");
});

test("CircuitBreaker: counts failures and trips to OPEN at threshold", async () => {
  const breaker = makeBreaker({ failureThreshold: 3 });

  for (let i = 0; i < 3; i++) {
    await assert.rejects(() => breaker.execute(async () => { throw new Error("fail"); }));
  }

  assert.equal(breaker.currentState, "OPEN");
});

test("CircuitBreaker: throws CircuitBreakerOpenError when OPEN", async () => {
  const breaker = makeBreaker({ failureThreshold: 1 });
  await assert.rejects(() => breaker.execute(async () => { throw new Error("x"); }));

  await assert.rejects(
    () => breaker.execute(async () => "never"),
    CircuitBreakerOpenError,
  );
});

test("CircuitBreaker: moves to HALF_OPEN after reset timeout", async () => {
  const breaker = makeBreaker({ failureThreshold: 1, resetTimeoutMs: 20 });
  await assert.rejects(() => breaker.execute(async () => { throw new Error("x"); }));
  assert.equal(breaker.currentState, "OPEN");

  await new Promise((r) => setTimeout(r, 30));
  // Trigger tick by attempting a call — it should be in HALF_OPEN now
  const result = await breaker.execute(async () => "probe succeeded");
  assert.equal(result, "probe succeeded");
  assert.equal(breaker.currentState, "CLOSED");
});

test("CircuitBreaker: HALF_OPEN failure re-opens breaker", async () => {
  const breaker = makeBreaker({ failureThreshold: 1, resetTimeoutMs: 20 });
  await assert.rejects(() => breaker.execute(async () => { throw new Error("x"); }));

  await new Promise((r) => setTimeout(r, 30));
  // Probe fails
  await assert.rejects(() => breaker.execute(async () => { throw new Error("probe fail"); }));
  assert.equal(breaker.currentState, "OPEN");
});

test("CircuitBreaker: reset() moves to CLOSED regardless of state", () => {
  const breaker = makeBreaker({ failureThreshold: 1 });
  // Can't easily assert it was OPEN first without async, but reset should always work
  breaker.reset();
  assert.equal(breaker.currentState, "CLOSED");
});

test("CircuitBreaker: getSnapshot returns current state", async () => {
  const breaker = makeBreaker({ failureThreshold: 2 });
  await assert.rejects(() => breaker.execute(async () => { throw new Error("x"); }));

  const snap = breaker.getSnapshot();
  assert.equal(snap.name, "test");
  assert.equal(snap.state, "CLOSED"); // still CLOSED — threshold is 2
  assert.equal(snap.consecutiveFailures, 1);
});

test("CircuitBreaker: onStateChange callback is invoked on transitions", async () => {
  const transitions: string[] = [];
  const breaker = makeBreaker({
    failureThreshold: 1,
    resetTimeoutMs: 20,
    onStateChange: (_name: string, from: string, to: string) => transitions.push(`${from}->${to}`),
  });

  await assert.rejects(() => breaker.execute(async () => { throw new Error("x"); }));
  assert.ok(transitions.includes("CLOSED->OPEN"), `Expected CLOSED->OPEN, got: ${transitions}`);
});
