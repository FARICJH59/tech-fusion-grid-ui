import { NextResponse } from "next/server";
import { hoareEnterprisePlatform } from "@/lib/enterprise/platform";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    runtime: "HOARE-Agent",
    integratedWithControlPlane: true,
    services: hoareEnterprisePlatform.runtime.list(),
    health: hoareEnterprisePlatform.runtime.getHealth(),
  });
}
