# HOARE Enterprise SDK Reference

## SDK initialization

```ts
import { HoareSDK } from "@/lib/sdk";

const sdk = new HoareSDK({
  baseUrl: "https://control-plane.example.com/",
  apiKey: "service-token",
  tenantId: "tenant-123",
  timeout: 10_000,
});

const envSdk = HoareSDK.fromEnv();
```

`fromEnv()` reads `HOARE_API_URL`, `HOARE_API_KEY`, and `HOARE_TENANT_ID`.

## Client API reference

### 1. Auth client

- `login({ email, password })`
- `refresh(refreshToken)`
- `logout(token?)`
- `revokeToken(token)`

### 2. Runtime client

- `getStatus()`
- `execute(request)`
- `cancelExecution(executionId)`
- `getExecutionResult(executionId)`

### 3. Workflow client

- `createWorkflow(definition)`
- `runWorkflow(workflowId, input?)`
- `getWorkflowRun(runId)`
- `listWorkflowRuns(workflowId?)`
- `cancelWorkflowRun(runId)`

### 4. Agent client

- `listAgents()`
- `getAgent(agentId)`
- `executeAgent(agentId, input)`
- `getAgentExecution(executionId)`

### 5. Telemetry client

- `ingestTelemetry(payload)`
- `queryTelemetry(query?)`
- `subscribeTelemetry(channel?)`

### 6. Deployment client

- `deployRuntime(payload)`
- `getDeploymentStatus(deploymentId)`
- `listDeployments()`
- `rollback(deploymentId)`

### 7. Billing client

- `getUsage()`
- `getInvoices()`
- `getCurrentPlan()`

### 8. Audit client

- `queryAuditLog(query?)`
- `exportAuditLog(query?)`

## Error handling

All SDK clients inherit from `BaseSdkClient` and throw `HoareSdkClientError` on HTTP, timeout, or network failures. Errors expose:

- `code`
- `message`
- `requestId` when available from the control plane

## TypeScript types reference

- `SdkConfig` — shared connection settings
- `SdkResponse<T>` — envelope containing typed `data` and `requestId`
- `SdkError` — normalized error shape
- Runtime requests reuse shared runtime types such as `ExecutionRequest`, `ExecutionResult`, `WorkflowDefinition`, and `WorkflowRun`
