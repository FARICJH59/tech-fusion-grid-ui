import type { SdkConfig, SdkError, SdkResponse } from "@/lib/sdk/types";

export class HoareSdkClientError extends Error implements SdkError {
  code: string;
  requestId?: string;

  constructor(error: SdkError) {
    super(error.message);
    this.name = "HoareSdkClientError";
    this.code = error.code;
    this.requestId = error.requestId;
  }
}

export class BaseSdkClient {
  protected readonly config: SdkConfig;

  constructor(config: SdkConfig) {
    // Reject non-HTTPS URLs in production to prevent credential leakage
    if (
      process.env.NODE_ENV === "production" &&
      config.baseUrl &&
      !config.baseUrl.startsWith("https://")
    ) {
      throw new Error(
        `[sdk] baseUrl must use HTTPS in production. Got: ${config.baseUrl.split("?")[0]}`,
      );
    }
    this.config = config;
  }

  protected get<T>(path: string): Promise<SdkResponse<T>> {
    return this.request<T>("GET", path);
  }

  protected post<T>(path: string, body?: unknown): Promise<SdkResponse<T>> {
    return this.request<T>("POST", path, body);
  }

  protected delete<T>(path: string, body?: unknown): Promise<SdkResponse<T>> {
    return this.request<T>("DELETE", path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<SdkResponse<T>> {
    const controller = new AbortController();
    const timeout = this.config.timeout ?? 10_000;
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const url = new URL(path, this.ensureTrailingSlash(this.config.baseUrl));
      const response = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          Authorization: ["Bearer", this.config.apiKey].join(" "),
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Tenant-Id": this.config.tenantId,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      const requestId = response.headers.get("x-request-id") ?? "unknown";
      const raw = await response.text();
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;

      if (!response.ok) {
        const errorPayload = this.normalizeError(parsed, response.status, requestId);
        throw new HoareSdkClientError(errorPayload);
      }

      return {
        data: parsed as T,
        requestId,
      };
    } catch (error) {
      if (error instanceof HoareSdkClientError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new HoareSdkClientError({
          code: "timeout",
          message: `Request timed out after ${timeout}ms`,
        });
      }
      throw new HoareSdkClientError({
        code: "network_error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private ensureTrailingSlash(baseUrl: string): string {
    return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  }

  private normalizeError(payload: unknown, status: number, requestId: string): SdkError {
    if (this.isSdkError(payload)) {
      return {
        ...payload,
        requestId: payload.requestId ?? requestId,
      };
    }

    return {
      code: `http_${status}`,
      message: typeof payload === "object" && payload !== null && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed with status ${status}`,
      requestId,
    };
  }

  private isSdkError(payload: unknown): payload is SdkError {
    return typeof payload === "object" && payload !== null && "code" in payload && "message" in payload;
  }
}
