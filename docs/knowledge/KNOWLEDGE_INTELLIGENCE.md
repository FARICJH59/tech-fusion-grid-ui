# HOARE Knowledge Intelligence

Phase 10H adds retrieval intelligence on top of the governed knowledge substrate.

## Boundary

```text
Intent / Planner
      ↓
FusionSearch
      ↓
SerpAPI / other provider adapters
      ↓
Evidence
      ↓
Governed Knowledge Acquisition
      ↓
HOARE Knowledge Substrate
      ↓
Knowledge Intelligence
      ↓
Existing Decision / Governance / PASOR
      ↓
HOARE Runtime
```

Knowledge Intelligence does **not** replace or duplicate the planner, search layer, governance engine, PASOR, or runtime.

## Retrieval model

Candidates are scoped by `tenant_id` and `project_id` before ranking. Ranking combines:

- lexical relevance: 45%
- acquired confidence: 30%
- freshness: 10%
- provenance completeness: 15%

The result is deterministic for the same candidate set, query, and reference time.

## Contradictions

The retrieval result exposes competing numeric values found across distinct candidates instead of silently selecting one. Contradictions are evidence for downstream reasoning; they are not automatically resolved by this layer.

## Provider independence

Knowledge Intelligence consumes `KnowledgeCandidate` objects. It does not know whether they originated from SerpAPI, another search provider, an API, a document, a repository, a sensor, or internal data.

## Governance boundary

Retrieval does not authorize actions, execute tools, mutate source knowledge, or bypass policy. Downstream decision and governance layers remain responsible for deciding what HOARE may do with retrieved knowledge.
