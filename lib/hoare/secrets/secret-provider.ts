import type { GovernedExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";

export type SecretAccessRequest = Readonly<{
  tenantId: string;
  projectId: string;
  transactionId: string;
  attemptId: string;
  secretId: string;
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
