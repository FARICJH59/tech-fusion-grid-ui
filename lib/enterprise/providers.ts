import type { ServiceHealth } from "@/lib/enterprise/types";

export const PROVIDER_NAMES = [
  "Google Gemini",
  "Gemini Nano Banana",
  "Gemini Omni Flash",
  "Gemini 3.5",
  "OpenAI",
  "Anthropic",
] as const;

export type ProviderName = (typeof PROVIDER_NAMES)[number];

export type AIOperation =
  | "text"
  | "multimodal"
  | "image-generation"
  | "video-generation"
  | "embeddings"
  | "structured-output";

export type AIRequest = {
  operation: AIOperation;
  prompt: string;
  tenantId: string;
  stream?: boolean;
  retries?: number;
  metadata?: Record<string, unknown>;
};

export type AIResponse = {
  provider: ProviderName;
  output: string;
  usageTokens: number;
  estimatedCostUsd: number;
  metadata?: Record<string, unknown>;
};

export type AIStreamChunk = {
  provider: ProviderName;
  chunk: string;
  done: boolean;
};

export type ProviderUsage = {
  requests: number;
  tokens: number;
  costUsd: number;
};
type ProviderUsageInternal = {
  requests: number;
  tokens: number;
  costMicros: number;
};

export type ProviderAdapter = {
  name: ProviderName;
  health: ServiceHealth;
  supports: AIOperation[];
  call: (request: AIRequest) => Promise<AIResponse>;
  stream: (request: AIRequest) => AsyncGenerator<AIStreamChunk>;
};

const defaultSupports: AIOperation[] = [
  "text",
  "multimodal",
  "image-generation",
  "video-generation",
  "embeddings",
  "structured-output",
];

function estimateTokens(prompt: string): number {
  return Math.max(1, Math.ceil(prompt.length / 4));
}

function estimateCost(provider: ProviderName, tokens: number): number {
  const perThousand: Record<ProviderName, number> = {
    "Google Gemini": 0.001,
    "Gemini Nano Banana": 0.0008,
    "Gemini Omni Flash": 0.0012,
    "Gemini 3.5": 0.0014,
    OpenAI: 0.003,
    Anthropic: 0.0035,
  };
  return Number(((tokens / 1000) * perThousand[provider]).toFixed(6));
}

function usdToMicros(amountUsd: number): number {
  return Math.round(amountUsd * 1_000_000);
}

function microsToUsd(amountMicros: number): number {
  return Number((amountMicros / 1_000_000).toFixed(6));
}

export function createDefaultProvider(name: ProviderName): ProviderAdapter {
  return {
    name,
    health: "healthy",
    supports: defaultSupports,
    async call(request: AIRequest): Promise<AIResponse> {
      const usageTokens = estimateTokens(request.prompt);
      return {
        provider: name,
        output: `[${name}] ${request.operation} response for tenant ${request.tenantId}`,
        usageTokens,
        estimatedCostUsd: estimateCost(name, usageTokens),
        metadata: { retry: 0 },
      };
    },
    async *stream(request: AIRequest): AsyncGenerator<AIStreamChunk> {
      const parts = [
        `[${name}]`,
        `${request.operation}`,
        `tenant:${request.tenantId}`,
        "stream-complete",
      ];
      for (let idx = 0; idx < parts.length; idx += 1) {
        yield { provider: name, chunk: parts[idx], done: idx === parts.length - 1 };
      }
    },
  };
}

export class AIProviderGateway {
  private readonly providers = new Map<ProviderName, ProviderAdapter>();
  private readonly usage = new Map<ProviderName, ProviderUsageInternal>();

  register(provider: ProviderAdapter): void {
    this.providers.set(provider.name, provider);
    if (!this.usage.has(provider.name)) {
      this.usage.set(provider.name, { requests: 0, tokens: 0, costMicros: 0 });
    }
  }

  list(): ProviderAdapter[] {
    return [...this.providers.values()];
  }

  setHealth(name: ProviderName, health: ServiceHealth): void {
    const current = this.providers.get(name);
    if (!current) return;
    this.providers.set(name, { ...current, health });
  }

  private selectProvider(operation: AIOperation, preferred?: ProviderName): ProviderAdapter {
    const ordered = [
      ...(preferred ? [preferred] : []),
      ...PROVIDER_NAMES.filter((name) => name !== preferred),
    ];

    for (const name of ordered) {
      const provider = this.providers.get(name);
      if (!provider) continue;
      if (provider.health !== "healthy") continue;
      if (!provider.supports.includes(operation)) continue;
      return provider;
    }

    throw new Error(`No healthy provider available for operation '${operation}'`);
  }

  async execute(request: AIRequest & { preferred?: ProviderName }): Promise<AIResponse> {
    const maxRetries = Math.max(0, request.retries ?? 2);
    let attempt = 0;
    let lastError: unknown = null;

    while (attempt <= maxRetries) {
      try {
        const provider = this.selectProvider(request.operation, request.preferred);
        const response = await provider.call(request);
        this.trackUsage(response);
        return response;
      } catch (error) {
        lastError = error;
        attempt += 1;
      }
    }

    throw new Error(`AI request failed after retries: ${String(lastError)}`);
  }

  async *stream(request: AIRequest & { preferred?: ProviderName }): AsyncGenerator<AIStreamChunk> {
    const provider = this.selectProvider(request.operation, request.preferred);
    for await (const chunk of provider.stream(request)) {
      yield chunk;
    }
  }

  usageSnapshot(): Record<ProviderName, ProviderUsage> {
    return Object.fromEntries(
      [...this.usage.entries()].map(([name, usage]) => [
        name,
        {
          requests: usage.requests,
          tokens: usage.tokens,
          costUsd: microsToUsd(usage.costMicros),
        },
      ]),
    ) as Record<ProviderName, ProviderUsage>;
  }

  private trackUsage(response: AIResponse): void {
    const current = this.usage.get(response.provider) ?? {
      requests: 0,
      tokens: 0,
      costMicros: 0,
    };

    this.usage.set(response.provider, {
      requests: current.requests + 1,
      tokens: current.tokens + response.usageTokens,
      costMicros: current.costMicros + usdToMicros(response.estimatedCostUsd),
    });
  }
}

export function createAIProviderGateway(): AIProviderGateway {
  const gateway = new AIProviderGateway();
  for (const name of PROVIDER_NAMES) {
    gateway.register(createDefaultProvider(name));
  }
  return gateway;
}
