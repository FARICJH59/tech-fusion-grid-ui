import type { DomainResource, ProviderKind } from "./types";

export interface DnsRecord {
  name: string;
  type: "A" | "AAAA" | "CNAME" | "TXT" | "MX";
  value: string;
  ttl?: number;
}

export interface DomainProvider {
  readonly kind: ProviderKind;
  verifyDomain(domain: string): Promise<boolean>;
  ensureDnsRecord(domain: string, record: DnsRecord): Promise<void>;
  ensureTls(domain: string): Promise<void>;
}

/** Provider-neutral domain orchestration. Credentials stay outside the repository. */
export class DomainManager {
  constructor(private readonly providers: Partial<Record<ProviderKind, DomainProvider>>) {}

  async reconcile(resource: DomainResource, record?: DnsRecord): Promise<DomainResource> {
    const provider = this.providers[resource.provider];
    if (!provider) throw new Error(`No provider registered for ${resource.provider}`);

    const verified = await provider.verifyDomain(resource.hostname);
    if (!verified) return { ...resource, verified: false, status: "pending" };

    if (record) await provider.ensureDnsRecord(resource.hostname, record);
    await provider.ensureTls(resource.hostname);

    return { ...resource, verified: true, tlsManaged: true, status: "active" };
  }
}
