import { accessPolicyRegistry, type VaultProvider } from "@/lib/security/access-policy";
import { enterpriseSecretManager } from "@/lib/security/secret-manager";

export type VaultAccessAudit = {
  tenantId: string;
  secretName: string;
  actor: string;
  action: "read" | "write";
  granted: boolean;
  timestamp: string;
};

export class TenantVault {
  private readonly audit: VaultAccessAudit[] = [];

  async putSecret(input: {
    tenantId: string;
    provider: VaultProvider;
    secretName: string;
    value: string;
    actorRole: string;
    actor: string;
  }): Promise<boolean> {
    const allowed = accessPolicyRegistry.isAllowed(input.tenantId, input.secretName, input.actorRole);
    this.audit.push({
      tenantId: input.tenantId,
      secretName: input.secretName,
      actor: input.actor,
      action: "write",
      granted: allowed,
      timestamp: new Date().toISOString(),
    });

    if (!allowed) return false;

    await enterpriseSecretManager.upsert({
      tenantId: input.tenantId,
      provider: input.provider,
      name: input.secretName,
      value: input.value,
    });
    return true;
  }

  getSecret(input: { tenantId: string; secretName: string; actorRole: string; actor: string }): string | null {
    const allowed = accessPolicyRegistry.isAllowed(input.tenantId, input.secretName, input.actorRole);
    this.audit.push({
      tenantId: input.tenantId,
      secretName: input.secretName,
      actor: input.actor,
      action: "read",
      granted: allowed,
      timestamp: new Date().toISOString(),
    });

    if (!allowed) return null;
    return enterpriseSecretManager.get(input.tenantId, input.secretName)?.value ?? null;
  }

  listAudit(): VaultAccessAudit[] {
    return [...this.audit];
  }
}

export const tenantVault = new TenantVault();
