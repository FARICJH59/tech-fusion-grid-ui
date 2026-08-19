# Amazon Translate Integration

Amazon Translate is an optional AWS capability in the HOARE provider layer. It is not the HOARE policy engine and it does not replace AEGISC or HOARE authorization.

## Execution boundary

```text
Tenant/Agent intent
  -> HOARE planner
  -> AEGISC policy evaluation
  -> HOARE authorization
  -> AWS Translate adapter
  -> AWS IAM
  -> Amazon Translate
  -> verification
  -> evidence/audit
```

## Initial staging scope

The first staging integration is deliberately limited to:

- `translate:TranslateText`
- `translate:ListLanguages`

The supplied IAM summary indicates that Translate uses identity-based policies with the `translate:` action prefix, supports temporary credentials, and does not provide resource-based policies. Therefore the staging role must rely on identity policy + application authorization and must not imply that Translate itself provides a resource-policy isolation boundary.

## Security rules

1. Use the existing GitHub OIDC/IAM role; never add long-lived AWS access keys.
2. AEGISC must evaluate the translation intent before the adapter is invoked.
3. HOARE tenant authorization must be checked before execution.
4. Do not allow arbitrary IAM policy mutation through a translation request.
5. Do not grant `translate:*` when only text translation is required.
6. Treat `Resource: "*"` as an AWS service capability limitation where required, not as tenant authorization.
7. Record tenant, policy decision, operation, region, request metadata, outcome, and correlation ID in audit evidence. Do not store sensitive source text unless the tenant policy explicitly permits it.
8. Additional capabilities such as batch translation, custom terminology, parallel data, KMS, EventBridge, or PrivateLink require separate policy and validation gates.

## Validation gates

- IAM policy JSON review
- Typecheck/unit tests for the provider contract
- Negative test: unauthorized tenant cannot reach Translate
- Negative test: AEGISC-denied request cannot reach Translate
- Positive test after AWS account verification using temporary credentials
- Evidence record generated for successful and failed calls

## Commercial/Partner note

Amazon Translate integration can be documented as an AWS service dependency/capability for the HOARE reference solution after it is actually tested. This file does not claim AWS Partner Central approval, AWS Marketplace approval, FedRAMP, CMMC, ATO, or any other certification.
