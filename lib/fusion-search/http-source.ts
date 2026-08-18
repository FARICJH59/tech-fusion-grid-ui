import type { FusionSearchDocument, FusionSearchSource } from "./index";

export type HttpFusionSearchSourceConfig = {
  name: string;
  endpoint: string;
  apiKey?: string;
  timeoutMs?: number;
};

export class HttpFusionSearchSource implements FusionSearchSource {
  readonly name: string;
  constructor(private readonly config: HttpFusionSearchSourceConfig) {
    if (!config.name || !config.endpoint) throw new Error("Fusion Search source name and endpoint are required");
    this.name = config.name;
  }

  async search(query: string, limit: number): Promise<FusionSearchDocument[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 8000);
    try {
      const response = await fetch(this.config.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({ query, limit: Math.min(Math.max(limit, 1), 100) }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Fusion Search source ${this.name} returned HTTP ${response.status}`);
      const payload = (await response.json()) as { results?: Array<{ id?: string; title: string; content?: string; snippet?: string; source?: string; uri?: string; url?: string; updatedAt?: string; metadata?: Record<string, unknown> }> };
      return (payload.results ?? []).map((item, index) => ({
        id: item.id ?? `${this.name}:${index}:${item.url ?? item.uri ?? item.title}`,
        title: item.title,
        content: item.content ?? item.snippet ?? "",
        source: item.source ?? this.name,
        uri: item.uri ?? item.url,
        updatedAt: item.updatedAt,
        metadata: item.metadata,
      }));
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createConfiguredFusionSearchSource(): HttpFusionSearchSource {
  const endpoint = process.env.FUSION_SEARCH_ENDPOINT;
  if (!endpoint) throw new Error("FUSION_SEARCH_ENDPOINT is required for a live Fusion Search source");
  return new HttpFusionSearchSource({ name: process.env.FUSION_SEARCH_SOURCE_NAME ?? "live", endpoint, apiKey: process.env.FUSION_SEARCH_API_KEY });
}
