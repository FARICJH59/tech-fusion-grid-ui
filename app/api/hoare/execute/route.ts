import { NextRequest, NextResponse } from "next/server";
import { executeTool } from "@/hoare-agent/agent";

export async function POST(req: NextRequest) {
  try {
    const { tool, parameters } = await req.json();

    if (!tool || typeof tool !== "string") {
      return NextResponse.json(
        { error: "tool name is required" },
        { status: 400 }
      );
    }

    const result = executeTool({ tool, parameters: parameters ?? {} });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ result: result.output });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
