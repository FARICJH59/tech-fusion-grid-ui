export type BuilderResourceKind = "application" | "api" | "agent" | "model" | "workflow" | "tenant" | "infrastructure" | "domain";

export interface BuilderIntent {
  tenantId: string;
  name: string;
  description: string;
  resources: BuilderResourceKind[];
}

export interface BuilderPlan {
  id: string;
  intent: BuilderIntent;
  resources: Array<{ kind: BuilderResourceKind; name: string; dependsOn: string[] }>;
  deployment: { provider: string; environment: "development" | "staging" | "production" };
  status: "planned" | "approved" | "building" | "ready" | "failed";
}
