import type { GovernedExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";
import type { SecretAccessPolicyEngine } from "./secret-access-policy";
import type { SecretAccessRequest } from "./secret-provider";

export type SecretRotationOperation = "rotate" | "revoke";

export type SecretRotationRequest = Readonly<{
  tenantId: string;
  projectId: string;
  transactionId: string;
  attemptId: string;
  secretId: string;
  agentId: string;
  workloadId: string;
  environment: string;
  operation: SecretRotationOperation;
  nodeId?: string;
  runtimeKind?: string;
  targetVersion?: string;
  authority: GovernedExecutionAuthority;
}>;

export type SecretRotationResult = Readonly<{
  secretId: string;
  operation: SecretRotationOperation;
  version: string;
  accepted: true;
}>;

export interface SecretRotationProvider {
  rotate(request: SecretRotationRequest, value: string): Promise<SecretRotationResult>;
  disable(request: SecretRotationRequest): Promise<SecretRotationResult>;
  destroy(request: SecretRotationRequest): Promise<SecretRotationResult>;
}

export type GovernedSecretRotationOptions = Readonly<{
  accessPolicy: SecretAccessPolicyEngine;
  provider: SecretRotationProvider;
}>;

function authorize(request: SecretRotationRequest, policy: SecretAccessPolicyEngine): void {
  const accessRequest: SecretAccessRequest = Object.freeze({
    tenantId: request.tenantId,
    projectId: request.projectId,
    transactionId: request.transactionId,
    attemptId: request.attemptId,
    secretId: request.secretId,
    agentId: request.agentId,
    workloadId: request.workloadId,
    environment: request.environment,
    operation: request.operation,
    nodeId: request.nodeId,
    runtimeKind: request.runtimeKind,
    secretVersion: request.targetVersion,
    authority: request.authority,
  });
  policy.authorize(accessRequest);
}

export function assertSecretRotationRequest(
  request: SecretRotationRequest,
  options: GovernedSecretRotationOptions,
): void {
  if (!request.projectId.trim()) throw new Error("secret_rotation_project_required");
  if (!request.secretId.trim()) throw new Error("secret_rotation_id_required");
  if (!request.agentId.trim() || !request.workloadId.trim()) {
    throw new Error("secret_rotation_identity_required");
  }
  authorize(request, options.accessPolicy);
  request.authority.assertValid();
}

export async function governedRotateSecret(
  request: SecretRotationRequest,
  value: string,
  options: GovernedSecretRotationOptions,
): Promise<SecretRotationResult> {
  if (!value.trim()) throw new Error("secret_rotation_value_empty");
  if (request.operation !== "rotate") throw new Error("secret_rotation_operation_invalid");
  assertSecretRotationRequest(request, options);
  const result = await options.provider.rotate(request, value);
  request.authority.assertValid();
  return result;
}

export async function governedDisableSecret(
  request: SecretRotationRequest,
  options: GovernedSecretRotationOptions,
): Promise<SecretRotationResult> {
  if (request.operation !== "revoke") throw new Error("secret_rotation_operation_invalid");
  assertSecretRotationRequest(request, options);
  const result = await options.provider.disable(request);
  request.authority.assertValid();
  return result;
}

export async function governedDestroySecret(
  request: SecretRotationRequest,
  options: GovernedSecretRotationOptions,
): Promise<SecretRotationResult> {
  if (request.operation !== "revoke") throw new Error("secret_rotation_operation_invalid");
  assertSecretRotationRequest(request, options);
  const result = await options.provider.destroy(request);
  request.authority.assertValid();
  return result;
}
