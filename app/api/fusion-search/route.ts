import { NextResponse } from "next/server";
import { createFusionSearchProvider } from "@/agentfusion/search/fusion-search";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { query?: string; limit?: number; tenantId?: string; sources?: string[] };
    if (!body.query?.trim()) return NextResponse.json({ error: "query is required" }, { status: 400 });
    const provider = createFusionSearchProvider();
    const results = await provider.search({ query: body.query.trim(), limit: body.limit, tenantId: body.tenantId, sources: body.sources });
    return NextResponse.json({ query: body.query.trim(), results, retrievedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}
