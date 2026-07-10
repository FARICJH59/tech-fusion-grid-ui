import { randomUUID } from "node:crypto";
import { retry } from "@/lib/utils/retry";
import type {
  CompletionRequest,
  CompletionResponse,
  IProvider,
  ProviderHealth,
} from "@/lib/providers/types";

type AnthropicMessageResponse = {
  id?: string;
  model?: string;
  content?: Array<{ type?: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: { message?: string };
};

export class AnthropicProvider implements IProvider {
  readonly id = "anthropic" as const;

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("[anthropic] ANTHROPIC_API_KEY is not configured");
    }

    const startedAt = Date.now();
    const system = req.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");
    const messages = req.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      }));

    try {
      const response = await retry(async () => {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: req.model,
            system: system || undefined,
            messages,
            temperature: req.temperature,
            max_tokens: req.maxTokens ?? 1024,
          }),
        });

        const json = (await res.json()) as AnthropicMessageResponse;
        if (!res.ok) {
          throw new Error(json.error?.message ?? `Anthropic request failed with ${res.status}`);
        }
        return json;
      }, { maxAttempts: 3, baseDelayMs: 200 });

      const content = (response.content ?? [])
        .filter((part) => part.type === "text" && typeof part.text === "string")
        .map((part) => part.text ?? "")
        .join("\n");
      const inputTokens = response.usage?.input_tokens ?? 0;
      const outputTokens = response.usage?.output_tokens ?? 0;

      return {
        id: response.id ?? randomUUID(),
        model: response.model ?? req.model,
        provider: this.id,
        content,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      throw new Error(`[anthropic] Completion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    const startedAt = Date.now();
    const configured = Boolean(process.env.ANTHROPIC_API_KEY);
    return {
      provider: this.id,
      status: configured ? "healthy" : "down",
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    };
  }
}
