import type { AwsProviderConfig, AwsProviderHealth, AwsResourceReference } from "./types";

/**
 * Provider-neutral AWS boundary.
 *
 * This module deliberately does not perform cloud mutations. It provides the
 * configuration and identity boundary that concrete AWS SDK adapters can use.
 */
export class AwsProvider {
  constructor(private readonly config: AwsProviderConfig) {}

  health(): AwsProviderHealth {
    const identitySource = this.config.roleArn
      ? "iam-role"
      : process.env.AWS_ROLE_ARN
        ? "oidc"
        : "unknown";

    return {
      provider: "aws",
      region: this.config.region,
      configured: Boolean(this.config.region && identitySource !== "unknown"),
      identitySource,
    };
  }

  reference(kind: string, id: string): AwsResourceReference {
    if (!kind.trim() || !id.trim()) {
      throw new Error("AWS resource kind and id are required");
    }

    return {
      provider: "aws",
      kind: kind.trim(),
      id: id.trim(),
      region: this.config.region,
    };
  }
}

export function createAwsProvider(
  config: AwsProviderConfig = {
    region: process.env.AWS_REGION ?? "us-east-1",
    roleArn: process.env.AWS_ROLE_ARN,
    accountId: process.env.AWS_ACCOUNT_ID,
    environment: process.env.NODE_ENV === "production" ? "production" : "staging",
  },
): AwsProvider {
  return new AwsProvider(config);
}
