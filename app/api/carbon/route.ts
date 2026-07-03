import { NextResponse } from "next/server";
import { runAgent } from "@/hoare-ai/agent/agent";

type CarbonRequestBody = {
  sessionId?: string;
  payload?: {
    company?: string;
    sector?: string;
    projectType?: string;
    location?: string;
  };
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CarbonRequestBody;
    const payload = body.payload ?? {};

    const company = (payload.company ?? "").trim();
    const sector = (payload.sector ?? "").trim();
    const projectType = (payload.projectType ?? "").trim();
    const location = (payload.location ?? "").trim();

    if (!company || !sector || !projectType || !location) {
      return NextResponse.json(
        {
          error: "Missing required payload fields",
          required: ["company", "sector", "projectType", "location"],
        },
        { status: 400 }
      );
    }

    const agentResult = await runAgent(
      body.sessionId || "carbon-session",
      "carbon",
      { company, sector, projectType, location }
    );

    return NextResponse.json(agentResult);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
