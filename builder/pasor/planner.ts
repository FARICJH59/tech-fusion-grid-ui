import { createHash } from "node:crypto";
import type { ExecutionPlan } from "../contracts/execution-plan";
import type { ExecutionUnit } from "../contracts/execution-unit";
import type { ProjectIntent, PasorResult } from "./types";

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function unit(
  intent: ProjectIntent,
  unitId: string,
  commandId: string,
  parameters: Record<string, unknown>,
  dependencies: string[],
  energyCost: number,
  quotaCost: number,
  optional = false,
): ExecutionUnit {
  const base = {
    unit_id: unitId,
    command_id: commandId,
    parameters,
    dependencies,
    energy_cost: energyCost,
    quota_cost: quotaCost,
    optional,
    tenant_id: intent.tenant_id,
    project_id: intent.project_id,
  };

  const simulationHash = hash({ type: "simulation", ...base });
  const provenanceHash = hash({ type: "provenance", simulation_hash: simulationHash, ...base });

  return {
    ...base,
    simulation_hash: simulationHash,
    provenance_hash: provenanceHash,
  } as ExecutionUnit;
}

/**
 * PASOR — Project Architecture, Simulation, Orchestration & Routing.
 * Converts a structured intent into a deterministic execution plan.
 * Provider-specific execution is deliberately outside PASOR.
 */
export function planProject(intent: ProjectIntent): PasorResult {
  const goal = intent.goal.toLowerCase();
  const units: ExecutionUnit[] = [];

  if (goal.includes("qgps") && (goal.includes("anomal") || goal.includes("quantum autoencoder"))) {
    units.push(
      unit(intent, "step1", "ml.load_data", { source: "qgps_sensor_db" }, [], 6, 1),
      unit(intent, "step2", "ml.clean_data", { missing_value_strategy: "interpolate" }, ["step1"], 8, 1),
      unit(intent, "step3", "ml.feature_engineering", { encode_cyclic: ["time_of_day", "day_of_week"] }, ["step2"], 10, 2),
      unit(intent, "step4", "ml.split_data", { train_ratio: 0.8 }, ["step3"], 2, 0.5),
      unit(intent, "step5", "ml.train_model", { model_type: "quantum_autoencoder", layers: [16, 8, 4, 8, 16] }, ["step4"], 60, 6),
      unit(intent, "step6", "ml.evaluate_model", { metrics: ["reconstruction_error", "anomaly_score"] }, ["step5"], 6, 1),
      unit(intent, "step7", "ml.hyperparameter_optimize", { search_space: { learning_rate: [0.001, 0.01], batch_size: [32, 64] } }, ["step5"], 50, 5, true),
      unit(intent, "step8", "ml.deploy_model", { endpoint: "/api/qgps-anomaly" }, ["step6", "step7"], 10, 1),
      unit(intent, "step9", "ml.monitor_model", { drift_detection: true }, ["step8"], 5, 0.5),
    );
  } else {
    units.push(unit(intent, "step1", "project.analyze", { goal: intent.goal }, [], 1, 1));
  }

  const totalEnergy = units.reduce((sum, item) => sum + item.energy_cost, 0);
  const totalQuota = units.reduce((sum, item) => sum + item.quota_cost, 0);

  if (intent.constraints?.max_energy !== undefined && totalEnergy > intent.constraints.max_energy) {
    throw new Error(`PASOR energy budget exceeded: ${totalEnergy} > ${intent.constraints.max_energy}`);
  }
  if (intent.constraints?.max_quota !== undefined && totalQuota > intent.constraints.max_quota) {
    throw new Error(`PASOR quota budget exceeded: ${totalQuota} > ${intent.constraints.max_quota}`);
  }

  const plan = {
    project_id: intent.project_id,
    tenant_id: intent.tenant_id,
    execution_units: units,
    total_energy_cost: totalEnergy,
    total_quota_cost: totalQuota,
  } as ExecutionPlan;

  return {
    plan,
    execution_units: units,
    recommendations: [
      "Run independent units in parallel when their dependency sets permit it.",
      "Skip optional optimization when its predicted value does not justify its energy/quota cost.",
      "Keep provider selection outside PASOR so the same plan can target Vercel, Cloud Run, Kubernetes, edge, or HOARE-native runtime.",
    ],
  };
}
