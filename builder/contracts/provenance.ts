import { createHash } from "node:crypto";

export interface ProvenanceRecord {
  provenance_hash: string;
  simulation_hash: string;
  tenant_id: string;
  project_id: string;
  execution_id: string;
  unit_id: string;
  parent_hash?: string;
  created_at: string;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function canonicalHash(value: unknown): string {
  const serialized = JSON.stringify(canonicalize(value));
  return createHash("sha256").update(serialized).digest("hex");
}
