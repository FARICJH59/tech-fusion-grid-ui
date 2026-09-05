import type { IntelligenceCapability } from "../../hoare-contracts/src";

/** Structural source capability from the standalone hoare-ai lineage. */
export interface HoareAiSourceCapability {
  id: string;
  name: string;
  description: string;
  category: string;
  version?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Adapts hoare-ai discovery metadata into the canonical intelligence boundary.
 * This adapter intentionally does not grant runtime or execution authority.
 */
export function toIntelligenceCapability(
  source: HoareAiSourceCapability,
): IntelligenceCapability {
  return {
    id: source.id,
    name: source.name,
    description: source.description,
    category: source.category,
    version: source.version,
    provenance: "hoare-ai",
    metadata: source.metadata,
  };
}
