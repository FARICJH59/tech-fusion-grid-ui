import type { BuilderPlan } from "../types";

export type GeneratedSurface = "frontend" | "backend" | "database" | "deployment";
export interface GeneratedArtifact { path: string; surface: GeneratedSurface; kind: "page" | "component" | "route" | "schema" | "manifest"; content: string; }
export interface ApplicationFactoryPlan { id: string; builderPlanId: string; tenantId: string; applicationName: string; frontend: { framework: "nextjs"; routes: string[]; components: string[] }; backend: { runtime: "nextjs-api"; routes: string[]; auth: "tenant-jwt" }; database: { engine: "postgresql"; tables: string[] }; artifacts: GeneratedArtifact[]; status: "compiled" | "approved" | "building" | "ready" | "failed"; }
export interface ApplicationFactoryInput { plan: BuilderPlan; description?: string; }
