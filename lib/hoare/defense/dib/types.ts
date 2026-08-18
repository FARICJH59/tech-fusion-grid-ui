export type DibNodeType =
  | "government"
  | "prime"
  | "tier1"
  | "tier2"
  | "tier3"
  | "manufacturer"
  | "material"
  | "process"
  | "inspection"
  | "logistics";

export type DibConstraintType =
  | "approval"
  | "purchase_order"
  | "material"
  | "capacity"
  | "workforce"
  | "processing"
  | "inspection"
  | "requirement_change"
  | "logistics"
  | "supplier";

export type DibRiskLevel = "low" | "medium" | "high" | "critical";

export interface DibNode {
  id: string;
  name: string;
  type: DibNodeType;
  organizationId: string;
  parentId?: string;
  location?: string;
  capacity?: number;
  availableCapacity?: number;
  leadTimeDays?: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface DibDependency {
  fromId: string;
  toId: string;
  relationship: "supplies" | "requires" | "approves" | "inspects" | "ships";
  critical?: boolean;
}

export interface DibConstraint {
  id: string;
  nodeId: string;
  type: DibConstraintType;
  description: string;
  risk: DibRiskLevel;
  estimatedDelayDays: number;
  detectedAt: string;
  blocking: boolean;
}

export interface DibProductionRequirement {
  id: string;
  tenantId: string;
  programId: string;
  priority: "routine" | "urgent" | "mission_critical";
  quantity: number;
  targetDeliveryDate: string;
  identifiedAt: string;
  nodes: DibNode[];
  dependencies: DibDependency[];
  constraints: DibConstraint[];
}

export interface DibCriticalPath {
  nodeIds: string[];
  estimatedDays: number;
  bottleneckNodeId?: string;
  bottleneckConstraintId?: string;
}

export interface DibAccelerationAssessment {
  requirementId: string;
  criticalPath: DibCriticalPath;
  bottlenecks: DibConstraint[];
  totalEstimatedDelayDays: number;
  governmentToManufacturerPoDays?: number;
  risk: DibRiskLevel;
  recommendedActions: string[];
  authorizationRequired: boolean;
}
