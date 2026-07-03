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
  let body: CarbonRequestBody;

  try {
    body = (await req.json()) as CarbonRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

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

  try {
    const agentResult = await runAgent(
      body.sessionId || "carbon-session",
      "carbon",
      { company, sector, projectType, location }
    );

    return NextResponse.json(agentResult);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run carbon agent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
