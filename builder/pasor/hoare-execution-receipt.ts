import { createHash } from "node:crypto";
import type { ExecutionUnit, PasorPlan } from "./execution-plan";

export type HoareExecutionReceipt = {
  schema: "hoare.execution-receipt/v1";
  receipt_id: string;
  receipt_hash: string;
  admission_status: "ADMITTED";
  tenant_id: string;
  project_id: string;
  workload_id: string;
  agent_id: string;
  node_id: string;
  pack_id: string;
  runtime_kind: "python" | "native";
  capabilities: string[];
  required_capability?: string;
  command_id: string;
  parameters: Record<string, unknown>;
  dependencies: string[];
  pasor_plan_hash: string;
  pasor_unit_id: string;
  simulation_hash: string;
  provenance_hash: string;
  energy_cost: number;
  quota_cost: number;
  entrypoint?: string;
  executable?: string;
  artifact_path?: string;
};

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function receiptId(plan: PasorPlan, unit: ExecutionUnit): string {
  return `receipt-${sha256({ plan_hash: plan.plan_hash, unit_id: unit.unit_id }).slice(0, 32)}`;
}

/**
 * Converts one governed PASOR execution unit into the canonical HOARE receipt
 * shape without executing the workload.
 *
 * This adapter deliberately preserves PASOR's plan/provenance hashes instead
 * of creating a second planning system. HOARE remains responsible for
 * admission, capability enforcement, integrity validation, and execution.
 */
export function createHoareExecutionReceipt(
  plan: PasorPlan,
  unit: ExecutionUnit,
  options: {
    runtime_kind: "python" | "native";
    workload_id: string;
    agent_id: string;
    node_id: string;
    pack_id: string;
    capabilities: string[];
    required_capability?: string;
    entrypoint?: string;
    executable?: string;
    artifact_path?: string;
  },
): HoareExecutionReceipt {
  if (plan.schema !== "hoare.pasor-plan/v1") {
    throw new Error("invalid_pasor_plan_schema");
  }

  if (!plan.tenant_id || !plan.project_id || !plan.plan_hash) {
    throw new Error("invalid_pasor_plan_identity");
  }

  if (!unit.unit_id || !unit.command_id) {
    throw new Error("invalid_pasor_execution_unit");
  }

  const receiptCore = {
    schema: "hoare.execution-receipt/v1" as const,
    receipt_id: receiptId(plan, unit),
    admission_status: "ADMITTED" as const,
    tenant_id: plan.tenant_id,
    project_id: plan.project_id,
    workload_id: options.workload_id,
    agent_id: options.agent_id,
    node_id: options.node_id,
    pack_id: options.pack_id,
    runtime_kind: options.runtime_kind,
    capabilities: [...options.capabilities],
    ...(options.required_capability
      ? { required_capability: options.required_capability }
      : {}),
    command_id: unit.command_id,
    parameters: unit.parameters,
    dependencies: [...unit.dependencies],
    pasor_plan_hash: plan.plan_hash,
    pasor_unit_id: unit.unit_id,
    simulation_hash: unit.simulation_hash,
    provenance_hash: unit.provenance_hash,
    energy_cost: unit.energy_cost,
    quota_cost: unit.quota_cost,
    ...(options.entrypoint ? { entrypoint: options.entrypoint } : {}),
    ...(options.executable ? { executable: options.executable } : {}),
    ...(options.artifact_path ? { artifact_path: options.artifact_path } : {}),
  };

  return {
    ...receiptCore,
    receipt_hash: sha256(receiptCore),
  };
}
