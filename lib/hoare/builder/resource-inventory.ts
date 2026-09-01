export type ResourceClassification = "unclassified" | "controlled" | "classified";
export type AcceleratorType = "none" | "gpu" | "npu" | "tpu";

export interface ResourceInventoryRecord {
  id: string;
  provider: string;
  region: string;
  environment: "development" | "staging" | "production";
  classification: ResourceClassification;
  egressAllowed: boolean;
  accelerator: AcceleratorType;
  acceleratorModels: readonly string[];
  acceleratorCount: number;
  cpu: number;
  memoryGiB: number;
  availability: number;
  estimatedLatencyMs: number;
  estimatedCostPerHour: number;
  capabilities: readonly string[];
  observedAt: string;
  expiresAt: string;
  source: string;
  fingerprint: string;
}

export interface ResourceInventorySnapshot {
  version: "1";
  generatedAt: string;
  records: readonly ResourceInventoryRecord[];
  source: string;
}

export function validateInventoryRecord(record: ResourceInventoryRecord, now = new Date()): string[] {
  const errors: string[] = [];
  if (!record.id || !record.provider || !record.region) errors.push("identity_missing");
  if (!record.observedAt || !record.expiresAt) errors.push("freshness_missing");
  if (new Date(record.expiresAt).getTime() <= now.getTime()) errors.push("inventory_expired");
  if (record.availability < 0 || record.availability > 1) errors.push("availability_invalid");
  if (record.acceleratorCount < 0 || record.cpu < 0 || record.memoryGiB < 0) errors.push("capacity_invalid");
  if (record.estimatedCostPerHour < 0 || record.estimatedLatencyMs < 0) errors.push("estimate_invalid");
  if (!record.fingerprint) errors.push("fingerprint_missing");
  return errors;
}

export function filterFreshInventory(snapshot: ResourceInventorySnapshot, now = new Date()): ResourceInventoryRecord[] {
  return snapshot.records.filter((record) => validateInventoryRecord(record, now).length === 0);
}
