import { NextResponse } from "next/server";

export async function GET() {
  const mcpUrl = process.env.HOARE_MCP_URL;

  if (!mcpUrl) {
    return NextResponse.json({
      status: "DEGRADED",
      mode: "LOCAL_CONTROL_PLANE",
      reason: "HOARE_MCP_URL is not configured",
      controlPlane: "ONLINE",
      runtime: "UNCONNECTED",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const response = await fetch(`${mcpUrl.replace(/\/$/, "")}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const health = await response.json();

    return NextResponse.json({
      status: response.ok ? "ONLINE" : "DEGRADED",
      mode: "MCP_CONNECTED",
      controlPlane: "ONLINE",
      runtime: health.status || "UNKNOWN",
      health,
      timestamp: new Date().toISOString(),
    }, { status: response.ok ? 200 : 503 });
  } catch (error) {
    return NextResponse.json({
      status: "DEGRADED",
      mode: "MCP_CONFIGURED",
      controlPlane: "ONLINE",
      runtime: "UNREACHABLE",
      reason: error instanceof Error ? error.message : "MCP health check failed",
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}
