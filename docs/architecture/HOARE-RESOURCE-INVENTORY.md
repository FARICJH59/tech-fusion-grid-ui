# HOARE Resource Inventory

Phase 12 introduces a provider-neutral capability inventory boundary.

```text
Provider Adapter
      ↓
Capability Discovery
      ↓
Inventory Record
      ↓
Freshness / Integrity Validation
      ↓
Resource Planner
      ↓
Execution Adapter
```

Inventory is descriptive, not authoritative permission. A record can describe available compute, but HOARE policy and authorization remain the final gate before execution.

Each record carries observation/expiry timestamps and a fingerprint. Expired or malformed inventory must not be selected for placement.

Provider implementations can later include NVIDIA/Dynamo, GCP, AWS, Azure, Kubernetes, edge and disconnected environments without changing the Builder planner contract.
