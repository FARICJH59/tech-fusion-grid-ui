import { NextResponse } from "next/server";
import { analyzeShelfImage } from "@/lib/shelf-scouter/analyzer";
import { findCatalogLocation } from "@/lib/shelf-scouter/catalog";
import type { ShelfScanResult } from "@/lib/shelf-scouter/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const tenantId = request.headers.get("x-tenant-id")?.trim() || "local-demo";

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

    const bytes = Buffer.from(await file.arrayBuffer());
    const analysis = await analyzeShelfImage(bytes, file.type);
    const location = await findCatalogLocation(analysis.observation, storeId);

    const result: ShelfScanResult = {
      tenantId,
      observation: analysis.observation,
      location,
      guidance: location
        ? [
            `Go to aisle ${location.aisle}.`,
            location.section ? `Look in ${location.section}.` : "Use the section signage to narrow the search.",
            location.bay ? `Target bay ${location.bay}.` : "Scan the shelf left-to-right if the bay is not marked.",
          ]
        : [
            "Product identified, but no store-layout match was found.",
            "Use the retailer catalog adapter or scan a clearer shelf label.",
          ],
      mode: analysis.mode === "vision" ? "vision+catalog" : "demo",
      requestId,
    };

    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("[shelf-scouter] scan failed", { requestId, error });
    return NextResponse.json(
      { error: "SHELF_SCAN_FAILED", requestId },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
