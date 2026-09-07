import { NextRequest, NextResponse } from "next/server";
import { evaluateBuilderPolicy, type BuilderPolicy } from "@/lib/hoare/builder/policy";
import type { BuilderPlan } from "@/lib/hoare/builder/types";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { plan?: BuilderPlan; policy?: BuilderPolicy };
    if (!body.plan) return NextResponse.json({ error: "plan is required" }, { status: 400 });
    const violations = evaluateBuilderPolicy(body.plan, body.policy);
    return NextResponse.json({ allowed: violations.length === 0, violations }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to evaluate policy" }, { status: 500 });
  }
}
