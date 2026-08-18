import type {
  DibAccelerationAssessment,
  DibConstraint,
  DibCriticalPath,
  DibNode,
  DibProductionRequirement,
} from "./types";

const RISK_WEIGHT: Record<DibConstraint["risk"], number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function riskFor(constraints: DibConstraint[]): DibConstraint["risk"] {
  const score = constraints.reduce((sum, item) => sum + RISK_WEIGHT[item.risk], 0);
  if (constraints.some((item) => item.risk === "critical") || score >= 8) return "critical";
  if (constraints.some((item) => item.risk === "high") || score >= 5) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function criticalPath(requirement: DibProductionRequirement): DibCriticalPath {
  const blocking = requirement.constraints.filter((item) => item.blocking);
  const byNode = new Map(requirement.nodes.map((node) => [node.id, node]));
  const nodeIds = blocking
    .sort((a, b) => b.estimatedDelayDays - a.estimatedDelayDays || a.nodeId.localeCompare(b.nodeId))
    .map((item) => item.nodeId)
    .filter((id, index, values) => values.indexOf(id) === index);

  const bottleneck = blocking
    .slice()
    .sort((a, b) => b.estimatedDelayDays - a.estimatedDelayDays || a.id.localeCompare(b.id))[0];

  const ordered = nodeIds.length
    ? nodeIds
    : requirement.nodes
        .slice()
        .sort((a, b) => (b.leadTimeDays ?? 0) - (a.leadTimeDays ?? 0) || a.id.localeCompare(b.id))
        .map((node) => node.id);

  return {
    nodeIds: ordered,
    estimatedDays: blocking.reduce((sum, item) => sum + item.estimatedDelayDays, 0),
    bottleneckNodeId: bottleneck?.nodeId,
    bottleneckConstraintId: bottleneck?.id,
  };
}

function purchaseOrderLeadTime(requirement: DibProductionRequirement, nodes: DibNode[]): number | undefined {
  const government = nodes.find((node) => node.type === "government");
  const manufacturer = nodes.find((node) => node.type === "manufacturer" || node.type === "tier3");
  if (!government || !manufacturer) return undefined;

  const poConstraint = requirement.constraints.find(
    (item) => item.type === "purchase_order" && item.nodeId === manufacturer.id,
  );
  return poConstraint?.estimatedDelayDays;
}

export function assessDibAcceleration(requirement: DibProductionRequirement): DibAccelerationAssessment {
  if (!requirement.tenantId || !requirement.programId) {
    throw new Error("INVALID_DIB_REQUIREMENT: tenantId and programId are required");
  }
  if (requirement.quantity <= 0) {
    throw new Error("INVALID_DIB_REQUIREMENT: quantity must be greater than zero");
  }
  if (!requirement.nodes.length) {
    throw new Error("INVALID_DIB_REQUIREMENT: at least one DIB node is required");
  }

  const path = criticalPath(requirement);
  const bottlenecks = requirement.constraints
    .filter((item) => item.blocking)
    .sort((a, b) => b.estimatedDelayDays - a.estimatedDelayDays || a.id.localeCompare(b.id));

  const actions = bottlenecks.slice(0, 5).map((constraint) => {
    switch (constraint.type) {
      case "purchase_order": return `Accelerate contracting/PO release for node ${constraint.nodeId}`;
      case "approval": return `Escalate approval dependency at node ${constraint.nodeId}`;
      case "capacity": return `Assess alternate capacity for node ${constraint.nodeId}`;
      case "material": return `Assess material substitution or alternate sourcing for node ${constraint.nodeId}`;
      case "inspection": return `Escalate inspection scheduling at node ${constraint.nodeId}`;
      case "workforce": return `Assess workforce/capacity mitigation at node ${constraint.nodeId}`;
      case "processing": return `Assess alternate processing capacity for node ${constraint.nodeId}`;
      case "requirement_change": return `Freeze or govern requirement changes affecting node ${constraint.nodeId}`;
      case "logistics": return `Assess alternate logistics routing for node ${constraint.nodeId}`;
      default: return `Assess supplier mitigation for node ${constraint.nodeId}`;
    }
  });

  return {
    requirementId: requirement.id,
    criticalPath: path,
    bottlenecks,
    totalEstimatedDelayDays: bottlenecks.reduce((sum, item) => sum + item.estimatedDelayDays, 0),
    governmentToManufacturerPoDays: purchaseOrderLeadTime(requirement, requirement.nodes),
    risk: riskFor(bottlenecks),
    recommendedActions: actions,
    authorizationRequired: actions.length > 0,
  };
}
