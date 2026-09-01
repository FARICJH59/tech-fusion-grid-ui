# HOARE Builder — Resource Planner

## Purpose

The resource planner converts a governed Builder Capability Plan into an eligible infrastructure target without coupling HOARE to a specific provider.

## Decision boundary

HOARE owns:

- intent
- requirements
- security constraints
- SLO constraints
- candidate eligibility
- deterministic target scoring
- audit-ready reasons

Provider adapters own:

- provisioning
- deployment
- provider-specific APIs
- accelerator lifecycle
- inference runtime configuration

## Flow

```text
Builder Intent
    -> Builder Plan
    -> Capability Plan
    -> Resource Planner
    -> Eligible Targets
    -> Selected Target
    -> Provider Adapter
    -> Governed Execution
    -> Verification
```

NVIDIA Dynamo, GCP, AWS, Azure, Kubernetes, edge and air-gapped targets are substrates. The planner does not provision them directly.

## Security rule

A classified workload cannot select a target that permits egress. This is enforced as an eligibility constraint before target scoring.

## Future extension

The next layer should replace static `ResourceTarget` inventories with signed/provider-reported capability inventory and introduce policy-aware placement, capacity state, health, and live cost data. Selection must remain deterministic and explainable before execution authorization.
