import { describe, expect, it } from "vitest";
import { canonicalSerialize, sha256Canonical } from "./canonical-serialization";

describe("canonical serialization", () => {
  it("is invariant to object key ordering at every depth", () => {
    const left = { z: { b: 2, a: 1 }, a: [{ d: 4, c: 3 }] };
    const right = { a: [{ c: 3, d: 4 }], z: { a: 1, b: 2 } };
    expect(canonicalSerialize(left)).toBe(canonicalSerialize(right));
    expect(sha256Canonical(left)).toBe(sha256Canonical(right));
  });

  it("preserves array ordering", () => {
    expect(sha256Canonical(["a", "b"])).not.toBe(sha256Canonical(["b", "a"]));
  });

  it("omits undefined object properties consistently", () => {
    expect(canonicalSerialize({ a: 1, b: undefined })).toBe(canonicalSerialize({ a: 1 }));
    expect(sha256Canonical({ a: 1, b: undefined })).toBe(sha256Canonical({ a: 1 }));
  });

  it("distinguishes null from an omitted property", () => {
    expect(canonicalSerialize({ a: null })).not.toBe(canonicalSerialize({}));
    expect(sha256Canonical({ a: null })).not.toBe(sha256Canonical({}));
  });

  it("rejects top-level undefined and non-finite numbers", () => {
    expect(() => canonicalSerialize(undefined)).toThrow("canonical_serialize_undefined");
    expect(() => canonicalSerialize(Number.NaN)).toThrow("canonical_serialize_non_finite_number");
    expect(() => canonicalSerialize(Number.POSITIVE_INFINITY)).toThrow("canonical_serialize_non_finite_number");
    expect(() => canonicalSerialize(Number.NEGATIVE_INFINITY)).toThrow("canonical_serialize_non_finite_number");
  });

  it("normalizes Date values to ISO strings", () => {
    const date = new Date("2026-09-04T23:00:00.000Z");
    expect(canonicalSerialize(date)).toBe(JSON.stringify("2026-09-04T23:00:00.000Z"));
    expect(sha256Canonical(date)).toBe(sha256Canonical("2026-09-04T23:00:00.000Z"));
  });

  it("encodes bigint values deterministically", () => {
    expect(canonicalSerialize(123n)).toBe('{"$bigint":"123"}');
    expect(sha256Canonical(123n)).toBe(sha256Canonical(123n));
    expect(sha256Canonical(123n)).not.toBe(sha256Canonical(124n));
  });

  it("changes the digest when integrity-relevant content changes", () => {
    expect(sha256Canonical({ transactionId: "tx-1", state: "SUCCEEDED" })).not.toBe(
      sha256Canonical({ transactionId: "tx-1", state: "FAILED" }),
    );
  });

  it("preserves JSON-safe string escaping and Unicode", () => {
    const value = { message: "quote: \" / newline:\n π 🚀" };
    expect(JSON.parse(canonicalSerialize(value))).toEqual(value);
  });
});
