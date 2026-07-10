import { HoareAgentClient } from "@/lib/sdk/agent";
import { HoareAuditClient } from "@/lib/sdk/audit";
import { HoareAuthClient } from "@/lib/sdk/auth";
import { HoareBillingClient } from "@/lib/sdk/billing";
import { HoareDeploymentClient } from "@/lib/sdk/deployment";
import { HoareRuntimeClient } from "@/lib/sdk/runtime";
import { HoareTelemetryClient } from "@/lib/sdk/telemetry";
import type { SdkConfig } from "@/lib/sdk/types";
import { HoareWorkflowClient } from "@/lib/sdk/workflow";

export class HoareSDK {
  readonly auth: HoareAuthClient;
  readonly runtime: HoareRuntimeClient;
  readonly workflow: HoareWorkflowClient;
  readonly agent: HoareAgentClient;
  readonly telemetry: HoareTelemetryClient;
  readonly deployment: HoareDeploymentClient;
  readonly billing: HoareBillingClient;
  readonly audit: HoareAuditClient;

  constructor(config: SdkConfig) {
    this.auth = new HoareAuthClient(config);
    this.runtime = new HoareRuntimeClient(config);
    this.workflow = new HoareWorkflowClient(config);
    this.agent = new HoareAgentClient(config);
    this.telemetry = new HoareTelemetryClient(config);
    this.deployment = new HoareDeploymentClient(config);
    this.billing = new HoareBillingClient(config);
    this.audit = new HoareAuditClient(config);
  }

  static fromEnv(): HoareSDK {
    const baseUrl = process.env.HOARE_API_URL;
    const apiKey = process.env.HOARE_API_KEY;
    const tenantId = process.env.HOARE_TENANT_ID;

    if (!baseUrl || !apiKey || !tenantId) {
      throw new Error("HOARE_API_URL, HOARE_API_KEY, and HOARE_TENANT_ID must be configured");
    }

    return new HoareSDK({
      baseUrl,
      apiKey,
      tenantId,
    });
  }
}

export * from "@/lib/sdk/agent";
export * from "@/lib/sdk/audit";
export * from "@/lib/sdk/auth";
export * from "@/lib/sdk/base";
export * from "@/lib/sdk/billing";
export * from "@/lib/sdk/deployment";
export * from "@/lib/sdk/runtime";
export * from "@/lib/sdk/telemetry";
export * from "@/lib/sdk/types";
export * from "@/lib/sdk/workflow";
