import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      tenantId?: string;
      projectId?: string;
      hostname?: string;
      deploymentId?: string;
    };

    if (!body.tenantId || !body.projectId || !body.hostname || !body.deploymentId) {
      return NextResponse.json({ ok: false, error: "tenantId, projectId, hostname, and deploymentId are required" }, { status: 400 });
    }

    const hostname = body.hostname.toLowerCase().trim();
    if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname)) {
      return NextResponse.json({ ok: false, error: "Invalid hostname" }, { status: 400 });
    }

    const bindingId = `dom_${createHash("sha256")
      .update(`${body.tenantId}:${body.projectId}:${body.deploymentId}:${hostname}`)
      .digest("hex")
      .slice(0, 24)}`;

    return NextResponse.json({
      ok: true,
      controlPlane: "hoare",
      adapter: "cloudflare",
      binding: {
        bindingId,
        tenantId: body.tenantId,
        projectId: body.projectId,
        deploymentId: body.deploymentId,
        hostname,
        status: "ready",
        ownership: "hoare",
      },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Domain binding failed" }, { status: 400 });
  }
}
