import { createHash } from "node:crypto";

/**
 * Deterministic serialization for integrity-critical HOARE records.
 * Object keys are sorted recursively; arrays preserve order. Undefined
 * object properties are omitted, matching JSON object semantics.
 */
export function canonicalSerialize(value: unknown): string {
  if (value === undefined) throw new TypeError("canonical_serialize_undefined");
  if (value === null) return "null";

  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new TypeError("canonical_serialize_non_finite_number");
      return JSON.stringify(value);
    case "bigint":
      return `{"$bigint":${JSON.stringify(value.toString())}}`;
    case "object":
      if (Array.isArray(value)) {
        return `[${value.map((item) => canonicalSerialize(item)).join(",")}]`;
      }
      if (value instanceof Date) return JSON.stringify(value.toISOString());
      {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record)
          .filter((key) => record[key] !== undefined)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canonicalSerialize(record[key])}`)
          .join(",")}}`;
      }
    default:
      throw new TypeError(`canonical_serialize_unsupported_type:${typeof value}`);
  }
}

export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalSerialize(value), "utf8").digest("hex");
}
