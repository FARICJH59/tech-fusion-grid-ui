# Builder Stage 10 — Deployment Verification

Stage 10 adds deterministic post-deployment verification to the builder deployment boundary.

Verification binds the execution unit, deployment identity, artifact digest, provenance hash, expected revision, observed revision, and health result into a SHA-256 verification hash.

A deployment is verified only when:

1. health verification succeeds;
2. an expected revision, when supplied, matches the observed revision;
3. the artifact digest is valid;
4. the provenance hash is valid.

The existing `CloudRunController` remains responsible for provider lifecycle and automatic rollback. The builder verifier is an independent evidence layer: a deployment that fails verification must not be represented as successfully deployed to the builder's provenance/metering layer.

```text
Builder Deployment Gate
        |
        v
CloudRunController
        |
        v
Cloud Run rollout
        |
        v
Health + revision observation
        |
        v
DeploymentVerifier
   |             |
 verified     rejected
   |             |
   v             v
provenance    rollback / failure
metering
```

This same verification path applies to future self-targeting HOARE deployments.
