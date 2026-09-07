import type { GovernedExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";
import type { SecretAccessOperation } from "./secret-access-policy";

export type SecretAccessRequest = Readonly<{
  tenantId: string;
  projectId: string;
  transactionId: string;
  attemptId: string;
  secretId: string;
  agentId: string;
  workloadId: string;
  environment: string;
  operation: SecretAccessOperation;
  nodeId?: string;
  runtimeKind?: string;
  secretVersion?: string;
  authority: GovernedExecutionAuthority;
}>;

export type SecretMaterial = Readonly<{
  secretId: string;
  version: string;
  value: string;
}>;

export interface SecretProvider {
  getSecret(request: SecretAccessRequest): Promise<SecretMaterial>;
}
