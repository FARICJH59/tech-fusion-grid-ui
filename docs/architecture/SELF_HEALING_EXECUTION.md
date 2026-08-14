# Self-Healing Execution Boundary

HOARE self-healing uses the canonical execution model. Remediation commands are allowlisted and registered as handlers; the handler layer does not bypass PASOR simulation, governance, quota, provenance, or metering.

```text
Incident
  ↓
Diagnosis / remediation plan
  ↓
ExecutionUnit
  ↓
PASOR dispatcher
  ↓
Simulation + governance + quota + provenance
  ↓
Remediation handler
  ↓
Runtime
  ↓
Recovery verification
```

Supported command vocabulary:

- `runtime.restart`
- `runtime.scale`
- `runtime.rollback`
- `runtime.isolate`

The registry is intentionally allowlisted. Adding a new remediation capability requires an explicit handler and tests rather than accepting arbitrary command strings.

The default handlers represent a governed execution handoff. Provider-specific side effects remain behind runtime/provider adapters and are not embedded in the policy or planning layer.
