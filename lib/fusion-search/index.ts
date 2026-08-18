export type FusionSearchDocument = {
  id: string;
  title: string;
  content: string;
  source: string;
  uri?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
};

export type FusionSearchResult = FusionSearchDocument & {
  score: number;
  matchedTerms: string[];
};

export interface FusionSearchSource {
  name: string;
  search(query: string, limit: number): Promise<FusionSearchDocument[]>;
}

function terms(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/[^a-z0-9_-]+/).filter(Boolean))];
}

function score(doc: FusionSearchDocument, queryTerms: string[]): { score: number; matchedTerms: string[] } {
  const haystack = `${doc.title} ${doc.content}`.toLowerCase();
  const matchedTerms = queryTerms.filter((term) => haystack.includes(term));
  return { score: matchedTerms.length / Math.max(queryTerms.length, 1), matchedTerms };
}

export class FusionSearch {
  constructor(private readonly sources: FusionSearchSource[]) {}

  async search(query: string, options: { limit?: number } = {}): Promise<FusionSearchResult[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
    const queryTerms = terms(query);
    if (!queryTerms.length) return [];

    const batches = await Promise.all(this.sources.map((source) => source.search(query, limit)));
    const deduped = new Map<string, FusionSearchResult>();
    for (const docs of batches) {
      for (const doc of docs) {
        const ranked = score(doc, queryTerms);
        if (!ranked.matchedTerms.length) continue;
        const result = { ...doc, ...ranked };
        const existing = deduped.get(doc.id);
        if (!existing || result.score > existing.score) deduped.set(doc.id, result);
      }
    }
    return [...deduped.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

export class InMemorySearchSource implements FusionSearchSource {
  constructor(public readonly name: string, private readonly documents: FusionSearchDocument[]) {}
  async search(query: string, limit: number): Promise<FusionSearchDocument[]> {
    const q = terms(query);
    return this.documents.filter((doc) => q.some((term) => `${doc.title} ${doc.content}`.toLowerCase().includes(term))).slice(0, limit);
  }
}
