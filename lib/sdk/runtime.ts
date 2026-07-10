import { BaseSdkClient } from "@/lib/sdk/base";
import type { SdkConfig, SdkResponse } from "@/lib/sdk/types";
import type { ExecutionRequest, ExecutionResult } from "@/lib/runtime/types";

type RuntimeStatus = {
  state: "stopped" | "starting" | "running" | "stopping";
  agents: number;
  tools: number;
  workflows: number;
  queueSize: number;
  timestamp: string;
};

export class HoareRuntimeClient extends BaseSdkClient {
  constructor(config: SdkConfig) {
    super(config);
  }

  getStatus(): Promise<SdkResponse<RuntimeStatus>> {
    return this.get<RuntimeStatus>("runtime/status");
  }

  execute(request: ExecutionRequest): Promise<SdkResponse<ExecutionResult>> {
    return this.post<ExecutionResult>("runtime/executions", request);
  }

  cancelExecution(executionId: string): Promise<SdkResponse<{ cancelled: boolean }>> {
    return this.delete<{ cancelled: boolean }>(`runtime/executions/${encodeURIComponent(executionId)}`);
  }

  getExecutionResult(executionId: string): Promise<SdkResponse<ExecutionResult>> {
    return this.get<ExecutionResult>(`runtime/executions/${encodeURIComponent(executionId)}`);
  }
}
