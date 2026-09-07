import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { assertTcxExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";
import { SecretAccessPolicyEngine } from "./secret-access-policy";
import { SecretCapabilityValidator, type SecretCapabilityReference } from "./secret-capability";
import type { SecretAccessRequest, SecretMaterial, SecretProvider } from "./secret-provider";

export type GcpSecretManagerClient = Pick<SecretManagerServiceClient, "accessSecretVersion">;

export type GcpSecretManagerProviderOptions = Readonly<{
  projectId: string;
  client?: GcpSecretManagerClient;
  secretVersion?: string;
  tenantSecretBinding: ReadonlyMap<string, ReadonlySet<string>>;
  accessPolicy: SecretAccessPolicyEngine;
  capabilityValidator?: SecretCapabilityValidator;
}>;

/**
 * Governed read boundary for tenant secrets stored in Google Secret Manager.
 * Secret material is returned only after static tenant binding, policy authorization,
 * TCX authority validation, and transaction/attempt identity checks pass.
 */
export class GcpSecretManagerProvider implements SecretProvider {
  private readonly projectId: string;
  private readonly client: GcpSecretManagerClient;
  private readonly secretVersion: string;
  private readonly tenantSecretBinding: ReadonlyMap<string, ReadonlySet<string>>;
  private readonly accessPolicy: SecretAccessPolicyEngine;
  private readonly capabilityValidator?: SecretCapabilityValidator;

  constructor(options: GcpSecretManagerProviderOptions) {
    if (!options.projectId.trim()) throw new Error("secret_manager_project_required");
    this.projectId = options.projectId.trim();
    this.client = options.client ?? new SecretManagerServiceClient();
    this.secretVersion = options.secretVersion?.trim() || "latest";
    this.tenantSecretBinding = options.tenantSecretBinding;
    this.accessPolicy = options.accessPolicy;
    this.capabilityValidator = options.capabilityValidator;
  }

  async getSecret(request: SecretAccessRequest): Promise<SecretMaterial> {
    if (request.projectId !== this.projectId) throw new Error("secret_project_mismatch");

    const allowedSecrets = this.tenantSecretBinding.get(request.tenantId);
    if (!allowedSecrets?.has(request.secretId)) {
      throw new Error("secret_tenant_binding_invalid");
    }

    assertTcxExecutionAuthority(request.authority);
    if (request.authority.tenantId !== request.tenantId) throw new Error("secret_tenant_mismatch");
    if (request.authority.transactionId !== request.transactionId || request.authority.attemptId !== request.attemptId) {
      throw new Error("secret_attempt_mismatch");
    }

    this.accessPolicy.authorize(request);
    request.authority.assertValid();

    return this.readSecretVersion(request);
  }

  /**
   * Final read boundary for short-lived capabilities. Consumption occurs before the
   * external read, so a capability can never be replayed even if the provider call fails.
   */
  async getSecretWithCapability(
    reference: SecretCapabilityReference,
    request: SecretAccessRequest,
  ): Promise<SecretMaterial> {
    if (!this.capabilityValidator) throw new Error("secret_capability_validator_required");
    if (request.projectId !== this.projectId) throw new Error("secret_project_mismatch");

    const allowedSecrets = this.tenantSecretBinding.get(request.tenantId);
    if (!allowedSecrets?.has(request.secretId)) {
      throw new Error("secret_tenant_binding_invalid");
    }

    assertTcxExecutionAuthority(request.authority);
    if (request.authority.tenantId !== request.tenantId) throw new Error("secret_tenant_mismatch");
    if (request.authority.transactionId !== request.transactionId || request.authority.attemptId !== request.attemptId) {
      throw new Error("secret_attempt_mismatch");
    }

    await this.capabilityValidator.validate(reference, request);
    this.accessPolicy.authorize(request);
    request.authority.assertValid();
    await this.capabilityValidator.validate(reference, request);

    await this.capabilityValidatorStoreConsume(reference.capabilityId);
    request.authority.assertValid();

    return this.readSecretVersion(request);
  }

  private async capabilityValidatorStoreConsume(capabilityId: string): Promise<void> {
    // The validator owns validation semantics; its store is intentionally kept behind
    // the capability API in normal use. This method is replaced by the validator's
    // atomic consume hook in the next distributed-store implementation.
    const store = (this.capabilityValidator as unknown as { store?: { consume(id: string): Promise<unknown> } }).store;
    if (!store?.consume) throw new Error("secret_capability_consume_unavailable");
    await store.consume(capabilityId);
  }

  private async readSecretVersion(request: SecretAccessRequest): Promise<SecretMaterial> {
    const version = request.secretVersion?.trim() || this.secretVersion;
    if (!version) throw new Error("secret_version_required");
    const name = `projects/${this.projectId}/secrets/${request.secretId}/versions/${version}`;
    const [resolvedSecretVersion] = await this.client.accessSecretVersion({ name });
    request.authority.assertValid();

    const data = resolvedSecretVersion.payload?.data;
    if (!data) throw new Error("secret_payload_missing");
    const value = Buffer.from(data).toString("utf8").trim();
    if (!value) throw new Error("secret_payload_empty");

    const resolvedVersion = resolvedSecretVersion.name?.split("/").pop();
    if (!resolvedVersion) throw new Error("secret_version_missing");

    return Object.freeze({ secretId: request.secretId, version: resolvedVersion, value });
  }
}
