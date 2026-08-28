import type {
  AwsProviderConfig,
  AwsProviderHealth,
  AwsResourceReference,
} from "./types";

/**
 * Provider-neutral AWS boundary.
 *
 * This module deliberately does not perform cloud mutations. It provides the
 * configuration and identity boundary that concrete AWS SDK adapters can use.
 */
export class AwsProvider {
  private readonly normalizedRegion: string;
  private readonly normalizedRoleArn?: string;

  constructor(private readonly config: AwsProviderConfig) {
    const region = config.region.trim();

    if (!region) {
      throw new Error("AWS region is required");
    }

    const roleArn = config.roleArn?.trim();

    if (roleArn && !AwsProvider.isValidRoleArn(roleArn)) {
      throw new Error("AWS role ARN is invalid");
    }

    this.normalizedRegion = region;
    this.normalizedRoleArn = roleArn || undefined;
  }

  private static isValidRoleArn(value: string): boolean {
    return /^arn:aws:iam::\d{12}:role\/[\w+=,.@-]+(?:\/[\w+=,.@-]+)*$/.test(
      value,
    );
  }

  private static getEnvironmentRoleArn(): string | undefined {
    const value = process.env.AWS_ROLE_ARN?.trim();

    if (!value) {
      return undefined;
    }

    return AwsProvider.isValidRoleArn(value) ? value : undefined;
  }

  health(): AwsProviderHealth {
    const environmentRoleArn = AwsProvider.getEnvironmentRoleArn();

    const identitySource = this.normalizedRoleArn
      ? "iam-role"
      : environmentRoleArn
        ? "oidc"
        : "unknown";

    return {
      provider: "aws",
      region: this.normalizedRegion,
      configured: identitySource !== "unknown",
      identitySource,
    };
  }

  reference(kind: string, id: string): AwsResourceReference {
    const normalizedKind = kind.trim();
    const normalizedId = id.trim();

    if (!normalizedKind || !normalizedId) {
      throw new Error("AWS resource kind and id are required");
    }

    return {
      provider: "aws",
      kind: normalizedKind,
      id: normalizedId,
      region: this.normalizedRegion,
    };
  }
}

export function createAwsProvider(
  config: AwsProviderConfig = {
    region: process.env.AWS_REGION ?? "us-east-1",
    roleArn: process.env.AWS_ROLE_ARN,
    accountId: process.env.AWS_ACCOUNT_ID,
    environment:
      process.env.NODE_ENV === "production" ? "production" : "staging",
  },
): AwsProvider {
  return new AwsProvider(config);
}
