# Closed-Loop Self-Healing

HOARE self-healing is complete only when remediation, recovery verification, provenance, and metering share one governed execution boundary.

```text
Observe
  ↓
Diagnose
  ↓
Plan ExecutionUnit
  ↓
Simulate
  ↓
Govern
  ↓
Provenance + Quota
  ↓
Remediation Handler
  ↓
Runtime
  ↓
Recovery Verification
  ├── FAIL → no billable event
  └── PASS → metering / audit event
```

The orchestrator deliberately records a billable event only after recovery verification succeeds. A denied or failed remediation cannot become revenue merely because an execution handler was invoked.

Provider-specific effects remain behind the remediation handler/runtime adapter boundary. The orchestrator is a control-plane component, not a cloud SDK implementation.
