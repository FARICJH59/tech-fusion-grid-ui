import { BaseSdkClient } from "@/lib/sdk/base";
import type { SdkConfig, SdkResponse } from "@/lib/sdk/types";

type TelemetryEnvelope = Record<string, unknown>;

type TelemetryQuery = {
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
};

export class HoareTelemetryClient extends BaseSdkClient {
  constructor(config: SdkConfig) {
    super(config);
  }

  ingestTelemetry(payload: TelemetryEnvelope | TelemetryEnvelope[]): Promise<SdkResponse<{ accepted: number }>> {
    return this.post<{ accepted: number }>("telemetry/ingest", payload);
  }

  queryTelemetry(query: TelemetryQuery = {}): Promise<SdkResponse<TelemetryEnvelope[]>> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        params.set(key, String(value));
      }
    }
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    return this.get<TelemetryEnvelope[]>(`telemetry${suffix}`);
  }

  subscribeTelemetry(channel = "default"): Promise<SdkResponse<{ channel: string; streamUrl?: string }>> {
    return this.post<{ channel: string; streamUrl?: string }>("telemetry/subscribe", { channel });
  }
}
