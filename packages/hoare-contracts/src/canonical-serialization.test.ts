import assert from "node:assert/strict";
import test from "node:test";
import { canonicalSerialize, sha256Canonical } from "./canonical-serialization";

test("canonical serialization: key ordering is invariant at every depth", () => {
  const left = { z: { b: 2, a: 1 }, a: [{ d: 4, c: 3 }] };
  const right = { a: [{ c: 3, d: 4 }], z: { a: 1, b: 2 } };
  assert.equal(canonicalSerialize(left), canonicalSerialize(right));
  assert.equal(sha256Canonical(left), sha256Canonical(right));
});

test("canonical serialization: array ordering is preserved", () => {
  assert.notEqual(sha256Canonical(["a", "b"]), sha256Canonical(["b", "a"]));
});

test("canonical serialization: undefined object properties are omitted consistently", () => {
  assert.equal(canonicalSerialize({ a: 1, b: undefined }), canonicalSerialize({ a: 1 }));
  assert.equal(sha256Canonical({ a: 1, b: undefined }), sha256Canonical({ a: 1 }));
});

test("canonical serialization: null is distinct from an omitted property", () => {
  assert.notEqual(canonicalSerialize({ a: null }), canonicalSerialize({}));
  assert.notEqual(sha256Canonical({ a: null }), sha256Canonical({}));
});

test("canonical serialization: top-level undefined and non-finite numbers are rejected", () => {
  assert.throws(() => canonicalSerialize(undefined), /canonical_serialize_undefined/);
  assert.throws(() => canonicalSerialize(Number.NaN), /canonical_serialize_non_finite_number/);
  assert.throws(() => canonicalSerialize(Number.POSITIVE_INFINITY), /canonical_serialize_non_finite_number/);
  assert.throws(() => canonicalSerialize(Number.NEGATIVE_INFINITY), /canonical_serialize_non_finite_number/);
});

test("canonical serialization: Date values normalize to ISO strings", () => {
  const date = new Date("2026-09-04T23:00:00.000Z");
  assert.equal(canonicalSerialize(date), JSON.stringify("2026-09-04T23:00:00.000Z"));
  assert.equal(sha256Canonical(date), sha256Canonical("2026-09-04T23:00:00.000Z"));
});

test("canonical serialization: bigint values are deterministic", () => {
  const oneTwoThree = BigInt("123");
  const oneTwoFour = BigInt("124");
  assert.equal(canonicalSerialize(oneTwoThree), '{"$bigint":"123"}');
  assert.equal(sha256Canonical(oneTwoThree), sha256Canonical(oneTwoThree));
  assert.notEqual(sha256Canonical(oneTwoThree), sha256Canonical(oneTwoFour));
});

test("canonical serialization: integrity-relevant content changes the digest", () => {
  assert.notEqual(
    sha256Canonical({ transactionId: "tx-1", state: "SUCCEEDED" }),
    sha256Canonical({ transactionId: "tx-1", state: "FAILED" }),
  );
});

test("canonical serialization: JSON-safe string escaping and Unicode are preserved", () => {
  const value = { message: "quote: \" / newline:\n π 🚀" };
  assert.deepEqual(JSON.parse(canonicalSerialize(value)), value);
});
