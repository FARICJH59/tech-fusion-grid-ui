import { CarbonPayload, scoreCarbonProject } from "../tools/carbon";

export type AgentKind = "carbon";

type AgentResult = {
  sessionId: string;
  kind: AgentKind;
  result: ReturnType<typeof scoreCarbonProject>;
  timestamp: string;
};

export async function runAgent(
  sessionId: string,
  kind: AgentKind,
  payload: CarbonPayload
): Promise<AgentResult> {
  if (kind !== "carbon") {
    throw new Error("Unsupported agent kind");
  }

  const result = scoreCarbonProject(payload);

  return {
    sessionId,
    kind,
    result,
    timestamp: new Date().toISOString(),
  };
}
