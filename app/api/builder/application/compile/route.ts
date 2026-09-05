import { NextResponse } from "next/server";
import { planBuilderIntent } from "@/lib/hoare/builder/planner";
import { compileApplicationFactory } from "@/lib/hoare/builder/app-factory/compiler";
import type { BuilderIntent } from "@/lib/hoare/builder/types";

const resourceKinds = new Set([
  "application",
  "api",
  "agent",
  "model",
  "workflow",
  "tenant",
  "infrastructure",
  "domain",
]);

function parseIntent(value: unknown): BuilderIntent {
  if (!value || typeof value !== "object") throw new Error("intent is required");
  const input = value as Record<string, unknown>;
  if (typeof input.tenantId !== "string" || !input.tenantId.trim()) throw new Error("tenantId is required");
  if (typeof input.name !== "string" || !input.name.trim()) throw new Error("name is required");
  if (typeof input.description !== "string") throw new Error("description is required");
  if (!Array.isArray(input.resources) || input.resources.length === 0) throw new Error("resources must be a non-empty array");
  const resources = input.resources.filter((resource): resource is BuilderIntent["resources"][number] => typeof resource === "string" && resourceKinds.has(resource));
  if (resources.length !== input.resources.length) throw new Error("resources contains an unsupported kind");
  return { tenantId: input.tenantId.trim(), name: input.name.trim(), description: input.description, resources };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const intent = parseIntent(body.intent);
    const environment = body.environment === "production" || body.environment === "staging" ? body.environment : "development";
    const builderPlan = planBuilderIntent(intent, "hoare", environment);
    const factoryPlan = compileApplicationFactory({ plan: builderPlan, description: body.description });

    return NextResponse.json({
      ok: true,
      builderPlan,
      factoryPlan,
      next: "approval",
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Invalid builder request" }, { status: 400 });
  }
}
