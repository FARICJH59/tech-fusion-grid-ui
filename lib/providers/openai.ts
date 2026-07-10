import { randomUUID } from "node:crypto";
import { retry } from "@/lib/utils/retry";
import type {
  CompletionRequest,
  CompletionResponse,
  IProvider,
  ProviderHealth,
} from "@/lib/providers/types";

type OpenAIResponse = {
  id?: string;
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string };
};

export class OpenAIProvider implements IProvider {
  readonly id = "openai" as const;

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("[openai] OPENAI_API_KEY is not configured");
    }

    const startedAt = Date.now();

    try {
      const response = await retry(async () => {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: ["Bearer", apiKey].join(" "),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: req.model,
            messages: req.messages,
            temperature: req.temperature,
            max_tokens: req.maxTokens,
            stream: false,
          }),
        });

        const json = (await res.json()) as OpenAIResponse;
        if (!res.ok) {
          throw new Error(json.error?.message ?? `OpenAI request failed with ${res.status}`);
        }
        return json;
      }, { maxAttempts: 3, baseDelayMs: 200 });

      return {
        id: response.id ?? randomUUID(),
        model: response.model ?? req.model,
        provider: this.id,
        content: response.choices?.[0]?.message?.content ?? "",
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      throw new Error(`[openai] Completion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    const startedAt = Date.now();
    const configured = Boolean(process.env.OPENAI_API_KEY);
    return {
      provider: this.id,
      status: configured ? "healthy" : "down",
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    };
  }
}
