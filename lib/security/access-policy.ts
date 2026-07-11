export type VaultProvider = "gcp-secret-manager" | "vault-compatible" | "aws-secrets-manager" | "azure-key-vault";

export type SecretAccessPolicy = {
  tenantId: string;
  secretName: string;
  provider: VaultProvider;
  allowedRoles: string[];
  leastPrivilege: boolean;
};

export class AccessPolicyRegistry {
  private readonly policies = new Map<string, SecretAccessPolicy>();

  set(policy: SecretAccessPolicy): void {
    this.policies.set(`${policy.tenantId}:${policy.secretName}`, policy);
  }

  get(tenantId: string, secretName: string): SecretAccessPolicy | null {
    return this.policies.get(`${tenantId}:${secretName}`) ?? null;
  }

  isAllowed(tenantId: string, secretName: string, role: string): boolean {
    const policy = this.get(tenantId, secretName);
    if (!policy) return false;
    return policy.allowedRoles.includes(role);
  }

  list(): SecretAccessPolicy[] {
    return [...this.policies.values()];
  }
}

export const accessPolicyRegistry = new AccessPolicyRegistry();
