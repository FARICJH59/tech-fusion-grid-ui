import { NextResponse } from "next/server";
import { FusionSearch } from "@/lib/fusion-search";
import { createConfiguredFusionSearchSource } from "@/lib/fusion-search/http-source";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { query?: string; limit?: number };
    const query = body.query?.trim();
    if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 });
    const search = new FusionSearch([createConfiguredFusionSearchSource()]);
    const results = await search.search(query, { limit: body.limit });
    return NextResponse.json({ query, results, retrievedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}
