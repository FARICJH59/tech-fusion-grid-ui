import { NextResponse } from "next/server";
import { buildResource, type BuilderRequest } from "@/lib/hoare/builder";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<BuilderRequest>;
    const artifact = buildResource({
      tenantId: body.tenantId || "",
      name: body.name || "",
      kind: body.kind || "agent",
      description: body.description,
      capabilities: body.capabilities,
      mode: body.mode,
      runtime: body.runtime,
    });

    return NextResponse.json({
      success: true,
      lifecycle: ["DESIGN", "GOVERN", "DEPLOY"],
      artifact,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "builder request failed",
    }, { status: 400 });
  }
}
