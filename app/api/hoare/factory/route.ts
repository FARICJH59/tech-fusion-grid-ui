import { NextResponse } from "next/server";
import {
  createApplicationBuildPlan,
  validateApplicationBuildPlan,
  type ApplicationIntent,
} from "@/lib/hoare/factory/application-contract";

export async function POST(request: Request) {
  try {
    const intent = (await request.json()) as ApplicationIntent;
    const plan = createApplicationBuildPlan(intent);
    validateApplicationBuildPlan(plan);

    return NextResponse.json(
      {
        ok: true,
        lifecycle: "planned",
        executionBoundary: "hoare-governed-runtime",
        plan,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Invalid application intent" },
      { status: 400 },
    );
  }
}
