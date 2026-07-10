export type SdkConfig = {
  baseUrl: string;
  apiKey: string;
  tenantId: string;
  timeout?: number;
};

export type SdkResponse<T> = {
  data: T;
  requestId: string;
};

export type SdkError = {
  code: string;
  message: string;
  requestId?: string;
};
