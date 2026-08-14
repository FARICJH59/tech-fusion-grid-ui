# HOARE Self-Healing Control Loop

HOARE self-healing is an operational remediation capability, distinct from self-targeting platform evolution.

```text
Telemetry / Health
       ↓
Incident Detection
       ↓
Diagnosis / Severity
       ↓
Remediation Planner
       ↓
ExecutionUnit
       ↓
Simulation
       ↓
Governance / Authorization
       ↓
Execute
       ↓
Verify Recovery
   ┌───┴────┐
   │        │
 PASS     FAIL
   │        │
   ↓        ↓
Recover   bounded retry
            ↓
         Escalate
```

The controller uses an allowlisted remediation vocabulary (`restart`, `scale`, `rollback`, `isolate`) and creates deterministic simulation/provenance hashes for remediation units.

No remediation executes when simulation or authorization denies it. Recovery is verified after execution, and retries are bounded to prevent uncontrolled remediation loops.

Existing incident/remediation infrastructure remains the provider/runtime layer; this builder controller defines the governed decision boundary that can feed those mechanisms.

## Relationship to self-targeting

- **Self-healing:** repair an operational fault in a running system.
- **Self-targeting:** intentionally modify/build/release HOARE itself.

A self-targeting change may eventually use the self-healing loop when a candidate deployment fails verification, but ordinary operational remediation should not mutate HOARE source code.
