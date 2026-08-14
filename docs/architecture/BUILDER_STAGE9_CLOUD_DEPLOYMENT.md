# Builder Stage 9 — Governed Cloud Deployment

Stage 9 adds a provider-neutral deployment boundary after Stage 8 artifact attestation.

## Execution contract

```text
Intent
  -> PASOR
  -> Simulation
  -> Governance
  -> Native Build
  -> Artifact Attestation
  -> Deployment Gate
  -> Provider Adapter
  -> Runtime
```

Deployment is denied unless the simulation is allowed, the artifact is attested, and provenance is verified.

## Cloud Run

`CloudRunDeploymentAdapter` deliberately depends on a small `CloudRunClient` interface. The builder therefore does not embed credentials or provider SDK initialization in the planning layer.

A production Cloud Run client should use workload identity / short-lived credentials and receive project configuration from the control plane. No long-lived service-account key belongs in the builder repository.

## Self-targeting

The same gate applies when the deployment target is HOARE itself. A self-update is simply another governed deployment request whose artifact, provenance, simulation, and authorization must pass the same checks.
