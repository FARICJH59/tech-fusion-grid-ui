import type { BuilderIntent, BuilderPlan, BuilderResourceKind } from "./types";

const dependencies: Record<BuilderResourceKind, BuilderResourceKind[]> = {
  tenant: [],
  domain: ["tenant"],
  infrastructure: ["tenant"],
  application: ["tenant", "infrastructure"],
  api: ["application"],
  agent: ["application"],
  model: ["tenant", "infrastructure"],
  workflow: ["application"],
};

function orderResources(requested: BuilderResourceKind[]): BuilderResourceKind[] {
  const requestedSet = new Set(requested);
  const ordered: BuilderResourceKind[] = [];
  const visiting = new Set<BuilderResourceKind>();
  const visited = new Set<BuilderResourceKind>();

  function visit(kind: BuilderResourceKind): void {
    if (visited.has(kind)) return;
    if (visiting.has(kind)) throw new Error(`Circular builder dependency detected at ${kind}`);
    visiting.add(kind);

    for (const dependency of dependencies[kind]) {
      if (requestedSet.has(dependency)) visit(dependency);
    }

    visiting.delete(kind);
    visited.add(kind);
    ordered.push(kind);
  }

  for (const kind of requested) visit(kind);
  return ordered;
}

export function planBuilderIntent(
  intent: BuilderIntent,
  provider = "hoare",
  environment: BuilderPlan["deployment"]["environment"] = "development",
): BuilderPlan {
  const requested = [...new Set(intent.resources)];
  const ordered = orderResources(requested);

  return {
    id: `builder-${Date.now().toString(36)}`,
    intent: { ...intent, resources: requested },
    resources: ordered.map((kind) => ({
      kind,
      name: `${intent.name}-${kind}`,
      dependsOn: dependencies[kind]
        .filter((dependency) => requested.includes(dependency))
        .map((dependency) => `${intent.name}-${dependency}`),
    })),
    deployment: { provider, environment },
    status: "planned",
  };
}
