import type { AutonomousBuildProvider, AutonomousBuildRequest, AutonomousBuildResult } from "./types";

export type AutonomousBuildHttpRequest = Readonly<{
  target: "github" | "termux";
  repository: string;
  ref: string;
  workflow: string;
  projectId: string;
  tenantId: string;
  transactionId: string;
  attemptId: string;
  inputs?: Readonly<Record<string, string>>;
}>;

export type AutonomousBuildHttpResponse = Readonly<{
  accepted: boolean;
  target: AutonomousBuildHttpRequest["target"];
  executionId: string;
  message: string;
}>;

export async function executeAutonomousBuildOverHttp(
  provider: AutonomousBuildProvider,
  request: AutonomousBuildRequest,
): Promise<AutonomousBuildHttpResponse> {
  const result: AutonomousBuildResult = await provider.execute(request);
  return {
    accepted: result.accepted,
    target: result.target,
    executionId: result.executionId,
    message: result.message,
  };
}
