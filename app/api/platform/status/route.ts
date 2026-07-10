import { NextResponse } from "next/server";
import { hoareEnterprisePlatform } from "@/lib/enterprise/platform";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    platform: "HOARE Enterprise Control Plane",
    status: hoareEnterprisePlatform.status(),
  });
}
