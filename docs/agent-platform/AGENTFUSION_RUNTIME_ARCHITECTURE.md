# AgentFusion Runtime Architecture

## Runtime architecture

Phase 9C adds an additive AgentFusion Runtime layer under `agentfusion/` that sits between the existing Tech Fusion Grid experience layer, HOARE.ai applications, the Agent SDK, HOARE-Agent Core, industry agents, and enterprise integrations.

Core runtime components:

- `agentfusion/runtime/agent-runtime.ts` — orchestration entry point for load, validate, execute, monitor, and failure handling
- `agentfusion/registry/agent-registry.ts` — tenant-aware agent registration, discovery, versioning, metadata, capability lookup, and status tracking
- `agentfusion/lifecycle/agent-lifecycle.ts` — lifecycle transitions with policy, audit, and tenant isolation controls
- `agentfusion/workflows/workflow-runtime.ts` — sequential, parallel, conditional, approval-aware, and recovery-capable workflow execution
- `agentfusion/memory/memory-runtime.ts` — Redis-backed short-term memory and Supabase-backed long-term memory adapters using existing platform abstractions
- `agentfusion/security/security-runtime.ts` — RBAC, ABAC, policy engine, approval workflow, audit, and tenant-boundary enforcement
- `agentfusion/evaluation/evaluation-runtime.ts` — quality scoring, reliability metrics, latency, cost, token usage, failures, and tool efficiency tracking

## Execution lifecycle

1. Agent discovery resolves the latest matching tenant-scoped registry record.
2. Context creation merges SDK defaults with tenant, actor, and entitlement-aware execution metadata.
3. Security enforcement evaluates tenant boundaries, RBAC/ABAC, and Phase 8 policy controls before any action runs.
4. Execution dispatch runs tool calls, workflow steps, or registered handlers.
5. Workflow execution supports sequential and parallel branches plus approval checkpoints and recovery hooks.
6. Result handling records evaluation metrics and agent history.
7. Event emission publishes AgentFusion lifecycle and execution signals through the existing autonomous event bus and operations SSE snapshot flow.

## Security model

AgentFusion reuses existing platform controls rather than creating a new auth system:

- `EnterpriseSecurity` for RBAC and ABAC enforcement
- `AutonomousPolicyEngine` for policy-gated cloud actions
- `ApprovalFlow` and `operatorActionQueue` for approval workflows
- existing runtime state persistence for durable audit records
- tenant-boundary checks on every lifecycle and execution request

Every agent action produces an audit record with:

- agent
- tenant
- action
- resource
- decision
- timestamp
- reason

## Event model

AgentFusion publishes these runtime events through the existing event infrastructure:

- `AgentRegistered`
- `AgentActivated`
- `AgentExecutionStarted`
- `AgentExecutionCompleted`
- `AgentExecutionFailed`
- `AgentApprovalRequired`
- `AgentDisabled`

These are bridged onto the existing autonomous event bus as:

- `agent-registered`
- `agent-activated`
- `agent-execution-started`
- `agent-execution-completed`
- `agent-execution-failed`
- `agent-approval-required`
- `agent-disabled`

## Extension points

The runtime is designed to remain additive:

- SDK agents can be loaded without rewriting HOARE-Agent Core.
- Tool execution reuses the SDK `ToolRegistry` contract.
- Memory adapters remain limited to Redis and Supabase-backed platform abstractions.
- Workflow execution remains policy-aware and approval-aware.
- Operations dashboard integration consumes runtime status through the existing `/operations` experience.

## Rollback strategy

Rollback is low risk because Phase 9C is additive:

1. Remove consumer imports of `agentfusion/`.
2. Revert operations snapshot/dashboard references to AgentFusion runtime status.
3. Leave HOARE-Agent, Phase 8 control plane, policy engine, Redis events, and Supabase integrations unchanged.

## Remaining Phase 9D dependencies

- richer agent knowledge retrieval and long-term search
- deeper enterprise connector execution
- more advanced industry agent packs
- external runtime APIs for agent management and invocation
- production persistence schema for dedicated AgentFusion records if later required
