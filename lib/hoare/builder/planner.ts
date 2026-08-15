import type { BuilderIntent, BuilderPlan, BuilderResourceKind } from "./types";

const dependencies: Record<BuilderResourceKind, BuilderResourceKind[]> = {
  tenant: [], domain: ["tenant"], infrastructure: ["tenant"], application: ["tenant", "infrastructure"], api: ["application"], agent: ["application"], model: ["tenant", "infrastructure"], workflow: ["application"],
};

export function planBuilderIntent(intent: BuilderIntent, provider = "hoare", environment: BuilderPlan["deployment"]["environment"] = "development"): BuilderPlan {
  const requested = [...new Set(intent.resources)];
  const ordered = requested.sort((a, b) => dependencies[a].length - dependencies[b].length);
  return {
    id: `builder-${Date.now().toString(36)}`,
    intent,
    resources: ordered.map((kind) => ({ kind, name: `${intent.name}-${kind}`, dependsOn: dependencies[kind].filter((d) => requested.includes(d)).map((d) => `${intent.name}-${d}`) })),
    deployment: { provider, environment },
    status: "planned",
  };
}
