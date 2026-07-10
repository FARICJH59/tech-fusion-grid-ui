export type ProviderId = "openai" | "anthropic" | "gemini";
export type ModelId = string;

export type CompletionRequest = {
  model: ModelId;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tenantId?: string;
  correlationId?: string;
};

export type CompletionResponse = {
  id: string;
  model: ModelId;
  provider: ProviderId;
  content: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  durationMs: number;
};

export type ProviderHealth = {
  provider: ProviderId;
  status: "healthy" | "degraded" | "down";
  latencyMs?: number;
  checkedAt: string;
};

export interface IProvider {
  id: ProviderId;
  complete(req: CompletionRequest): Promise<CompletionResponse>;
  healthCheck(): Promise<ProviderHealth>;
}
