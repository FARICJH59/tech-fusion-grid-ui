import type { ExecutionPlan } from "../contracts/execution-plan";
import type { ExecutionUnit } from "../contracts/execution-unit";

export interface ProjectIntent {
  project_id: string;
  tenant_id: string;
  goal: string;
  constraints?: {
    max_energy?: number;
    max_quota?: number;
    max_parallelism?: number;
  };
}

export interface PasorResult {
  plan: ExecutionPlan;
  execution_units: ExecutionUnit[];
  recommendations: string[];
}
