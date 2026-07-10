import { BaseSdkClient } from "@/lib/sdk/base";
import type { SdkConfig, SdkResponse } from "@/lib/sdk/types";

type AuditEvent = Record<string, unknown>;
type AuditQuery = {
  actorId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export class HoareAuditClient extends BaseSdkClient {
  constructor(config: SdkConfig) {
    super(config);
  }

  queryAuditLog(query: AuditQuery = {}): Promise<SdkResponse<AuditEvent[]>> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        params.set(key, String(value));
      }
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    return this.get<AuditEvent[]>(`audit${suffix}`);
  }

  exportAuditLog(query: AuditQuery = {}): Promise<SdkResponse<{ url: string }>> {
    return this.post<{ url: string }>("audit/export", query);
  }
}
