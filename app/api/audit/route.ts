/**
 * GET /api/audit — Return the audit log for the tenant
 *
 * Protected: requires at least the "operator" role.
 */

import { NextResponse, type NextRequest } from "next/server";
import { verifyToken, extractBearerToken, hasMinRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type AuditRow = {
  id: string;
  actor_id: string;
  action: string;
  details: string;
  timestamp: string;
  tenant_id: string;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Auth
  const token = extractBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let user;
  try {
    user = verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasMinRole(user.role, "operator")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const rawLimit = parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, rawLimit), MAX_LIMIT)
    : DEFAULT_LIMIT;

  try {
    const { data, error } = await supabase
      .from("audit_events")
      .select("id, actor_id, action, details, timestamp, tenant_id")
      .eq("tenant_id", user.tenantId)
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch audit log" }, { status: 500 });
    }

    return NextResponse.json({ data: (data ?? []) as AuditRow[], count: (data ?? []).length });
  } catch (err) {
    console.error("[api/audit] Error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
