# HOARE Builder Stage 8 — Artifact Verification and Attestation

Stage 8 establishes the trust boundary between native build execution and downstream deployment.

## Flow

`Intent → PASOR → Simulation → Governance → Dispatch → Native Build → Artifact Attestation → Deployment`

A successful native build is not automatically deployable. The artifact must be hashed and bound to the execution unit and provenance record first.

## Invariants

- artifact bytes are hashed with SHA-256;
- the attestation binds the unit, command, artifact path, artifact digest, and provenance hash;
- identical inputs produce identical attestation hashes;
- deployment should consume only verified attestations;
- billing remains downstream of successful governed execution.

This keeps C++, AEGISC, Python, Node, Cloud Run, edge, and future providers behind the same artifact trust boundary.
