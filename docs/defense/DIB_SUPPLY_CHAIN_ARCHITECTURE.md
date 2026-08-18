# HOARE Defense — DIB Supply Chain Intelligence

## Purpose

The DIB Supply Chain service adds a defense mission layer for Defense Industrial Base supply-chain visibility, risk assessment, resilience analysis, and governed response planning.

This capability is intentionally additive. It does not replace the HOARE control plane, agent runtime, authorization engine, security layer, runbook registry, audit/evidence systems, or cloud/edge adapters.

## Capability boundary

```text
External / customer supply-chain data
              |
              v
     DIB Supply Graph
              |
              v
     Risk Assessment Engine
       |       |       |
       |       |       +--> Provenance gaps
       |       +----------> Single-source / resilience
       +------------------> Ownership / adversarial exposure
              |
              v
       Governed Action Plan
              |
              v
   HOARE Authorization / Policy
              |
              v
       HOARE Runtime / Runbooks
              |
              v
       Evidence + Audit Trail
```

## Initial v1 capabilities

- Multi-tier supplier/component/program/mission graph contracts.
- Deterministic risk scoring for foreign control, adversarial source, single-source dependency, geographic concentration, critical components, and provenance gaps.
- Critical-node identification for downstream mission-impact assessment.
- Action planning for supplier review, provenance requests, alternate-source analysis, and mission-impact assessment.
- Explicit approval requirements for actions that should not be autonomously executed.
- Tenant isolation through the existing HOARE control-plane authentication boundary.

## What v1 does not claim

The service does not manufacture external supplier intelligence. It consumes customer-provided or adapter-provided data. External commercial/government datasets belong behind provider-neutral intelligence adapters.

The service also does not directly execute supplier changes. It produces a governed action plan that can be handed to the existing HOARE authorization, runtime, and runbook layers.

## API

`GET /api/defense/dib/supply-chain`

Returns the service contract and tenant-scoped capability metadata.

`POST /api/defense/dib/supply-chain`

Accepts a tenant-scoped `graph` containing `nodes` and `edges`, performs the deterministic assessment, and returns risk findings plus an action plan.

## Strategic rationale

DIU has already transitioned Supply Chain Illumination solutions into its commercial solutions catalog, including Altana AI's 2024 AI/ML solution. DoD's FY2026 budget also identifies resilient supply chains and investment to buy down supply-chain risk as DIB priorities.

HOARE's differentiation is therefore not another standalone supply-chain map. The value is connecting supply-chain intelligence to governed enterprise execution: identity, policy, authorization, agents, runbooks, audit/evidence, and cloud/edge operations.
