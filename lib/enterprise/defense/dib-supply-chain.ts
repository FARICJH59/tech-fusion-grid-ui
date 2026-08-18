export type DIBNodeType =
  | "supplier"
  | "parent"
  | "component"
  | "program"
  | "mission"
  | "service";

export type DIBRiskFactor =
  | "foreign-control"
  | "adversarial-source"
  | "single-source"
  | "geographic-concentration"
  | "critical-component"
  | "provenance-gap";

export type DIBNode = {
  id: string;
  type: DIBNodeType;
  name: string;
  country?: string;
  riskFactors?: DIBRiskFactor[];
  criticality?: number;
};

export type DIBEdge = {
  from: string;
  to: string;
  relationship: "supplies" | "owns" | "depends-on" | "supports";
  criticality?: number;
};

export type DIBSupplyGraph = {
  nodes: DIBNode[];
  edges: DIBEdge[];
};

export type DIBRisk = {
  nodeId: string;
  score: number;
  severity: "low" | "moderate" | "high" | "critical";
  factors: DIBRiskFactor[];
  rationale: string[];
};

export type DIBAction =
  | "supplier-review"
  | "provenance-request"
  | "alternate-source-analysis"
  | "mission-impact-assessment"
  | "escalate-program-security";

export type DIBActionPlan = {
  action: DIBAction;
  priority: "routine" | "high" | "urgent";
  reason: string;
  requiresApproval: boolean;
};

export type DIBAssessment = {
  assessedAt: string;
  nodeCount: number;
  edgeCount: number;
  risks: DIBRisk[];
  actions: DIBActionPlan[];
  criticalPath: string[];
};

const WEIGHTS: Record<DIBRiskFactor, number> = {
  "foreign-control": 25,
  "adversarial-source": 35,
  "single-source": 20,
  "geographic-concentration": 15,
  "critical-component": 20,
  "provenance-gap": 15,
};

function severity(score: number): DIBRisk["severity"] {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "moderate";
  return "low";
}

export function assessDIBSupplyChain(graph: DIBSupplyGraph): DIBAssessment {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const validEdges = graph.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
  const outgoing = new Map<string, number>();

  for (const edge of validEdges) {
    outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + 1);
  }

  const risks = graph.nodes.map((node) => {
    const factors = [...(node.riskFactors ?? [])];
    if ((outgoing.get(node.id) ?? 0) === 1 && node.type === "supplier") {
      factors.push("single-source");
    }
    if (node.criticality !== undefined && node.criticality >= 8) {
      factors.push("critical-component");
    }
    const uniqueFactors = [...new Set(factors)];
    const score = Math.min(100, uniqueFactors.reduce((total, factor) => total + WEIGHTS[factor], 0));
    return {
      nodeId: node.id,
      score,
      severity: severity(score),
      factors: uniqueFactors,
      rationale: uniqueFactors.map((factor) => `${factor} contributes ${WEIGHTS[factor]} risk points`),
    };
  });

  const actions: DIBActionPlan[] = [];
  for (const risk of risks.filter((item) => item.score >= 25)) {
    if (risk.factors.includes("provenance-gap")) {
      actions.push({
        action: "provenance-request",
        priority: risk.score >= 75 ? "urgent" : "high",
        reason: `Evidence of origin/authenticity is incomplete for ${risk.nodeId}.`,
        requiresApproval: false,
      });
    }
    if (risk.factors.includes("single-source") || risk.factors.includes("adversarial-source")) {
      actions.push({
        action: "alternate-source-analysis",
        priority: risk.score >= 75 ? "urgent" : "high",
        reason: `Dependency resilience requires alternate-source analysis for ${risk.nodeId}.`,
        requiresApproval: false,
      });
    }
    if (risk.factors.includes("foreign-control") || risk.factors.includes("adversarial-source")) {
      actions.push({
        action: "supplier-review",
        priority: risk.score >= 75 ? "urgent" : "high",
        reason: `Ownership/control exposure requires supplier review for ${risk.nodeId}.`,
        requiresApproval: true,
      });
    }
    if (risk.severity === "critical") {
      actions.push({
        action: "mission-impact-assessment",
        priority: "urgent",
        reason: `Critical supply-chain risk may propagate to mission dependencies through ${risk.nodeId}.`,
        requiresApproval: true,
      });
    }
  }

  const criticalNodes = risks
    .filter((risk) => risk.severity === "critical")
    .sort((a, b) => b.score - a.score)
    .map((risk) => risk.nodeId);

  return {
    assessedAt: new Date().toISOString(),
    nodeCount: graph.nodes.length,
    edgeCount: validEdges.length,
    risks: risks.sort((a, b) => b.score - a.score),
    actions,
    criticalPath: criticalNodes,
  };
}

export const DIB_SUPPLY_CHAIN_SERVICE = {
  name: "hoare-defense-dib-supply-chain",
  version: "v1",
  layer: "defense-mission-service",
  capabilities: [
    "multi-tier-supply-graph",
    "supplier-risk-scoring",
    "provenance-gap-detection",
    "single-source-detection",
    "critical-path-identification",
    "governed-action-planning",
  ],
  executionBoundary: "HOARE runtime + authorization + runbooks",
} as const;
