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

export function canonicalHash(value: unknown): string {
  const serialized = JSON.stringify(value, Object.keys(value as object).sort());
  return createHash("sha256").update(serialized).digest("hex");
}
