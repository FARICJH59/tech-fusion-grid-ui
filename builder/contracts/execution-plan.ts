import type { ExecutionUnit } from "./execution-unit";

export interface ExecutionPlan {
  project_id: string;
  tenant_id: string;
  execution_id: string;
  version: string;
  intent: string;
  execution_units: ExecutionUnit[];
  created_at: string;
  plan_hash: string;
}
