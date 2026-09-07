import type { GovernedExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";

export type AutonomousBuildTarget = "github" | "termux";

export type AutonomousBuildRequest = Readonly<{
  repository: string;
  ref: string;
  workflow: string;
  inputs?: Readonly<Record<string, string>>;
  projectId: string;
  tenantId: string;
  transactionId: string;
  attemptId: string;
  authority: GovernedExecutionAuthority;
}>;

export type AutonomousBuildResult = Readonly<{
  target: AutonomousBuildTarget;
  accepted: boolean;
  executionId: string;
  message: string;
}>;

export interface AutonomousBuildProvider {
  readonly target: AutonomousBuildTarget;
  execute(request: AutonomousBuildRequest): Promise<AutonomousBuildResult>;
}
