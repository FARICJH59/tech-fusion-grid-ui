import { NextResponse } from "next/server";
import { customActionControlPlane, type ActionRequest, type ActionPolicy } from "@/agentfusion/control-plane";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { operation?: "authorize" | "execute" | "policy"; action?: ActionRequest; policy?: ActionPolicy; handlerResult?: unknown };
    if (!body.operation) return NextResponse.json({ error: "operation is required" }, { status: 400 });

    if (body.operation === "policy") {
      if (!body.action?.tenantId || !body.policy) return NextResponse.json({ error: "tenantId and policy are required" }, { status: 400 });
      customActionControlPlane.setPolicy(body.action.tenantId, body.policy);
      return NextResponse.json({ ok: true });
    }

    if (!body.action) return NextResponse.json({ error: "action is required" }, { status: 400 });
    if (body.operation === "authorize") return NextResponse.json(customActionControlPlane.authorize(body.action));

    const result = await customActionControlPlane.execute(body.action, async () => body.handlerResult);
    return NextResponse.json(result, { status: result.decision === "DENY" ? 403 : result.decision === "ESCALATE" ? 202 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
