# HOARE FusionSearch

FusionSearch is the governed builder's evidence-acquisition layer. It is deliberately **not** a planner, decision engine, governance engine, PASOR dispatcher, or runtime executor.

## Flow

```text
Intent / planner
      ↓
FusionSearch
      ↓
Provider adapters (SerpAPI first)
      ↓
Canonical evidence
      ↓
Normalization + deduplication
      ↓
Relevance + freshness + source-quality scoring
      ↓
Contradiction detection
      ↓
Evidence bundle + provenance
      ↓
Existing decision / governance / PASOR boundary
      ↓
Execution
```

## Security boundary

- Provider credentials are resolved from the runtime environment and are never search parameters.
- Search results are untrusted evidence.
- Search does not authorize an action or execute repository code.
- Provenance hashes bind the acquired result set to the search request.
- Contradictory evidence is surfaced instead of silently collapsed into a single fact.

## SerpAPI

`serpapi-adapter.ts` remains a provider adapter. Replacing SerpAPI later does not require changing FusionSearch's canonical evidence contract.
