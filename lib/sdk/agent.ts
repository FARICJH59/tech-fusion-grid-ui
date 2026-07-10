import { BaseSdkClient } from "@/lib/sdk/base";
import type { SdkConfig, SdkResponse } from "@/lib/sdk/types";
import type { AgentDefinition, AgentInput, ExecutionResult } from "@/lib/runtime/types";

export class HoareAgentClient extends BaseSdkClient {
  constructor(config: SdkConfig) {
    super(config);
  }

  listAgents(): Promise<SdkResponse<AgentDefinition[]>> {
    return this.get<AgentDefinition[]>("agents");
  }

  getAgent(agentId: string): Promise<SdkResponse<AgentDefinition>> {
    return this.get<AgentDefinition>(`agents/${encodeURIComponent(agentId)}`);
  }

  executeAgent(agentId: string, input: AgentInput): Promise<SdkResponse<ExecutionResult>> {
    return this.post<ExecutionResult>(`agents/${encodeURIComponent(agentId)}/executions`, input);
  }

  getAgentExecution(executionId: string): Promise<SdkResponse<ExecutionResult>> {
    return this.get<ExecutionResult>(`agents/executions/${encodeURIComponent(executionId)}`);
  }
}
