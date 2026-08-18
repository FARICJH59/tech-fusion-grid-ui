export type FusionSearchQuery = {
  query: string;
  limit?: number;
  tenantId?: string;
  sources?: string[];
};

export type FusionSearchResult = {
  title: string;
  url: string;
  snippet?: string;
  source: string;
  retrievedAt: string;
};

export interface FusionSearchProvider {
  search(query: FusionSearchQuery): Promise<FusionSearchResult[]>;
}

export type FusionSearchConfig = {
  endpoint: string;
  apiKey?: string;
  timeoutMs?: number;
};

export class HttpFusionSearchProvider implements FusionSearchProvider {
  constructor(private readonly config: FusionSearchConfig) {
    if (!config.endpoint) throw new Error("FUSION_SEARCH_ENDPOINT is required for live search.");
  }

  async search(query: FusionSearchQuery): Promise<FusionSearchResult[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 8000);
    try {
      const response = await fetch(this.config.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({ query: query.query, limit: Math.min(query.limit ?? 10, 50), tenantId: query.tenantId, sources: query.sources }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Fusion Search provider returned HTTP ${response.status}.`);
      const payload = (await response.json()) as { results?: Array<{ title: string; url: string; snippet?: string; source?: string }> };
      return (payload.results ?? []).map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        source: item.source ?? "live-provider",
        retrievedAt: new Date().toISOString(),
      }));
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createFusionSearchProvider(): FusionSearchProvider {
  const endpoint = process.env.FUSION_SEARCH_ENDPOINT;
  if (!endpoint) throw new Error("Live Fusion Search is not configured. Set FUSION_SEARCH_ENDPOINT.");
  return new HttpFusionSearchProvider({ endpoint, apiKey: process.env.FUSION_SEARCH_API_KEY });
}
