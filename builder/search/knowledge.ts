import { createHash } from "node:crypto";
import type { EvidenceBundle, SearchEvidence } from "./types";

export type KnowledgeLicenseStatus =
  | "known-permitted"
  | "unknown"
  | "restricted"
  | "user-provided"
  | "internal";

export type KnowledgeSourceClass =
  | "web"
  | "document"
  | "api"
  | "repository"
  | "sensor"
  | "internal";

export interface KnowledgeProvenance {
  source: string;
  source_class: KnowledgeSourceClass;
  acquisition_method: string;
  acquired_at: string;
  source_published_at?: string;
  jurisdiction?: string;
  license_status: KnowledgeLicenseStatus;
  retention_policy?: string;
  content_hash: string;
  evidence_id: string;
  evidence_provenance_hash: string;
}

export interface KnowledgeCandidate {
  id: string;
  tenant_id: string;
  project_id: string;
  title: string;
  url?: string;
  content?: string;
  snippet?: string;
  confidence_score: number;
  provenance: KnowledgeProvenance;
}

export interface KnowledgeAcquisitionResult {
  query: string;
  acquired_at: string;
  candidates: KnowledgeCandidate[];
  provenance_hash: string;
}

function contentHash(evidence: SearchEvidence): string {
  return createHash("sha256")
    .update(JSON.stringify({
      title: evidence.title,
      url: evidence.url,
      snippet: evidence.snippet,
      content: evidence.content,
    }))
    .digest("hex");
}

function candidateId(tenantId: string, projectId: string, evidence: SearchEvidence): string {
  return createHash("sha256")
    .update(`${tenantId}:${projectId}:${evidence.id}`)
    .digest("hex");
}

/**
 * Converts untrusted search evidence into explicitly governed knowledge
 * candidates. This does not persist, authorize, or execute anything.
 */
export function acquireKnowledgeCandidates(
  bundle: EvidenceBundle,
  tenantId: string,
  projectId: string,
  defaults: Pick<KnowledgeProvenance, "license_status"> & Partial<Pick<KnowledgeProvenance, "jurisdiction" | "retention_policy">> = {
    license_status: "unknown",
  },
): KnowledgeAcquisitionResult {
  if (!tenantId) throw new Error("tenant_id is required");
  if (!projectId) throw new Error("project_id is required");

  const candidates = bundle.evidence.map((evidence) => ({
    id: candidateId(tenantId, projectId, evidence),
    tenant_id: tenantId,
    project_id: projectId,
    title: evidence.title,
    ...(evidence.url ? { url: evidence.url } : {}),
    ...(evidence.content ? { content: evidence.content } : {}),
    ...(evidence.snippet ? { snippet: evidence.snippet } : {}),
    confidence_score: evidence.confidence_score,
    provenance: {
      source: evidence.url ?? evidence.provider,
      source_class: evidence.source_type === "web" ? "web" : "api",
      acquisition_method: evidence.provider,
      acquired_at: evidence.acquired_at,
      ...(evidence.source_published_at ? { source_published_at: evidence.source_published_at } : {}),
      ...(defaults.jurisdiction ? { jurisdiction: defaults.jurisdiction } : {}),
      license_status: defaults.license_status,
      ...(defaults.retention_policy ? { retention_policy: defaults.retention_policy } : {}),
      content_hash: contentHash(evidence),
      evidence_id: evidence.id,
      evidence_provenance_hash: evidence.provenance_hash,
    },
  }));

  const provenance_hash = createHash("sha256")
    .update(JSON.stringify({
      tenant_id: tenantId,
      project_id: projectId,
      query: bundle.query,
      evidence_bundle_hash: bundle.provenance_hash,
      candidates,
    }))
    .digest("hex");

  return {
    query: bundle.query,
    acquired_at: bundle.acquired_at,
    candidates,
    provenance_hash,
  };
}

export function validateKnowledgeCandidate(candidate: KnowledgeCandidate): void {
  if (!candidate.tenant_id || !candidate.project_id) {
    throw new Error("knowledge candidate must be tenant and project bound");
  }
  if (!candidate.title.trim()) throw new Error("knowledge candidate title is required");
  if (!candidate.provenance.content_hash) throw new Error("knowledge candidate content hash is required");
  if (!candidate.provenance.evidence_id) throw new Error("knowledge candidate evidence id is required");
  if (!candidate.provenance.evidence_provenance_hash) {
    throw new Error("knowledge candidate evidence provenance hash is required");
  }
}
