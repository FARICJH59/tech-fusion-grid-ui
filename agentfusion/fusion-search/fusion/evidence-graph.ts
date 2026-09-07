import { createHash } from "node:crypto";
import type { FusionEvidence } from "../core/types";

export type EvidenceGraphNode = Readonly<{
  id: string;
  kind: "evidence";
  tenantId: string;
  source: string;
  objectId: string;
  objectVersion?: string;
}>;

export type EvidenceGraphEdge = Readonly<{
  from: string;
  to: string;
  relation: "same-transaction" | "same-attempt" | "same-artifact" | "same-receipt";
}>;

export type EvidenceGraph = Readonly<{
  nodes: readonly EvidenceGraphNode[];
  edges: readonly EvidenceGraphEdge[];
  graphHash: string;
}>;

/** Builds a deterministic graph and fails closed if mixed-tenant evidence is supplied. */
export function buildEvidenceGraph(evidence: readonly FusionEvidence[], tenantId: string): EvidenceGraph {
  if (!tenantId) throw new Error("fusion_search_tenant_required");
  if (evidence.some((item) => item.tenantId !== tenantId)) {
    throw new Error("fusion_search_cross_tenant_evidence");
  }

  const nodes = evidence.map((item) => ({
    id: item.evidenceId,
    kind: "evidence" as const,
    tenantId: item.tenantId,
    source: item.source,
    objectId: item.objectId,
    objectVersion: item.objectVersion,
  }));

  const edges: EvidenceGraphEdge[] = [];
  for (let i = 0; i < evidence.length; i += 1) {
    for (let j = i + 1; j < evidence.length; j += 1) {
      const left = evidence[i];
      const right = evidence[j];
      if (left.provenance.transactionId && left.provenance.transactionId === right.provenance.transactionId) {
        edges.push({ from: left.evidenceId, to: right.evidenceId, relation: "same-transaction" });
      }
      if (left.provenance.attemptId && left.provenance.attemptId === right.provenance.attemptId) {
        edges.push({ from: left.evidenceId, to: right.evidenceId, relation: "same-attempt" });
      }
      if (left.provenance.artifactDigest && left.provenance.artifactDigest === right.provenance.artifactDigest) {
        edges.push({ from: left.evidenceId, to: right.evidenceId, relation: "same-artifact" });
      }
      const leftReceipt = (left.content as Record<string, unknown> | null)?.receiptId;
      const rightReceipt = (right.content as Record<string, unknown> | null)?.receiptId;
      if (typeof leftReceipt === "string" && leftReceipt === rightReceipt) {
        edges.push({ from: left.evidenceId, to: right.evidenceId, relation: "same-receipt" });
      }
    }
  }

  const canonical = JSON.stringify({ nodes, edges });
  return {
    nodes,
    edges,
    graphHash: createHash("sha256").update(canonical).digest("hex"),
  };
}
