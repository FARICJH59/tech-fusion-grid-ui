import { randomUUID } from "node:crypto";
import { retry } from "@/lib/utils/retry";
import type {
  CompletionRequest,
  CompletionResponse,
  IProvider,
  ProviderHealth,
} from "@/lib/providers/types";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string };
};

export class GeminiProvider implements IProvider {
  readonly id = "gemini" as const;

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("[gemini] GEMINI_API_KEY is not configured");
    }

    const startedAt = Date.now();
    const systemInstruction = req.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");
    const contents = req.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      }));

    try {
      const response = await retry(async () => {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents,
              systemInstruction: systemInstruction
                ? { role: "system", parts: [{ text: systemInstruction }] }
                : undefined,
              generationConfig: {
                temperature: req.temperature,
                maxOutputTokens: req.maxTokens,
              },
            }),
          },
        );

        const json = (await res.json()) as GeminiResponse;
        if (!res.ok) {
          throw new Error(json.error?.message ?? `Gemini request failed with ${res.status}`);
        }
        return json;
      }, { maxAttempts: 3, baseDelayMs: 200 });

      const content = (response.candidates?.[0]?.content?.parts ?? [])
        .map((part) => part.text ?? "")
        .join("\n");

      return {
        id: randomUUID(),
        model: req.model,
        provider: this.id,
        content,
        usage: {
          inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
          totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
        },
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      throw new Error(`[gemini] Completion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    const startedAt = Date.now();
    const configured = Boolean(process.env.GEMINI_API_KEY);
    return {
      provider: this.id,
      status: configured ? "healthy" : "down",
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    };
  }
}
