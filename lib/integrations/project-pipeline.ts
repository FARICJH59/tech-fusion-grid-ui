export type PipelineStage = "pasor" | "aegis";

export type PipelineContext = {
  tenantId: string;
  projectId: string;
  repository: string;
  sourceSha: string;
};

export type PipelineResult = {
  stage: PipelineStage;
  status: "passed" | "blocked" | "failed";
  requestId?: string;
  artifactRef?: string;
  result?: Record<string, unknown>;
};

async function invokeConfiguredStage(
  stage: PipelineStage,
  context: PipelineContext,
): Promise<PipelineResult> {
  const baseUrl = stage === "pasor" ? process.env.PASOR_API_URL : process.env.AEGIS_API_URL;
  if (!baseUrl) {
    return {
      stage,
      status: "blocked",
      result: { reason: `${stage.toUpperCase()}_API_URL is not configured` },
    };
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/projects/${stage}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.HOARE_INTERNAL_SERVICE_KEY
        ? { "x-hoare-service-key": process.env.HOARE_INTERNAL_SERVICE_KEY }
        : {}),
    },
    body: JSON.stringify(context),
    cache: "no-store",
  });

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    return { stage, status: "failed", result: { http_status: response.status, ...body } };
  }

  return {
    stage,
    status: "passed",
    requestId: typeof body.request_id === "string" ? body.request_id : undefined,
    artifactRef: typeof body.artifact_ref === "string" ? body.artifact_ref : undefined,
    result: body,
  };
}

export async function runProjectPipeline(context: PipelineContext): Promise<PipelineResult[]> {
  const pasor = await invokeConfiguredStage("pasor", context);
  if (pasor.status !== "passed") return [pasor];

  // AEGIS is a mandatory verification gate. Never fall through to deployment if it is absent or fails.
  const aegis = await invokeConfiguredStage("aegis", {
    ...context,
    sourceSha: pasor.artifactRef ?? context.sourceSha,
  });
  return [pasor, aegis];
}
