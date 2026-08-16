export interface TenantExecutionIdentity {
  tenant_id: string;
  stripe_customer_id?: string;
  subscription_id?: string;
  github_user_id?: string;
  quota_limit: number;
  energy_budget: number;
  carbon_budget?: number;
}

export interface ProjectIdentity {
  project_id: string;
  tenant_id: string;
  repository?: {
    provider: "github";
    owner: string;
    name: string;
    ref?: string;
  };
}
