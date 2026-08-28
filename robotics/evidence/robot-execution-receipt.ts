export interface RobotExecutionReceipt {
  schema: "hoare.robot-execution-receipt/v1";
  missionId: string;
  vehicleId: string;
  status: "completed" | "failed" | "rejected";
  mutationExecuted: false;
  simulationOnly: true;
}

export function createRobotExecutionReceipt(input: {
  missionId: string;
  vehicleId: string;
  status: RobotExecutionReceipt["status"];
}): RobotExecutionReceipt {
  return {
    schema: "hoare.robot-execution-receipt/v1",
    missionId: input.missionId,
    vehicleId: input.vehicleId,
    status: input.status,
    mutationExecuted: false,
    simulationOnly: true,
  };
}
