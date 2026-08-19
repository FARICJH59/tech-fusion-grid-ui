# HOARE ICS/OT Digital Twin Defense Layer

## Purpose

Add physics-aware Industrial Control System (ICS) and Industrial IoT (IIoT) attack detection to HOARE without turning the platform into a standalone ML detector.

The layer is designed for water, energy, manufacturing, chemical, and other safety-sensitive OT environments where telemetry distribution shifts, sensor manipulation, replay, false-data injection, and stealthy process attacks can defeat purely statistical or purely physics-based detection.

## Architectural rule

**ML detects. AEGIS reasons and constrains. SENTINEL policy-decides. HOARE orchestrates and executes.**

No detector is permitted to directly perform a security-sensitive mutation.

## Runtime flow

```text
PLC / RTU / SCADA / IIoT
        |
        v
Edge Gateway / MQTT
        |
        +------------------------------+
        |                              |
        v                              v
Digital Twin                    ML Ensemble
State Estimator                 Temporal / Attention /
Physics Model                   Anomaly / Classifier
        |                              |
        +---------------+--------------+
                        v
                 Evidence Fusion
                        |
                        v
              OT_ATTACK_ASSESSMENT
                        |
                        v
                     AEGIS
             reason / validate / fence
                        |
                        v
                    SENTINEL
             policy / approval gate
                        |
                        v
                     HOARE
          contain / recover / verify
                        |
                        v
                 Edge Enforcement
```

## Detection components

### 1. Digital Twin state estimator

Maintains the expected physical/process state from OT telemetry and process constraints. The twin produces predicted values, confidence, state-transition expectations, and physics residuals.

### 2. Physics residual engine

Computes deviations between observed and expected process behavior. Residuals are evidence, not an automatic verdict. This preserves safety when a process legitimately changes operating regime.

### 3. ML ensemble

Supports pluggable temporal and multimodal detectors. Initial model contracts should accommodate sequence anomaly detection, attention-based models, reconstruction models, and attack classification.

Model outputs must include model version, confidence, observation window, feature provenance, and calibration metadata.

### 4. Evidence fusion

Combines physics residuals, ML scores, temporal persistence, device identity, network context, and known process state into a normalized assessment. Fusion must preserve the individual evidence sources so AEGIS can reason over them instead of receiving an opaque score.

## Canonical event contract

The detector publishes an `OT_ATTACK_ASSESSMENT` event with at least:

- `event_id`
- `tenant_id`
- `site_id`
- `asset_id`
- `asset_type`
- `timestamp`
- `process_state`
- `observations`
- `digital_twin.expected_state`
- `digital_twin.residuals`
- `ml.models[]`
- `attack_hypotheses[]`
- `confidence`
- `severity`
- `evidence_refs[]`
- `source_revision`
- `model_versions[]`
- `trace_id`

The event is immutable evidence. Subsequent decisions reference the event rather than rewriting it.

## AEGIS boundary

AEGIS receives the assessment and evaluates executable defense contracts against it. AEGIS is responsible for:

- validating evidence integrity and provenance
- evaluating confidence and policy predicates
- enforcing capability restrictions
- requiring fencing for mutations
- requiring leases for time-bounded actions
- preventing unsafe or unauthorized OT commands
- producing a deterministic decision record

Example reasoning shape:

```text
IF
  asset.class == CRITICAL_OT
  AND assessment.attack_hypothesis == FALSE_DATA_INJECTION
  AND assessment.confidence >= policy.threshold
  AND digital_twin.residual_persistence >= policy.persistence
THEN
  permit capability "evidence.capture"
  require approval for capability "network.isolate"
ELSE
  escalate for operator review
```

The exact thresholds remain tenant/site policy; they are not hard-coded into the detector.

## SENTINEL boundary

SENTINEL converts AEGIS output into the applicable policy decision and approval state. Critical process actions remain approval-gated unless an explicit site policy authorizes autonomous execution.

## HOARE boundary

HOARE owns workflow orchestration, agent execution, evidence collection, containment coordination, recovery, and post-action verification.

A response workflow should follow:

1. receive assessment
2. validate identity and provenance
3. evaluate AEGIS contract
4. obtain SENTINEL authorization/approval state
5. execute only authorized capabilities
6. record command and outcome
7. re-sample the Digital Twin and telemetry
8. verify containment/recovery
9. close or escalate the incident

## Safety invariants

- Detection never directly mutates a PLC, RTU, SCADA host, network route, or safety system.
- A low-confidence ML score cannot bypass AEGIS policy.
- Physics residuals are evidence and cannot independently authorize destructive actions.
- Critical OT actions are approval-gated unless explicitly authorized by site policy.
- Every mutation is tenant/site scoped, identity checked, fenced, leased where appropriate, and audited.
- Model outputs are versioned and reproducible.
- Evidence remains append-only and traceable to its source observation window.
- Loss of the Digital Twin or ML service fails toward safe observation/escalation, not autonomous destructive action.

## Edge deployment profile

The detection layer must support deployment close to the process. Small sites can use constrained edge hardware; larger and critical sites can use GPU-capable industrial edge nodes. Cloud services may provide model training, fleet analytics, and management, but the core safety decision path must not require continuous cloud availability.

## Performance target

The cited research demonstrates approximately 25 ms inference latency on its benchmark configuration. That number is a research result, not a HOARE production guarantee. HOARE should therefore expose latency and confidence as measured runtime telemetry and establish site-specific service-level thresholds through validation.

## Implementation sequence

### Phase A — Contracts

- Define `OT_ATTACK_ASSESSMENT` schema.
- Define Digital Twin state and residual interfaces.
- Define detector adapter interface.
- Define AEGIS assessment predicates.

### Phase B — Detection runtime

- Implement state-estimator adapter.
- Implement physics-residual adapter.
- Implement pluggable ML ensemble adapter.
- Implement evidence fusion.

### Phase C — Defense integration

- Route assessments into AEGIS.
- Route AEGIS decisions into SENTINEL.
- Route authorized capabilities into HOARE.
- Connect to the existing edge enforcement path.

### Phase D — Validation

- Replay SWaT/WADI/Tennessee Eastman traces through the detection contract.
- Test false-data injection, replay, stealth/null-space, benign distribution shift, sensor dropout, and communication loss.
- Verify that detection evidence cannot bypass AEGIS/SENTINEL controls.
- Measure end-to-end latency at the target edge hardware rather than copying published benchmark latency.

## Non-goals

This layer does not replace AEGIS, SENTINEL, HOARE, the Edge Gateway, or MQTT. It also does not treat a published F1 score as a production security guarantee. The objective is to integrate physics-aware and ML evidence into the existing governed autonomous-defense control plane.