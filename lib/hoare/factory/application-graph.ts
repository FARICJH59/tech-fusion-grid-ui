import type { ApplicationBuildPlan, ApplicationComponent } from "./application-contract";

export interface ApplicationGraphNode extends ApplicationComponent {
  order: number;
}

export interface ApplicationArtifactGraph {
  nodes: ApplicationGraphNode[];
  waves: string[][];
}

export function buildApplicationArtifactGraph(plan: ApplicationBuildPlan): ApplicationArtifactGraph {
  const components = new Map(plan.components.map((component) => [component.id, component]));
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const component of plan.components) {
    indegree.set(component.id, component.dependsOn.length);
    for (const dependency of component.dependsOn) {
      if (!components.has(dependency)) {
        throw new Error(`Missing component dependency: ${component.id} -> ${dependency}`);
      }
      dependents.set(dependency, [...(dependents.get(dependency) ?? []), component.id]);
    }
  }

  let frontier = plan.components
    .filter((component) => (indegree.get(component.id) ?? 0) === 0)
    .map((component) => component.id)
    .sort();

  const waves: string[][] = [];
  const ordered: ApplicationGraphNode[] = [];
  let order = 0;

  while (frontier.length > 0) {
    const wave = [...frontier].sort();
    waves.push(wave);
    const next: string[] = [];

    for (const id of wave) {
      const component = components.get(id)!;
      ordered.push({ ...component, order: order++ });

      for (const dependent of dependents.get(id) ?? []) {
        const remaining = (indegree.get(dependent) ?? 0) - 1;
        indegree.set(dependent, remaining);
        if (remaining === 0) next.push(dependent);
      }
    }

    frontier = [...new Set(next)].sort();
  }

  if (ordered.length !== plan.components.length) {
    throw new Error("Circular application component dependency detected");
  }

  return { nodes: ordered, waves };
}
