# HOARE Phase 10D — Owned Runtime Lifecycle

Phase 10D adds a HOARE-owned runtime supervisor contract above the persistent runtime store.

## Lifecycle

`stopped -> starting -> running -> stopping -> stopped`

A restart increments the runtime generation and produces a new runtime digest.

## API

- `GET /api/hoare/runtime/:deploymentId` — inspect runtime lifecycle and manifest.
- `POST /api/hoare/runtime/:deploymentId` with `{ "action": "start" | "stop" | "restart" }` — transition the runtime.
- `GET /api/hoare/runtime/:deploymentId/health` — health/state snapshot.

The supervisor currently manages durable lifecycle state. The next execution adapter will bind these lifecycle transitions to an actual isolated process/container/VM runner. This keeps the HOARE control-plane contract independent from any particular compute provider.
