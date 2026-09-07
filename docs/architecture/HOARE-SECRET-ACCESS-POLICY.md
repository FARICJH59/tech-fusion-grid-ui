# HOARE Secret Access Policy Engine

The Secret Access Policy Engine is the authorization layer between TCX execution authority and a concrete secret-provider read.

## Decision model

A secret read is allowed only when all of the following match:

- tenant
- Google Cloud project
- secret identifier
- environment
- operation (`read`, `inject`, `rotate`, or `revoke`)
- agent identity
- workload identity
- optional node identity
- optional runtime kind
- optional pinned secret version
- live, issuer-created TCX execution authority

The engine denies by default when no exact policy exists.

## Enforcement order

1. Validate the runtime-branded TCX authority.
2. Validate transaction and attempt identity against the authority.
3. Resolve the exact tenant/project/secret/environment policy.
4. Enforce operation, agent, workload, node, runtime, and version constraints.
5. Revalidate TCX authority immediately before the provider call.
6. The provider performs the external Secret Manager read.
7. Revalidate TCX authority immediately after the provider call.

A policy denial occurs before the external secret provider is invoked.

## Defense in depth

The GCP provider retains its static tenant-to-secret binding in addition to the policy engine. This prevents a policy configuration from widening access beyond the explicitly bound tenant secret set.

Google Cloud IAM remains a separate enforcement layer. The runtime identity should receive only the minimum Secret Manager permission needed, ideally at the individual secret rather than project level. Google documents that `roles/secretmanager.secretAccessor` can be granted directly on a secret and recommends lowest-level grants for least privilege. citeturn0search0turn0search4

## Secret material handling

Policy decisions contain identifiers and outcomes only. Secret values must never be placed in:

- dispatch envelopes
- durable execution receipts
- authorization records
- policy records
- audit events
- source control
- normal logs or traces

Secret Manager access continues to use ADC/WIF rather than long-lived service-account keys. Google recommends workload identity federation for workloads authenticating to Google Cloud from another cloud or outside Google Cloud. citeturn0search4turn0search9

## Versioning

Production deployments should prefer explicit secret versions where deterministic execution is required. The provider accepts an optional request-level version and otherwise uses its configured default.

## Future extensions

The policy schema is intentionally extensible for:

- lease-duration and expiration constraints
- mission/vertical binding
- purpose binding
- customer-managed vault backends
- short-lived secret capability handles
- governed secret rotation workflows
- secret-access anomaly detection
