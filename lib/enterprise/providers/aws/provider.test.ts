import test from "node:test";
import assert from "node:assert/strict";
import { AwsProvider } from "./provider";

test("AWS provider fails closed when no identity is configured", () => {
  const provider = new AwsProvider({
    region: "us-east-1",
    environment: "staging",
  });

  const health = provider.health();
  assert.equal(health.provider, "aws");
  assert.equal(health.configured, false);
  assert.equal(health.identitySource, "unknown");
});

test("AWS provider recognizes an IAM role without performing mutations", () => {
  const provider = new AwsProvider({
    region: "us-east-1",
    roleArn: "arn:aws:iam::123456789012:role/hoare-staging",
    environment: "staging",
  });

  const health = provider.health();
  assert.equal(health.configured, true);
  assert.equal(health.identitySource, "iam-role");

  assert.deepEqual(provider.reference("evidence", "staging-evidence"), {
    provider: "aws",
    kind: "evidence",
    id: "staging-evidence",
    region: "us-east-1",
  });
});

test("AWS resource references reject empty identifiers", () => {
  const provider = new AwsProvider({
    region: "us-east-1",
    roleArn: "arn:aws:iam::123456789012:role/hoare-staging",
    environment: "staging",
  });

  assert.throws(() => provider.reference("", "resource"));
  assert.throws(() => provider.reference("resource", ""));
});
