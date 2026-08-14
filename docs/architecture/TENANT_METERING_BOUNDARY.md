# Tenant Metering Boundary

Billing is downstream of authorization and successful execution.

```text
Tenant Scope
   ↓
Simulation / Governance / Quota / Provenance
   ↓
Execution
   ↓
Recovery or Success Verification
   ↓
Tenant Metering Event
   ↓
Billing / Revenue Sink
```

Each billable event is bound to the tenant, project, target, environment, execution unit, command, action, outcome, quantity, timestamp, and provenance hash.

The builder owns the provider-neutral metering contract. A production billing adapter may persist these events to the existing enterprise billing/revenue system or another approved billing provider.

Events are deterministic and idempotently accepted so retries cannot double-count the same execution event.

Denied, failed, or unverified operations must never be converted into billable events.
