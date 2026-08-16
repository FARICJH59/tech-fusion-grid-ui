export type ExecutionUnitStatus =
  | "PLANNED"
  | "SIMULATED"
  | "AUTHORIZED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "SKIPPED";

export interface ExecutionUnit {
  unit_id: string;
  command_id: string;
  parameters: Record<string, unknown>;
  dependencies: string[];
  energy_cost: number;
  quota_cost: number;
  optional?: boolean;
  tenant_id: string;
  project_id: string;
  execution_id: string;
  simulation_hash: string;
  provenance_hash: string;
  status: ExecutionUnitStatus;
}
