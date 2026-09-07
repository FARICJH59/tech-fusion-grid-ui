import { assertTcxExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";
import type { AutonomousBuildProvider, AutonomousBuildRequest, AutonomousBuildResult } from "./types";

/**
 * Sends a governed build request to a HYDRA-EDGE/Termux worker.
 * The TCX authority itself never crosses the network. The edge node must
 * independently authenticate the caller and revalidate transaction/attempt state.
 */
export class TermuxAutonomousBuildProvider implements AutonomousBuildProvider {
  readonly target = "termux" as const;

  constructor(
    private readonly endpoint: string,
    private readonly getAccessToken: () => Promise<string>,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async execute(request: AutonomousBuildRequest): Promise<AutonomousBuildResult> {
    assertTcxExecutionAuthority(request.authority);
    if (request.authority.tenantId !== request.tenantId) {
      throw new Error("termux_build_authority_tenant_mismatch");
    }
    if (request.authority.transactionId !== request.transactionId || request.authority.attemptId !== request.attemptId) {
      throw new Error("termux_build_authority_attempt_mismatch");
    }

    await request.authority.assertValid();
    const accessToken = await this.getAccessToken();
    if (!accessToken) throw new Error("termux_build_access_token_missing");

    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        repository: request.repository,
        ref: request.ref,
        workflow: request.workflow,
        inputs: request.inputs ?? {},
        projectId: request.projectId,
        tenantId: request.tenantId,
        transactionId: request.transactionId,
        attemptId: request.attemptId,
      }),
    });

    await request.authority.assertValid();

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`termux_build_dispatch_failed:${response.status}:${detail.slice(0, 500)}`);
    }

    const result = (await response.json()) as { executionId?: string };
    return {
      target: this.target,
      accepted: true,
      executionId: result.executionId ?? `${request.transactionId}:${request.attemptId}`,
      message: "HYDRA-EDGE/Termux build request accepted.",
    };
  }
}
