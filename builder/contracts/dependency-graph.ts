import type { ExecutionUnit } from "./execution-unit";

export interface DependencyGraph {
  nodes: string[];
  edges: Array<{ from: string; to: string }>;
}

export function buildDependencyGraph(units: ExecutionUnit[]): DependencyGraph {
  const ids = new Set(units.map((unit) => unit.unit_id));
  const edges: DependencyGraph["edges"] = [];

  for (const unit of units) {
    for (const dependency of unit.dependencies) {
      if (!ids.has(dependency)) {
        throw new Error(`Unknown dependency: ${dependency}`);
      }
      if (dependency === unit.unit_id) {
        throw new Error(`Self dependency: ${unit.unit_id}`);
      }
      edges.push({ from: dependency, to: unit.unit_id });
    }
  }

  return { nodes: [...ids], edges };
}
