import { enterpriseSecretManager } from "@/lib/security/secret-manager";

export type RotationRecord = {
  tenantId: string;
  secretName: string;
  previousVersion: number;
  newVersion: number;
  timestamp: string;
};

export class CredentialRotationEngine {
  private readonly rotations: RotationRecord[] = [];

  async rotate(tenantId: string, secretName: string, newValue: string): Promise<RotationRecord | null> {
    const current = enterpriseSecretManager.get(tenantId, secretName);
    if (!current) return null;

    const updated = await enterpriseSecretManager.upsert({
      tenantId,
      provider: current.provider,
      name: secretName,
      value: newValue,
    });

    const rotation: RotationRecord = {
      tenantId,
      secretName,
      previousVersion: current.version,
      newVersion: updated.version,
      timestamp: new Date().toISOString(),
    };

    this.rotations.push(rotation);
    return rotation;
  }

  history(tenantId: string): RotationRecord[] {
    return this.rotations.filter((item) => item.tenantId === tenantId);
  }
}

export const credentialRotationEngine = new CredentialRotationEngine();
