import crypto from "node:crypto";

export type BuilderResourceKind = "agent" | "workflow" | "service" | "iot";
export type BuilderMode = "controlled" | "autonomous";

export interface BuilderRequest {
  tenantId: string;
  name: string;
  kind: BuilderResourceKind;
  description?: string;
  capabilities?: string[];
  mode?: BuilderMode;
  runtime?: string;
}

export interface HoareArtifact {
  id: string;
  tenantId: string;
  name: string;
  kind: BuilderResourceKind;
  version: string;
  description: string;
  capabilities: string[];
  mode: BuilderMode;
  runtime: string;
  createdAt: string;
  status: "DESIGNED";
  signature: string;
}

const allowedKinds = new Set<BuilderResourceKind>(["agent", "workflow", "service", "iot"]);

export function buildResource(input: BuilderRequest): HoareArtifact {
  if (!input.tenantId?.trim()) throw new Error("tenantId is required");
  if (!input.name?.trim()) throw new Error("name is required");
  if (!allowedKinds.has(input.kind)) throw new Error("unsupported resource kind");

  const artifact: Omit<HoareArtifact, "signature"> = {
    id: crypto.randomUUID(),
    tenantId: input.tenantId.trim(),
    name: input.name.trim(),
    kind: input.kind,
    version: "1.0.0",
    description: input.description?.trim() || "HOARE managed resource",
    capabilities: [...new Set(input.capabilities || [])].slice(0, 50),
    mode: input.mode || "controlled",
    runtime: input.runtime?.trim() || "hoare-runtime",
    createdAt: new Date().toISOString(),
    status: "DESIGNED",
  };

  const digest = crypto.createHash("sha256").update(JSON.stringify(artifact)).digest("hex");
  return { ...artifact, signature: `HOARE-BUILDER-${digest}` };
}
