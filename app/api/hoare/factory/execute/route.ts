import { NextResponse } from "next/server";
import {
  createApplicationBuildPlan,
  validateApplicationBuildPlan,
  type ApplicationIntent,
} from "@/lib/hoare/factory/application-contract";
import { executeNativeApplication } from "@/lib/hoare/factory/application-execution";

export async function POST(request: Request) {
  try {
    const intent = (await request.json()) as ApplicationIntent;
    const plan = createApplicationBuildPlan(intent);
    validateApplicationBuildPlan(plan);
    const result = await executeNativeApplication(plan);

    return NextResponse.json({
      ok: true,
      lifecycle: result.lifecycle,
      executionBoundary: "hoare-governed-builder",
      result,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Application execution failed" },
      { status: 400 },
    );
  }
}
