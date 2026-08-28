export type AwsProviderConfig = {
  region: string;
  roleArn?: string;
  accountId?: string;
  environment: "staging" | "production";
};

export type AwsResourceReference = {
  provider: "aws";
  kind: string;
  id: string;
  region: string;
};

export type AwsProviderHealth = {
  provider: "aws";
  region: string;
  configured: boolean;
  identitySource: "iam-role" | "oidc" | "unknown";
};
