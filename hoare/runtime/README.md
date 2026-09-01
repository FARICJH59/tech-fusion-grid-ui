# HOARE Agent Runtime Foundation

This module provides a provider-neutral execution contract for HOARE agents.

## Contract

Every agent has a manifest containing identity, version, capabilities, compliance metadata, security mode, transport, and tenant-safe metadata.

Every invocation receives an execution context containing `execution_id`, `tenant_id`, `actor`, `trace_id`, policy context, and timestamp.

Every invocation returns a normalized observation with `schema_version`, agent identity, execution identity, status, result/error, and observation time.

## Why this matters

Shelf-Scouter is one implementation of the contract, not the contract itself. The same runtime can host grid, cybersecurity, compliance, learning, industrial, healthcare, logistics, or future agents while keeping governance and observability consistent.

This layer is intentionally additive and does not replace existing MQTT, camera, vision, or control-plane implementations.
