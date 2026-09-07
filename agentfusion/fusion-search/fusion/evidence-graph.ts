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
  relation:
    | "same-transaction"
    | "same-attempt"
    | "same-artifact"
    | "same-pasor-unit"
    | "same-receipt";
}>;

export type EvidenceGraph = Readonly<{
  nodes: readonly EvidenceGraphNode[];
  edges: readonly EvidenceGraphEdge[];
  graphHash: string;
}>;

/** Builds a deterministic, tenant-safe relationship graph over normalized evidence. */
export function buildEvidenceGraph(evidence: readonly FusionEvidence[], tenantId: string): EvidenceGraph {
  const owned = evidence.filter((item) => item.tenantId === tenantId);
  const nodes = owned.map((item) => ({
    id: item.evidenceId,
    kind: "evidence" as const,
    tenantId: item.tenantId,
    source: item.source,
    objectId: item.objectId,
    objectVersion: item.objectVersion,
  }));

  const edges: EvidenceGraphEdge[] = [];
  for (let i = 0; i < owned.length; i += 1) {
    for (let j = i + 1; j < owned.length; j += 1) {
      const left = owned[i];
      const right = owned[j];
      if (left.provenance.transactionId && left.provenance.transactionId === right.provenance.transactionId) {
        edges.push({ from: left.evidenceId, to: right.evidenceId, relation: "same-transaction" });
      }
      if (left.provenance.attemptId && left.provenance.attemptId === right.provenance.attemptId) {
        edges.push({ from: left.evidenceId, to: right.evidenceId, relation: "same-attempt" });
      }
      if (left.provenance.artifactDigest && left.provenance.artifactDigest === right.provenance.artifactDigest) {
        edges.push({ from: left.evidenceId, to: right.evidenceId, relation: "same-artifact" });
      }
      if (left.objectVersion && left.objectVersion === right.objectVersion && left.source === right.source) {
        edges.push({ from: left.evidenceId, to: right.evidenceId, relation: "same-pasor-unit" });
      }
      const leftContent = JSON.stringify(left.content);
      const rightContent = JSON.stringify(right.content);
      if (leftContent.includes("receiptId") && rightContent.includes("receiptId")) {
        const leftReceipt = (left.content as Record<string, unknown>).receiptId;
        const rightReceipt = (right.content as Record<string, unknown>).receiptId;
        if (typeof leftReceipt === "string" && leftReceipt === rightReceipt) {
          edges.push({ from: left.evidenceId, to: right.evidenceId, relation: "same-receipt" });
        }
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
