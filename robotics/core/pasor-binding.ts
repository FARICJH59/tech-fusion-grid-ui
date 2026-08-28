import { createHoareExecutionReceipt } from "../../builder/pasor/hoare-execution-receipt";
import type { ExecutionUnit } from "../../builder/pasor/execution-plan";
import type { PasorPlan } from "../../builder/pasor/execution-plan";
import type { ResupplyMission } from "./types";

export interface RoboticsPasorBinding {
  missionId: string;
  vehicleId: string;
  workloadId: string;
  executionUnitId: string;
  receipt: ReturnType<typeof createHoareExecutionReceipt>;
  simulationOnly: true;
  mutationExecuted: false;
}

export function bindRoboticsMissionToPasor(
  plan: PasorPlan,
  unit: ExecutionUnit,
  mission: ResupplyMission,
): RoboticsPasorBinding {
  if (!mission.missionId) {
    throw new Error("robotics_mission_id_required");
  }

  if (!mission.vehicleId) {
    throw new Error("robotics_vehicle_id_required");
  }

  const workloadId = `robotics-${mission.missionId}`;

  const receipt = createHoareExecutionReceipt(plan, unit, {
    runtime_kind: "native",
    workload_id: workloadId,
    agent_id: `robot-agent-${mission.vehicleId}`,
    node_id: `robot-node-${mission.vehicleId}`,
    pack_id: "robotics-resupply-v1",
    capabilities: [
      "simulated-navigation",
      "telemetry",
      "payload-transport",
      "mission-execution",
    ],
    required_capability: "mission-execution",
  });

  return {
    missionId: mission.missionId,
    vehicleId: mission.vehicleId,
    workloadId,
    executionUnitId: unit.unit_id,
    receipt,
    simulationOnly: true,
    mutationExecuted: false,
  };
}
