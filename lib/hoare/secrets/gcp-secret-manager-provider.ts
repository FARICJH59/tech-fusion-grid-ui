import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { assertTcxExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";
import type { SecretAccessRequest, SecretMaterial, SecretProvider } from "./secret-provider";

export type GcpSecretManagerClient = Pick<SecretManagerServiceClient, "accessSecretVersion">;

export type GcpSecretManagerProviderOptions = Readonly<{
  projectId: string;
  client?: GcpSecretManagerClient;
  secretVersion?: string;
  tenantSecretBinding: ReadonlyMap<string, ReadonlySet<string>>;
}>;

/**
 * Governed read boundary for tenant secrets stored in Google Secret Manager.
 * Secret material is returned only after TCX authority and tenant/project bindings pass.
 */
export class GcpSecretManagerProvider implements SecretProvider {
  private readonly projectId: string;
  private readonly client: GcpSecretManagerClient;
  private readonly secretVersion: string;
  private readonly tenantSecretBinding: ReadonlyMap<string, ReadonlySet<string>>;

  constructor(options: GcpSecretManagerProviderOptions) {
    if (!options.projectId.trim()) throw new Error("secret_manager_project_required");
    this.projectId = options.projectId.trim();
    this.client = options.client ?? new SecretManagerServiceClient();
    this.secretVersion = options.secretVersion?.trim() || "latest";
    this.tenantSecretBinding = options.tenantSecretBinding;
  }

  async getSecret(request: SecretAccessRequest): Promise<SecretMaterial> {
    const allowedSecrets = this.tenantSecretBinding.get(request.tenantId);
    if (!allowedSecrets?.has(request.secretId)) {
      throw new Error("secret_tenant_binding_invalid");
    }

    assertTcxExecutionAuthority(request.authority);
    if (request.authority.tenantId !== request.tenantId) throw new Error("secret_tenant_mismatch");
    if (request.authority.transactionId !== request.transactionId || request.authority.attemptId !== request.attemptId) {
      throw new Error("secret_attempt_mismatch");
    }

    request.authority.assertValid();
    const name = `projects/${encodeURIComponent(this.projectId)}/secrets/${encodeURIComponent(request.secretId)}/versions/${encodeURIComponent(this.secretVersion)}`;
    const [version] = await this.client.accessSecretVersion({ name });
    request.authority.assertValid();

    const data = version.payload?.data;
    if (!data) throw new Error("secret_payload_missing");
    const value = Buffer.from(data).toString("utf8").trim();
    if (!value) throw new Error("secret_payload_empty");

    const resolvedVersion = version.name?.split("/").pop();
    if (!resolvedVersion) throw new Error("secret_version_missing");

    return Object.freeze({ secretId: request.secretId, version: resolvedVersion, value });
  }
}
