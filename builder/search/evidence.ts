import { createHash } from "node:crypto";
import type { EvidenceBundle, SearchContradiction, SearchEvidence, WebSearchRequest, WebSearchResult } from "./types";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function normalizeUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  try {
    return new URL(value).toString();
  } catch {
    return undefined;
  }
}

function domainQuality(url?: string): number {
  if (!url) return 0.35;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.endsWith(".gov") || host.endsWith(".edu")) return 0.95;
    if (host.endsWith(".org")) return 0.8;
    return 0.65;
  } catch {
    return 0.35;
  }
}

function freshness(publishedAt?: string): number {
  if (!publishedAt) return 0.5;
  const timestamp = Date.parse(publishedAt);
  if (!Number.isFinite(timestamp)) return 0.5;
  const ageDays = Math.max(0, (Date.now() - timestamp) / 86_400_000);
  return clamp(Math.exp(-ageDays / 365));
}

function titleFrom(item: Record<string, unknown>): string {
  return typeof item.title === "string" ? item.title : "Untitled result";
}

function snippetFrom(item: Record<string, unknown>): string | undefined {
  if (typeof item.snippet === "string") return item.snippet;
  if (typeof item.description === "string") return item.description;
  return undefined;
}

function urlFrom(item: Record<string, unknown>): string | undefined {
  return normalizeUrl(item.link ?? item.url);
}

function publishedFrom(item: Record<string, unknown>): string | undefined {
  const value = item.date ?? item.published_at ?? item.publishedAt;
  return typeof value === "string" ? value : undefined;
}

function extractItems(result: WebSearchResult): Array<Record<string, unknown>> {
  if (!result.data || typeof result.data !== "object") return [];
  const data = result.data as Record<string, unknown>;
  const candidates = [data.organic_results, data.results, data.news_results];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  }
  return [];
}

export function normalizeSearchResult(
  result: WebSearchResult,
  request: WebSearchRequest,
  acquiredAt = new Date().toISOString(),
): SearchEvidence[] {
  return extractItems(result).map((item, index) => {
    const url = urlFrom(item);
    const publishedAt = publishedFrom(item);
    const relevance = clamp(1 - index / Math.max(10, request.limit ?? 10));
    const fresh = freshness(publishedAt);
    const quality = domainQuality(url);
    const confidence = clamp(relevance * 0.5 + fresh * 0.2 + quality * 0.3);
    const id = createHash("sha256")
      .update(JSON.stringify({ provider: result.provider, query: request.query, url, title: titleFrom(item), index }))
      .digest("hex");

    return {
      id,
      provider: result.provider,
      source_type: "web",
      title: titleFrom(item),
      url,
      snippet: snippetFrom(item),
      acquired_at: acquiredAt,
      source_published_at: publishedAt,
      relevance_score: relevance,
      freshness_score: fresh,
      source_quality_score: quality,
      confidence_score: confidence,
      provenance_hash: result.provenance_hash,
    };
  });
}

export function deduplicateEvidence(evidence: SearchEvidence[]): SearchEvidence[] {
  const byKey = new Map<string, SearchEvidence>();
  for (const item of evidence) {
    const key = item.url ?? `${item.title.toLowerCase()}|${item.snippet ?? ""}`;
    const current = byKey.get(key);
    if (!current || item.confidence_score > current.confidence_score) byKey.set(key, item);
  }
  return [...byKey.values()].sort((a, b) => b.confidence_score - a.confidence_score);
}

export function detectContradictions(evidence: SearchEvidence[]): SearchContradiction[] {
  const groups = new Map<string, SearchEvidence[]>();
  for (const item of evidence) {
    if (!item.snippet) continue;
    const match = item.snippet.match(/\b(\d+(?:\.\d+)?)\s*(%|USD|dollars?|million|billion)\b/i);
    if (!match) continue;
    const key = match[2].toLowerCase();
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  const contradictions: SearchContradiction[] = [];
  for (const [field, items] of groups) {
    const values = [...new Set(items.map((item) => item.snippet!.match(/\b(\d+(?:\.\d+)?)\s*(%|USD|dollars?|million|billion)\b/i)![0]))];
    if (values.length > 1) {
      contradictions.push({ field, evidence_ids: items.map((item) => item.id), values });
    }
  }
  return contradictions;
}

export function buildEvidenceBundle(
  request: WebSearchRequest,
  results: WebSearchResult[],
  acquiredAt = new Date().toISOString(),
): EvidenceBundle {
  const evidence = deduplicateEvidence(results.flatMap((result) => normalizeSearchResult(result, request, acquiredAt)));
  const contradictions = detectContradictions(evidence);
  const rawConfidence = evidence.length === 0
    ? 0
    : evidence.reduce((sum, item) => sum + item.confidence_score, 0) / evidence.length;
  const confidence = clamp(rawConfidence - Math.min(0.35, contradictions.length * 0.1));
  const provenance_hash = createHash("sha256")
    .update(JSON.stringify({ request, evidence, contradictions }))
    .digest("hex");

  return { query: request.query, acquired_at: acquiredAt, evidence, contradictions, confidence_score: confidence, provenance_hash };
}
