import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuilderPlan } from "./types";
import type { BuilderPlanRepository } from "./plan-repository";

export class SupabaseBuilderPlanRepository implements BuilderPlanRepository {
  constructor(private readonly client: SupabaseClient) {}

  async get(planId: string, tenantId: string): Promise<BuilderPlan | null> {
    const { data, error } = await this.client
      .from("hoare_builder_plans")
      .select("plan")
      .eq("id", planId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) throw new Error(`Unable to load Builder plan: ${error.message}`);
    return (data?.plan as BuilderPlan | undefined) ?? null;
  }

  async save(plan: BuilderPlan): Promise<void> {
    const { error } = await this.client.from("hoare_builder_plans").upsert({
      id: plan.id,
      tenant_id: plan.intent.tenantId,
      status: plan.status,
      plan,
      updated_at: new Date().toISOString(),
    });

    if (error) throw new Error(`Unable to persist Builder plan: ${error.message}`);
  }
}
