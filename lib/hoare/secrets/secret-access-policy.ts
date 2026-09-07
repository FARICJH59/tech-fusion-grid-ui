import { assertTcxExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";
import type { SecretAccessRequest } from "./secret-provider";

export const SECRET_ACCESS_OPERATIONS = ["read", "inject", "rotate", "disable", "destroy"] as const;
export type SecretAccessOperation = (typeof SECRET_ACCESS_OPERATIONS)[number];

export type SecretAccessPolicy = Readonly<{
  tenantId: string;
  projectId: string;
  secretId: string;
  environment: string;
  operations: ReadonlySet<SecretAccessOperation>;
  agentIds: ReadonlySet<string>;
  workloadIds: ReadonlySet<string>;
  nodeIds?: ReadonlySet<string>;
  runtimeKinds?: ReadonlySet<string>;
  secretVersions?: ReadonlySet<string>;
}>;

export type SecretAccessDecision = Readonly<{
  allowed: true;
  policyId: string;
  tenantId: string;
  secretId: string;
  operation: SecretAccessOperation;
}>;

const nonEmpty = (value: string, error: string): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error(error);
  return normalized;
};

export class SecretAccessPolicyEngine {
  private readonly policies: ReadonlyMap<string, SecretAccessPolicy>;

  constructor(policies: ReadonlyMap<string, SecretAccessPolicy>) {
    this.policies = policies;
  }

  authorize(request: SecretAccessRequest): SecretAccessDecision {
    assertTcxExecutionAuthority(request.authority);

    const tenantId = nonEmpty(request.tenantId, "secret_policy_tenant_required");
    const projectId = nonEmpty(request.projectId, "secret_policy_project_required");
    const secretId = nonEmpty(request.secretId, "secret_policy_secret_required");
    const agentId = nonEmpty(request.agentId, "secret_policy_agent_required");
    const workloadId = nonEmpty(request.workloadId, "secret_policy_workload_required");
    const environment = nonEmpty(request.environment, "secret_policy_environment_required");
    const operation = request.operation;

    if (!SECRET_ACCESS_OPERATIONS.includes(operation)) {
      throw new Error("secret_policy_operation_invalid");
    }

    if (request.authority.tenantId !== tenantId) throw new Error("secret_policy_tenant_mismatch");
    if (request.authority.transactionId !== request.transactionId || request.authority.attemptId !== request.attemptId) {
      throw new Error("secret_policy_attempt_mismatch");
    }

    const policyKey = `${tenantId}:${projectId}:${secretId}:${environment}`;
    const policy = this.policies.get(policyKey);
    if (!policy) throw new Error("secret_policy_not_found");

    if (policy.tenantId !== tenantId) throw new Error("secret_policy_tenant_binding_invalid");
    if (policy.projectId !== projectId) throw new Error("secret_policy_project_mismatch");
    if (policy.secretId !== secretId) throw new Error("secret_policy_secret_mismatch");
    if (policy.environment !== environment) throw new Error("secret_policy_environment_mismatch");
    if (!policy.operations.has(operation)) throw new Error("secret_policy_operation_denied");
    if (!policy.agentIds.has(agentId)) throw new Error("secret_policy_agent_denied");
    if (!policy.workloadIds.has(workloadId)) throw new Error("secret_policy_workload_denied");
    if (request.nodeId && policy.nodeIds && !policy.nodeIds.has(request.nodeId)) {
      throw new Error("secret_policy_node_denied");
    }
    if (request.runtimeKind && policy.runtimeKinds && !policy.runtimeKinds.has(request.runtimeKind)) {
      throw new Error("secret_policy_runtime_denied");
    }
    if (request.secretVersion && policy.secretVersions && !policy.secretVersions.has(request.secretVersion)) {
      throw new Error("secret_policy_version_denied");
    }

    request.authority.assertValid();

    return Object.freeze({
      allowed: true,
      policyId: policyKey,
      tenantId,
      secretId,
      operation,
    });
  }
}
