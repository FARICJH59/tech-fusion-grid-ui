# Agent SDK

Phase 9B Agent SDK foundation for Tech Fusion Grid + HOARE.ai.

## Modules

- `agent.ts` — standardized agent contract and registry
- `capability.ts` — capability definitions and versioned registry
- `tool.ts` — tool abstraction and execution registry
- `memory.ts` — memory contracts and in-memory provider
- `workflow.ts` — workflow definitions and validation
- `permission.ts` — tenant-aware permission evaluation contract
- `evaluation.ts` — evaluation metrics and scoring contract
- `context.ts` — execution context types
- `events.ts` — agent event bus contract

## Design intent

This package is additive and adapter-first. It standardizes contracts between HOARE-Agent Core, AgentFusion Runtime, industry agents, enterprise tools, and external workflows without changing existing production behavior.
