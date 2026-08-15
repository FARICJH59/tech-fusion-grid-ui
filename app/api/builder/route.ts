import { NextResponse } from "next/server";
import { buildResource, type BuilderRequest } from "@/lib/hoare/builder";
import { governResource } from "@/lib/hoare/control-plane";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<BuilderRequest>;
    const input: BuilderRequest = {
      tenantId: body.tenantId || "",
      name: body.name || "",
      kind: body.kind || "agent",
      description: body.description,
      capabilities: body.capabilities,
      mode: body.mode,
      runtime: body.runtime,
    };

    const artifact = buildResource(input);
    const governance = governResource(input, artifact);

    return NextResponse.json({
      success: governance.decision === "ALLOW",
      lifecycle: ["DESIGN", "GOVERN", "DEPLOY"],
      governance,
      artifact: governance.decision === "ALLOW" ? artifact : undefined,
    }, { status: governance.decision === "ALLOW" ? 201 : 403 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "builder request failed",
    }, { status: 400 });
  }
}
