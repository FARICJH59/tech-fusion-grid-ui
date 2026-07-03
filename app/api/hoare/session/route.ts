import { NextRequest, NextResponse } from "next/server";
import { createSession, getSession, listSessions } from "@/hoare-agent/agent";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const session = getSession(id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ session });
  }

  return NextResponse.json({ sessions: listSessions() });
}

export async function POST() {
  const session = createSession();
  return NextResponse.json({ session }, { status: 201 });
}
