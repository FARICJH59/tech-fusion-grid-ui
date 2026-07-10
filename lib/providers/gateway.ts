import { appMetrics } from "@/lib/telemetry/metrics";
import { AnthropicProvider } from "@/lib/providers/anthropic";
import { GeminiProvider } from "@/lib/providers/gemini";
import { OpenAIProvider } from "@/lib/providers/openai";
import type {
  CompletionRequest,
  CompletionResponse,
  IProvider,
  ProviderHealth,
  ProviderId,
} from "@/lib/providers/types";

export type GatewayOptions = {
  defaultProvider?: ProviderId;
  fallbackOrder?: ProviderId[];
  maxRetries?: number;
};

export class AIGateway {
  private readonly providers = new Map<ProviderId, IProvider>();
  private readonly options: GatewayOptions;

  constructor(options: GatewayOptions = {}) {
    this.options = options;
  }

  registerProvider(provider: IProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: ProviderId): IProvider | undefined {
    return this.providers.get(id);
  }

  async complete(req: CompletionRequest, preferredProvider?: ProviderId): Promise<CompletionResponse> {
    const providerOrder = this.resolveProviderOrder(preferredProvider);
    const errors: string[] = [];

    for (const providerId of providerOrder) {
      const provider = this.providers.get(providerId);
      if (!provider) {
        errors.push(`${providerId}: provider not registered`);
        continue;
      }

      const startedAt = Date.now();
      try {
        const response = await provider.complete(req);
        appMetrics.recordApiLatency(Date.now() - startedAt, {
          route: `ai:${providerId}`,
          method: "complete",
          status: "success",
        });
        return response;
      } catch (error) {
        appMetrics.recordApiLatency(Date.now() - startedAt, {
          route: `ai:${providerId}`,
          method: "complete",
          status: "error",
        });
        errors.push(`${providerId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    throw new Error(`All AI providers failed: ${errors.join("; ")}`);
  }

  async healthCheck(): Promise<ProviderHealth[]> {
    const providers = [...this.providers.values()];
    return Promise.all(providers.map(async (provider) => {
      try {
        return await provider.healthCheck();
      } catch {
        return {
          provider: provider.id,
          status: "down",
          checkedAt: new Date().toISOString(),
        } satisfies ProviderHealth;
      }
    }));
  }

  async healthyProviders(): Promise<ProviderId[]> {
    const health = await this.healthCheck();
    return health.filter((entry) => entry.status === "healthy").map((entry) => entry.provider);
  }

  private resolveProviderOrder(preferredProvider?: ProviderId): ProviderId[] {
    const ordered: ProviderId[] = [];
    const primary = preferredProvider ?? this.options.defaultProvider;
    if (primary) {
      ordered.push(primary);
    }

    for (const providerId of this.options.fallbackOrder ?? []) {
      if (!ordered.includes(providerId)) {
        ordered.push(providerId);
      }
    }

    for (const providerId of this.providers.keys()) {
      if (!ordered.includes(providerId)) {
        ordered.push(providerId);
      }
    }

    return ordered;
  }
}

export const aiGateway = new AIGateway({ defaultProvider: "openai", fallbackOrder: ["anthropic", "gemini"] });
aiGateway.registerProvider(new OpenAIProvider());
aiGateway.registerProvider(new AnthropicProvider());
aiGateway.registerProvider(new GeminiProvider());
