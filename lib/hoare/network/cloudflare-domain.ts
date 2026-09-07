export type CloudflareDomainConfig = Readonly<{
  hostname: string;
  zoneId: string;
}>;

/**
 * Reads explicit Cloudflare domain configuration without embedding a domain or
 * credential in source control. DNS/TLS mutations remain governed live side effects.
 */
export function getCloudflareDomainConfig(env: NodeJS.ProcessEnv = process.env): CloudflareDomainConfig | null {
  const hostname = env.HOARE_PUBLIC_DOMAIN?.trim();
  const zoneId = env.CLOUDFLARE_ZONE_ID?.trim();
  if (!hostname || !zoneId) return null;
  if (hostname.length > 253 || !hostname.includes(".")) {
    throw new Error("cloudflare_domain_invalid");
  }
  return { hostname: hostname.toLowerCase().replace(/\.$/, ""), zoneId };
}
