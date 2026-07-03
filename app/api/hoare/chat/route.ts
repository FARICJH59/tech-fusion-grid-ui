import { NextRequest, NextResponse } from "next/server";
import { chat, createSession } from "@/hoare-agent/agent";

export async function POST(req: NextRequest) {
  try {
    const { sessionId, message } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    const sid = sessionId ?? createSession().id;
    const reply = chat(sid, message);

    return NextResponse.json({ sessionId: sid, reply });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
