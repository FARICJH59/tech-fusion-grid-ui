import { NextResponse } from "next/server";
import { getAvailableTools } from "@/hoare-agent/agent";

export async function GET() {
  const tools = getAvailableTools();
  return NextResponse.json({ tools });
}
