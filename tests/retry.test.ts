/**
 * Tests for lib/utils/retry.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import { retry, createRetry } from "../lib/utils/retry";

test("retry: succeeds on first attempt", async () => {
  let calls = 0;
  const result = await retry(async () => {
    calls++;
    return "ok";
  });
  assert.equal(result, "ok");
  assert.equal(calls, 1);
});

test("retry: retries on failure and eventually succeeds", async () => {
  let calls = 0;
  const result = await retry(
    async () => {
      calls++;
      if (calls < 3) throw new Error("transient");
      return "recovered";
    },
    { maxAttempts: 5, baseDelayMs: 1 },
  );
  assert.equal(result, "recovered");
  assert.equal(calls, 3);
});

test("retry: throws after exhausting all attempts", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      retry(
        async () => {
          calls++;
          throw new Error("persistent error");
        },
        { maxAttempts: 3, baseDelayMs: 1 },
      ),
    { message: "persistent error" },
  );
  assert.equal(calls, 3);
});

test("retry: stops early when isRetryable returns false", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      retry(
        async () => {
          calls++;
          throw new Error("non-retryable");
        },
        {
          maxAttempts: 5,
          baseDelayMs: 1,
          isRetryable: () => false,
        },
      ),
    { message: "non-retryable" },
  );
  assert.equal(calls, 1);
});

test("retry: calls onRetry callback with attempt and delay", async () => {
  const retries: Array<{ attempt: number }> = [];
  await retry(
    async () => {
      if (retries.length < 2) throw new Error("fail");
      return true;
    },
    {
      maxAttempts: 4,
      baseDelayMs: 1,
      onRetry: (_err, attempt, _delay) => retries.push({ attempt }),
    },
  );
  assert.equal(retries.length, 2);
  assert.equal(retries[0].attempt, 1);
  assert.equal(retries[1].attempt, 2);
});

test("createRetry: creates pre-configured retry function", async () => {
  const retryFn = createRetry({ maxAttempts: 2, baseDelayMs: 1 });
  let calls = 0;
  await assert.rejects(
    () =>
      retryFn(async () => {
        calls++;
        throw new Error("boom");
      }),
    { message: "boom" },
  );
  assert.equal(calls, 2);
});
