import type { AwsProviderConfig, AwsProviderHealth, AwsResourceReference } from "./types";

/**
 * Provider-neutral AWS boundary.
 *
 * This module deliberately does not perform cloud mutations. It provides the
 * configuration and identity boundary that concrete AWS SDK adapters can use.
 */
export class AwsProvider {
  private readonly region: string;
  private readonly roleArn?: string;

  constructor(private readonly config: AwsProviderConfig) {
    const region = config.region.trim();
    const roleArn = config.roleArn?.trim();

    if (!region || !/^[a-z]{2}(?:-[a-z0-9]+)+-\d+$/.test(region)) {
      throw new Error("A valid AWS region is required");
    }

    if (roleArn && !/^arn:aws(?:-[a-z0-9-]+)?:iam::\d{12}:role\/[A-Za-z0-9+=,.@_\/-]+$/.test(roleArn)) {
      throw new Error("A valid AWS IAM role ARN is required");
    }

    this.region = region;
    this.roleArn = roleArn;
  }

  health(): AwsProviderHealth {
    const ambientRoleArn = process.env.AWS_ROLE_ARN?.trim();
    const identitySource = this.roleArn
      ? "iam-role"
      : ambientRoleArn && /^arn:aws(?:-[a-z0-9-]+)?:iam::\d{12}:role\/[A-Za-z0-9+=,.@_\/-]+$/.test(ambientRoleArn)
        ? "oidc"
        : "unknown";

    return {
      provider: "aws",
      region: this.region,
      configured: identitySource !== "unknown",
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
      region: this.region,
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
