import { assertTcxExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";
import type { AutonomousBuildProvider, AutonomousBuildRequest, AutonomousBuildResult } from "./types";

/**
 * Dispatches an already-admitted build workflow to GitHub Actions.
 * The GitHub token is process configuration; execution authority remains HOARE/TCX state.
 */
export class GitHubAutonomousBuildProvider implements AutonomousBuildProvider {
  readonly target = "github" as const;

  constructor(
    private readonly token: string,
    private readonly apiBaseUrl = "https://api.github.com",
  ) {}

  async execute(request: AutonomousBuildRequest): Promise<AutonomousBuildResult> {
    assertTcxExecutionAuthority(request.authority);
    if (request.authority.tenantId !== request.tenantId) {
      throw new Error("github_build_authority_tenant_mismatch");
    }
    if (request.authority.transactionId !== request.transactionId || request.authority.attemptId !== request.attemptId) {
      throw new Error("github_build_authority_attempt_mismatch");
    }

    await request.authority.assertValid();

    const response = await fetch(
      `${this.apiBaseUrl}/repos/${request.repository}/actions/workflows/${encodeURIComponent(request.workflow)}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${this.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: request.ref, inputs: request.inputs ?? {} }),
      },
    );

    await request.authority.assertValid();

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`github_workflow_dispatch_failed:${response.status}:${detail.slice(0, 500)}`);
    }

    return {
      target: this.target,
      accepted: true,
      executionId: `${request.repository}:${request.workflow}:${request.ref}:${request.attemptId}`,
      message: "GitHub Actions workflow dispatch accepted.",
    };
  }
}
