import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createPasorPlan } from "@/builder/pasor/execution-plan";
import type { ProjectInventory } from "@/builder/inventory/project-inventory";

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function inventoryFromIntent(body: { projectId: string; tenantId: string; prompt: string }): ProjectInventory {
  const prompt = body.prompt.toLowerCase();
  const languages = ["typescript"];
  const frameworks = ["next.js"];
  const add = (value: string) => {
    if (!languages.includes(value)) languages.push(value);
  };

  if (/python|ml|machine learning|pytorch|tensorflow/.test(prompt)) add("python");
  if (/rust/.test(prompt)) add("rust");
  if (/cpp|c\+\+|native/.test(prompt)) add("cpp");

  const inventoryBase = {
    schema: "hoare.project-inventory/v1" as const,
    project_id: body.projectId,
    tenant_id: body.tenantId,
    detected: {
      languages,
      frameworks,
      has_github_actions: true,
      has_cpp: languages.includes("cpp"),
      build_systems: languages.includes("cpp") ? ["cmake"] : ["npm"],
      has_aegisc: /aegis|aegisc|security|cyber|policy/.test(prompt),
      has_pasor: true,
    },
  };

  return {
    ...inventoryBase,
    provenance_hash: hash(inventoryBase),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.projectId || !body.tenantId || !body.prompt) {
      return NextResponse.json({ error: "projectId, tenantId, and prompt are required" }, { status: 400 });
    }

    const inventory = inventoryFromIntent(body);
    const plan = createPasorPlan(inventory);

    return NextResponse.json({
      ok: true,
      planner: "PASOR",
      inventory,
      plan,
      governance: {
        execution_authorized: false,
        reason: "plan_only_until_HOARE_policy_admission",
      },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create PASOR plan" }, { status: 400 });
  }
}
