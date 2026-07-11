# Agent SDK Architecture

## Design principles

1. Additive only: Phase 9B introduces interfaces, adapters, and tests without replacing existing HOARE-Agent runtime behavior.
2. Contract first: the Agent SDK defines the standard contract between HOARE-Agent Core, AgentFusion Runtime, industry agents, tools, and enterprise workflows.
3. Security continuity: tenant isolation, RBAC, ABAC, policy evaluation, approval workflow integration, and audit expectations remain aligned with Phase 8 controls.
4. Infrastructure reuse: short-term and long-term memory abstractions reuse the existing Redis and Supabase direction without introducing a new database.
5. Vercel-safe: the SDK is a TypeScript contract package and adapter layer only, so existing Next.js production behavior remains unchanged.

## Agent SDK modules

- `packages/agent-sdk/src/agent.ts` — canonical agent contract and registry
- `packages/agent-sdk/src/capability.ts` — versioned capability model and discovery registry
- `packages/agent-sdk/src/tool.ts` — typed tool contract for API, database, cloud, IoT, and enterprise tools
- `packages/agent-sdk/src/memory.ts` — memory contract and provider interface with in-memory adapter
- `packages/agent-sdk/src/workflow.ts` — workflow definition, step validation, and event contract
- `packages/agent-sdk/src/permission.ts` — permission contract with tenant-aware evaluation hooks
- `packages/agent-sdk/src/evaluation.ts` — evaluation metrics, tests, and quality scoring
- `packages/agent-sdk/src/context.ts` — execution context and tenant scope contract
- `packages/agent-sdk/src/events.ts` — event bus interface for agent lifecycle signals
- `packages/agent-sdk/src/index.ts` — package export surface

## Standardized agent contract

Every SDK agent exposes:

- identity: `id`, `name`, `version`, `description`
- purpose: `mission`, `domain`, `objectives`
- capabilities: supported actions, tools, workflows, and versioned capability definitions
- tools: standardized tool references
- memory: required memory type, storage adapter, retention policy, namespaces
- permissions: tenant-aware RBAC/ABAC and policy requirements
- workflows: multi-step definitions with tool calls, collaboration, approval checkpoints, and event emission
- evaluation: capability tests, workflow tests, reliability metrics, quality scoring inputs

## Extension model

The SDK is intentionally modular.

- New capabilities register through `CapabilityRegistry`
- New tools register through `ToolRegistry`
- New memory adapters implement `MemoryProvider`
- New workflow packs register through `WorkflowRegistry`
- New evaluation recorders build on `EvaluationRegistry`
- Existing or future agent runtimes integrate through adapters instead of rewrites

## Security model

The permission contract is designed to compose with existing platform controls:

- tenant isolation: enforced before any permission grant
- RBAC and ABAC: delegated to the current enterprise security contract
- policy evaluation: compatible with the Phase 8 autonomous policy engine
- approval workflow: compatible with the current approval flow for gated actions
- audit logging: permission evaluation returns audit-ready records for persistence or event fan-out

## HOARE-Agent integration

`agentfusion/adapters/hoare-agent-adapter.ts` exposes the current `EnterpriseAgentFramework` through the Agent SDK contract.

The adapter preserves:

- existing reasoning engine behavior
- existing workflow orchestration semantics
- existing runtime APIs and tool identifiers
- existing policy and approval gates

Adapter responsibilities:

- translate HOARE agent definitions into SDK agents
- expose workflow, memory, evaluation, and permission metadata
- route policy-aware permission checks through current security and approval abstractions
- keep future AgentFusion runtime integrations adapter-based rather than invasive

## Integration example

1. Register or discover an agent through `AgentRegistry`
2. Discover capabilities through `CapabilityRegistry`
3. Execute a tool through `ToolRegistry`
4. Resolve memory through a `MemoryProvider`
5. Validate workflows through `WorkflowRegistry`
6. Evaluate permissions through `AgentPermissionEvaluator`
7. Adapt existing HOARE-Agent runtime objects through `HoareAgentAdapter`

## Security and rollout posture

- no production APIs are replaced
- no workflow engine is rewritten
- no new database is introduced
- no proprietary reasoning logic is exposed
- rollback is straightforward: remove consumer references to the new package and adapter without touching existing runtime code
