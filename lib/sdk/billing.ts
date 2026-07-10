import { BaseSdkClient } from "@/lib/sdk/base";
import type { SdkConfig, SdkResponse } from "@/lib/sdk/types";

type UsageRecord = Record<string, unknown>;
type InvoiceRecord = Record<string, unknown>;
type PlanRecord = Record<string, unknown>;

export class HoareBillingClient extends BaseSdkClient {
  constructor(config: SdkConfig) {
    super(config);
  }

  getUsage(): Promise<SdkResponse<UsageRecord>> {
    return this.get<UsageRecord>("billing/usage");
  }

  getInvoices(): Promise<SdkResponse<InvoiceRecord[]>> {
    return this.get<InvoiceRecord[]>("billing/invoices");
  }

  getCurrentPlan(): Promise<SdkResponse<PlanRecord>> {
    return this.get<PlanRecord>("billing/plan");
  }
}
