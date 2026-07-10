import { BaseSdkClient } from "@/lib/sdk/base";
import type { AuthTokens } from "@/lib/auth";
import type { SdkConfig, SdkResponse } from "@/lib/sdk/types";

type LoginRequest = {
  email: string;
  password: string;
};

export class HoareAuthClient extends BaseSdkClient {
  constructor(config: SdkConfig) {
    super(config);
  }

  login(credentials: LoginRequest): Promise<SdkResponse<AuthTokens>> {
    return this.post<AuthTokens>("auth/login", credentials);
  }

  refresh(refreshToken: string): Promise<SdkResponse<AuthTokens>> {
    return this.post<AuthTokens>("auth/refresh", { refreshToken });
  }

  logout(token?: string): Promise<SdkResponse<{ success: boolean }>> {
    return this.post<{ success: boolean }>("auth/logout", token ? { token } : undefined);
  }

  revokeToken(token: string): Promise<SdkResponse<{ revoked: boolean }>> {
    return this.post<{ revoked: boolean }>("auth/revoke", { token });
  }
}
