import { NextResponse } from "next/server";
import { getControlPlaneOverview } from "@/lib/hoare/control-plane-client";

export async function GET() {
  const overview = await getControlPlaneOverview();

  return NextResponse.json(overview, {
    status: overview.connected || overview.mode === "LOCAL_CONTROL_PLANE" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
