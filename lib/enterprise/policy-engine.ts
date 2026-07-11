import { supabase } from "@/lib/supabase";

export const POLICY_TYPES = [
  "tenant",
  "deployment",
  "runtime",
  "remediation",
] as const;

export type PolicyType = (typeof POLICY_TYPES)[number];

export type PolicyRecord = {
  id: string;
  tenant_id: string;
  policy_type: PolicyType;
  version: number;
  content: Record<string, unknown>;
  approval_required: boolean;
  approved_at?: string | null;
};

export class PolicyEngine {
  async create(policy: PolicyRecord): Promise<void> {
    await supabase.from("phase7_policies").insert(policy).throwOnError();
  }

  async list(tenantId: string, type?: PolicyType): Promise<PolicyRecord[]> {
    const query = supabase
      .from("phase7_policies")
      .select("id, tenant_id, policy_type, version, content, approval_required, approved_at")
      .eq("tenant_id", tenantId)
      .order("version", { ascending: false });

    const { data, error } = type ? await query.eq("policy_type", type) : await query;
    if (error) throw error;
    return (data ?? []) as PolicyRecord[];
  }

  async approve(policyId: string): Promise<void> {
    await supabase
      .from("phase7_policies")
      .update({ approved_at: new Date().toISOString() })
      .eq("id", policyId)
      .throwOnError();
  }
}

export const policyEngine = new PolicyEngine();
