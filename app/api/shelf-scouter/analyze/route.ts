import { NextResponse } from "next/server";
import { executeShelfScan } from "@/agentfusion/adapters/shelf-scouter-agent";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const tenantId = request.headers.get("x-tenant-id")?.trim() || "local-demo";
  const actorId = request.headers.get("x-actor-id")?.trim() || "shelf-scouter-client";

  try {
    const form = await request.formData();
    const file = form.get("image");
    const storeId = String(form.get("storeId") || "demo-store").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "IMAGE_REQUIRED", requestId }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "IMAGE_TYPE_REQUIRED", requestId }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "IMAGE_TOO_LARGE", requestId }, { status: 413 });
    }

    const result = await executeShelfScan({
      tenantId,
      actorId,
      requestId,
      storeId,
      bytes: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
    });

    if (result.status !== "completed") {
      return NextResponse.json(
        { error: "SHELF_SCAN_FAILED", requestId, executionId: `shelf-scouter:${requestId}`, details: result.error },
        { status: 500, headers: { "cache-control": "no-store" } },
      );
    }

    return NextResponse.json(result.output, {
      headers: { "cache-control": "no-store", "x-hoare-agent": "shelf-scouter@1.0.0" },
    });
  } catch (error) {
    console.error("[hoare:shelf-scouter] scan failed", { requestId, error });
    return NextResponse.json(
      { error: "SHELF_SCAN_FAILED", requestId },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
