import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { createWifConfig } from "@/lib/enterprise/cloud-runtime";
import type { VaultProvider } from "@/lib/security/access-policy";

export type SecretRecord = {
  tenantId: string;
  provider: VaultProvider;
  name: string;
  value: string;
  version: number;
  rotatedAt: string;
};

export class EnterpriseSecretManager {
  private readonly store = new Map<string, SecretRecord>();
  private readonly gcpClient: SecretManagerServiceClient | null;

  constructor(gcpClient: SecretManagerServiceClient | null = null) {
    this.gcpClient = gcpClient;
  }

  static createGcpManager(): EnterpriseSecretManager {
    const wif = createWifConfig();
    const client = new SecretManagerServiceClient({
      projectId: wif.projectId,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    return new EnterpriseSecretManager(client);
  }

  async upsert(record: Omit<SecretRecord, "version" | "rotatedAt">): Promise<SecretRecord> {
    const key = `${record.tenantId}:${record.name}`;
    const existing = this.store.get(key);
    const next: SecretRecord = {
      ...record,
      version: (existing?.version ?? 0) + 1,
      rotatedAt: new Date().toISOString(),
    };

    if (record.provider === "gcp-secret-manager" && this.gcpClient) {
      const parent = `projects/${createWifConfig().projectId}`;
      await this.gcpClient.createSecret({
        parent,
        secretId: record.name,
        secret: {
          replication: {
            automatic: {},
          },
        },
      }).catch(() => undefined);
    }

    this.store.set(key, next);
    return next;
  }

  get(tenantId: string, name: string): SecretRecord | null {
    return this.store.get(`${tenantId}:${name}`) ?? null;
  }

  list(tenantId: string): SecretRecord[] {
    return [...this.store.values()].filter((secret) => secret.tenantId === tenantId);
  }
}

export const enterpriseSecretManager = new EnterpriseSecretManager();
