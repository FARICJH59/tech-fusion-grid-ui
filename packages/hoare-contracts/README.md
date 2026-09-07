# @hoare/contracts

Canonical interfaces shared by HOARE Intelligence, AgentFusion, AEGIS, PASOR, TCX, Evidence, Reconciliation, and Commit.

## Non-negotiable semantic boundaries

- Intelligence capability does not imply runtime capability.
- Runtime capability does not imply authorization.
- Authorization does not imply formal proof.
- Proof does not imply TCX admission.
- TCX admission does not imply execution success.
- Execution success does not imply commit.
- Evidence verification does not replace reconciliation.
- Reconciliation must match approved intent/state before finalization.

## Execution predicate

`canExecute()` requires intelligence, runtime, authorization, policy, proof, TCX admission, and a valid fence.

## Commit predicate

`canCommit()` requires completed execution, verified evidence, a matching reconciliation, valid state version, and finalization authority.

## Provenance

This package is introduced on `hoare/canonical-contracts-20260904`, based on the reconciled AgentFusion target lineage at `6ef7b70b4e89f3dad3277e5d9353374b1bf0c5d8`. Source lineages remain unchanged.

Timestamp: 2026-09-04T17:09:00-04:00
