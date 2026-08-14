# HOARE Builder Release Gate

The release gate is the final decision boundary between a built candidate and an approved release.

```text
CI
 ↓
Simulation
 ↓
Governance
 ↓
Artifact Attestation
 ↓
Provenance Verification
 ↓
Deployment Verification
 ↓
RELEASE
```

Every prerequisite is explicit. A successful provider deployment alone is insufficient.

For self-targeting HOARE updates, the candidate must pass the same gate before it can replace the currently active platform.

This gate is intentionally separate from billing. Billing records successful, authorized execution; it does not grant deployment authority.
