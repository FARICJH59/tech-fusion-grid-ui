import { createHash } from "node:crypto";

export type ApplicationComponentKind =
  | "frontend"
  | "backend"
  | "database"
  | "auth"
  | "events"
  | "worker"
  | "agent"
  | "infrastructure";

export type ApplicationTarget = "owned-runtime" | "cloudflare" | "cloud" | "edge" | "local";

export interface ApplicationIntent {
  tenantId: string;
  projectId: string;
  name: string;
  description: string;
  frontend?: { framework?: string; routes?: string[] };
  backend?: { runtime?: string; apiStyle?: "rest" | "rpc" | "graphql" };
  data?: { provider?: string; entities?: string[] };
  targets?: ApplicationTarget[];
}

export interface ApplicationComponent {
  id: string;
  kind: ApplicationComponentKind;
  name: string;
  dependsOn: string[];
  contract: Record<string, unknown>;
}

export interface ApplicationBuildPlan {
  version: "1";
  tenantId: string;
  projectId: string;
  name: string;
  target: ApplicationTarget;
  components: ApplicationComponent[];
  releaseDigest: string;
}

function canonical(value: unknown): string {
  return JSON.stringify(value, Object.keys((value ?? {}) as object).sort());
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function createApplicationBuildPlan(intent: ApplicationIntent): ApplicationBuildPlan {
  if (!intent.tenantId || !intent.projectId || !intent.name) {
    throw new Error("tenantId, projectId, and name are required");
  }

  const components: ApplicationComponent[] = [
    {
      id: "frontend",
      kind: "frontend",
      name: `${intent.name}-frontend`,
      dependsOn: ["backend"],
      contract: {
        framework: intent.frontend?.framework ?? "owned-ui",
        routes: intent.frontend?.routes ?? ["/"],
        backendContract: "application-api-v1",
      },
    },
    {
      id: "backend",
      kind: "backend",
      name: `${intent.name}-backend`,
      dependsOn: ["data", "auth", "events"],
      contract: {
        runtime: intent.backend?.runtime ?? "node",
        apiStyle: intent.backend?.apiStyle ?? "rest",
        contractVersion: "application-api-v1",
      },
    },
    {
      id: "data",
      kind: "database",
      name: `${intent.name}-data`,
      dependsOn: [],
      contract: {
        provider: intent.data?.provider ?? "managed-postgres",
        entities: intent.data?.entities ?? [],
      },
    },
    {
      id: "auth",
      kind: "auth",
      name: `${intent.name}-auth`,
      dependsOn: [],
      contract: { mode: "tenant-scoped", sessionBoundary: "backend" },
    },
    {
      id: "events",
      kind: "events",
      name: `${intent.name}-events`,
      dependsOn: [],
      contract: { protocol: "platform-event-v1", idempotent: true },
    },
  ];

  const target = intent.targets?.[0] ?? "owned-runtime";
  const unsigned = {
    version: "1" as const,
    tenantId: intent.tenantId,
    projectId: intent.projectId,
    name: intent.name,
    target,
    components,
  };

  return { ...unsigned, releaseDigest: digest(unsigned) };
}

export function validateApplicationBuildPlan(plan: ApplicationBuildPlan): void {
  if (plan.version !== "1") throw new Error("Unsupported application plan version");
  if (!plan.tenantId || !plan.projectId || !plan.releaseDigest) {
    throw new Error("Application plan identity is incomplete");
  }

  const ids = new Set<string>();
  for (const component of plan.components) {
    if (ids.has(component.id)) throw new Error(`Duplicate component: ${component.id}`);
    ids.add(component.id);
  }

  for (const component of plan.components) {
    for (const dependency of component.dependsOn) {
      if (!ids.has(dependency)) {
        throw new Error(`Missing component dependency: ${component.id} -> ${dependency}`);
      }
    }
  }
}
