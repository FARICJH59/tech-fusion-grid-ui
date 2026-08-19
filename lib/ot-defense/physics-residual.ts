import { AssetRef, DigitalTwinState, PhysicsResidual } from "./contracts";

export interface ResidualRule {
  name: string;
  threshold: number;
  scale?: number;
  direction?: "ABS" | "POSITIVE" | "NEGATIVE";
}

export interface PhysicsResidualEngine {
  compute(input: {
    twin: DigitalTwinState;
    observed: Record<string, number>;
    rules?: ResidualRule[];
  }): PhysicsResidual;
}

function deviation(observed: number, expected: number, scale: number): number {
  return Math.abs(observed - expected) / Math.max(Math.abs(scale), Number.EPSILON);
}

export class DeterministicPhysicsResidualEngine implements PhysicsResidualEngine {
  constructor(private readonly engineVersion = "physics-residual-v1") {}

  compute({ twin, observed, rules = [] }: Parameters<PhysicsResidualEngine["compute"]>[0]): PhysicsResidual {
    const residuals: Record<string, number> = {};
    const violatedInvariants: string[] = [];

    for (const [name, expected] of Object.entries(twin.predictedVector)) {
      const value = observed[name] ?? twin.stateVector[name];
      if (value === undefined) continue;
      residuals[name] = deviation(value, expected, 1);
    }

    for (const rule of rules) {
      const value = observed[rule.name] ?? twin.stateVector[rule.name];
      const expected = twin.predictedVector[rule.name];
      if (value === undefined || expected === undefined) continue;
      const scale = rule.scale ?? 1;
      const raw = (value - expected) / Math.max(Math.abs(scale), Number.EPSILON);
      const directional = rule.direction === "POSITIVE" ? Math.max(raw, 0) : rule.direction === "NEGATIVE" ? Math.max(-raw, 0) : Math.abs(raw);
      residuals[rule.name] = Math.min(1, directional);
      if (directional >= rule.threshold) violatedInvariants.push(rule.name);
    }

    const values = Object.values(residuals);
    const score = values.length ? Math.min(1, Math.max(...values)) : 0;
    const threshold = rules.length ? Math.min(...rules.map((r) => r.threshold)) : 0.5;

    return {
      asset: AssetRef.parse(twin.asset),
      computedAt: new Date().toISOString(),
      score,
      threshold,
      violatedInvariants,
      residuals,
      modelVersion: this.engineVersion,
    };
  }
}
