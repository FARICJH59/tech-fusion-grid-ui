import type { BuilderPlan } from "./types";
import type { BuilderPlanRepository } from "./plan-repository";

export interface BuilderPlanSqlClient {
  query<T = unknown>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

/** PostgreSQL persistence adapter. The application composition root supplies the authenticated DB client. */
export class SqlBuilderPlanRepository implements BuilderPlanRepository {
  constructor(private readonly db: BuilderPlanSqlClient) {}

  async get(planId: string, tenantId: string): Promise<BuilderPlan | null> {
    const result = await this.db.query<{ plan: BuilderPlan }>(
      "SELECT plan FROM hoare_builder_plans WHERE id = $1 AND tenant_id = $2 LIMIT 1",
      [planId, tenantId],
    );
    return result.rows[0]?.plan ?? null;
  }

  async save(plan: BuilderPlan): Promise<void> {
    await this.db.query(
      `INSERT INTO hoare_builder_plans (id, tenant_id, status, plan)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id,
         status = EXCLUDED.status, plan = EXCLUDED.plan, updated_at = NOW()`,
      [plan.id, plan.intent.tenantId, plan.status, JSON.stringify(plan)],
    );
  }
}
