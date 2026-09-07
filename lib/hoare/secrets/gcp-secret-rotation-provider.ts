import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { assertTcxExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";
import {
  assertSecretRotationRequest,
  type SecretRotationProvider,
  type SecretRotationRequest,
  type SecretRotationResult,
} from "./secret-rotation-provider";
import type { SecretAccessPolicyEngine } from "./secret-access-policy";

export type GcpSecretRotationClient = Pick<
  SecretManagerServiceClient,
  "addSecretVersion" | "disableSecretVersion" | "destroySecretVersion"
>;

export type GcpSecretRotationProviderOptions = Readonly<{
  projectId: string;
  client?: GcpSecretRotationClient;
  accessPolicy: SecretAccessPolicyEngine;
}>;

export class GcpSecretRotationProvider implements SecretRotationProvider {
  private readonly projectId: string;
  private readonly client: GcpSecretRotationClient;
  private readonly accessPolicy: SecretAccessPolicyEngine;

  constructor(options: GcpSecretRotationProviderOptions) {
    if (!options.projectId.trim()) throw new Error("secret_rotation_project_required");
    this.projectId = options.projectId.trim();
    this.client = options.client ?? new SecretManagerServiceClient();
    this.accessPolicy = options.accessPolicy;
  }

  private assertRequest(request: SecretRotationRequest): void {
    if (request.projectId !== this.projectId) throw new Error("secret_rotation_project_mismatch");
    assertTcxExecutionAuthority(request.authority);
    if (request.authority.tenantId !== request.tenantId) throw new Error("secret_rotation_tenant_mismatch");
    if (
      request.authority.transactionId !== request.transactionId ||
      request.authority.attemptId !== request.attemptId
    ) {
      throw new Error("secret_rotation_attempt_mismatch");
    }
    assertSecretRotationRequest(request, {
      accessPolicy: this.accessPolicy,
      provider: this,
    });
  }

  async rotate(request: SecretRotationRequest, value: string): Promise<SecretRotationResult> {
    if (request.operation !== "rotate") throw new Error("secret_rotation_operation_invalid");
    if (!value.trim()) throw new Error("secret_rotation_value_empty");
    this.assertRequest(request);
    request.authority.assertValid();

    const parent = `projects/${this.projectId}/secrets/${request.secretId}`;
    const [version] = await this.client.addSecretVersion({
      parent,
      payload: { data: Buffer.from(value, "utf8") },
    });

    request.authority.assertValid();
    const versionName = version.name?.split("/").pop();
    if (!versionName) throw new Error("secret_rotation_version_missing");

    return Object.freeze({
      accepted: true,
      secretId: request.secretId,
      operation: request.operation,
      version: versionName,
    });
  }

  async disable(request: SecretRotationRequest): Promise<SecretRotationResult> {
    if (request.operation !== "disable") throw new Error("secret_rotation_operation_invalid");
    this.assertRequest(request);
    const version = request.targetVersion?.trim();
    if (!version) throw new Error("secret_rotation_version_required");
    request.authority.assertValid();

    const name = `projects/${this.projectId}/secrets/${request.secretId}/versions/${version}`;
    const [result] = await this.client.disableSecretVersion({ name });

    request.authority.assertValid();
    const versionName = result.name?.split("/").pop() || version;
    return Object.freeze({ accepted: true, secretId: request.secretId, operation: request.operation, version: versionName });
  }

  async destroy(request: SecretRotationRequest): Promise<SecretRotationResult> {
    if (request.operation !== "destroy") throw new Error("secret_rotation_operation_invalid");
    this.assertRequest(request);
    const version = request.targetVersion?.trim();
    if (!version) throw new Error("secret_rotation_version_required");
    request.authority.assertValid();

    const name = `projects/${this.projectId}/secrets/${request.secretId}/versions/${version}`;
    const [result] = await this.client.destroySecretVersion({ name });

    request.authority.assertValid();
    const versionName = result.name?.split("/").pop() || version;
    return Object.freeze({ accepted: true, secretId: request.secretId, operation: request.operation, version: versionName });
  }
}
