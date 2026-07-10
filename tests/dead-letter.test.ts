/**
 * Tests for lib/utils/dead-letter.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Test: Redis not configured → warns and returns without throwing
// ---------------------------------------------------------------------------

test("dead-letter: no Redis configured — returns without throwing", async () => {
  delete process.env.REDIS_URL;

  const { deadLetter } = await import("../lib/utils/dead-letter");

  let warnMessage = "";
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnMessage = String(args[0]);
  };

  await assert.doesNotReject(() =>
    deadLetter({
      queue: "test-queue",
      tenantId: "tenant-a",
      payload: { id: 1 },
      error: new Error("processing failed"),
      source: "test",
    }),
  );

  assert.match(warnMessage, /discarded/);
  console.warn = originalWarn;
});

// ---------------------------------------------------------------------------
// Test: readDeadLetters with no Redis returns empty array
// ---------------------------------------------------------------------------

test("dead-letter: readDeadLetters returns empty array when Redis absent", async () => {
  delete process.env.REDIS_URL;

  const { readDeadLetters } = await import("../lib/utils/dead-letter");
  const result = await readDeadLetters("test-queue", "tenant-a");
  assert.deepEqual(result, []);
});

// ---------------------------------------------------------------------------
// Test: purgeDeadLetters with no Redis resolves without throwing
// ---------------------------------------------------------------------------

test("dead-letter: purgeDeadLetters resolves without throwing when Redis absent", async () => {
  delete process.env.REDIS_URL;

  const { purgeDeadLetters } = await import("../lib/utils/dead-letter");
  await assert.doesNotReject(() => purgeDeadLetters("test-queue", "tenant-a"));
});

// ---------------------------------------------------------------------------
// Test: non-Error errors are stringified in warn message
// ---------------------------------------------------------------------------

test("dead-letter: non-Error errors are stringified cleanly", async () => {
  delete process.env.REDIS_URL;

  const { deadLetter } = await import("../lib/utils/dead-letter");

  const messages: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    messages.push(String(args[0]));
  };

  await deadLetter({
    queue: "test-queue",
    tenantId: "tenant-a",
    payload: { value: 42 },
    error: "string error",
    source: "test",
  });

  assert.ok(messages.length > 0, "warn should be called");
  console.warn = originalWarn;
});
