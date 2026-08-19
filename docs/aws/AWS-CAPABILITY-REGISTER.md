# HOARE AWS Capability Register

Amazon Translate is registered as an optional capability, not a core dependency.

| Capability | Stage | Security gate | Commercial role |
|---|---|---|---|
| Amazon Translate | Staging design | AEGISC + HOARE authorization + IAM | Optional multilingual operations add-on |

## Rule

New AWS services must not be added solely because they are available. Each capability must have:

1. a concrete HOARE use case;
2. a provider adapter boundary;
3. least-privilege IAM;
4. positive and negative tests;
5. audit/evidence behavior;
6. a clear tenant-isolation story;
7. a documented commercial purpose.

This prevents HOARE from becoming an uncontrolled collection of AWS service integrations.
