/**
 * ComplianceAutomation — continuous policy validation, drift detection, and
 * secret rotation checks.
 */

import { randomUUID } from "node:crypto";
import { eventBus } from "@/lib/runtime/event-bus";
import type { ComplianceCheck, ComplianceStatus } from "./types";

export type PolicyFn = (
  tenantId?: string,
) => Promise<Omit<ComplianceCheck, "id" | "checkedAt">>;

export class ComplianceAutomation {
  private readonly policies = new Map<string, PolicyFn>();
  private readonly latestChecks: ComplianceCheck[] = [];
  private readonly baseline = new Map<string, unknown>();

  registerPolicy(id: string, fn: PolicyFn): void {
    this.policies.set(id, fn);
  }

  async runChecks(tenantId?: string): Promise<ComplianceCheck[]> {
    const results: ComplianceCheck[] = [];

    for (const [, fn] of this.policies.entries()) {
      try {
        const partial = await fn(tenantId);
        const check: ComplianceCheck = {
          ...partial,
          id: randomUUID(),
          checkedAt: new Date().toISOString(),
        };
        results.push(check);

        if (check.status === "violation") {
          eventBus.emit({
            type: "compliance.violation",
            tenantId: tenantId ?? "system",
            timestamp: check.checkedAt,
            payload: { checkId: check.id, policy: check.policy, details: check.details },
            version: "1",
          });
        }
      } catch {
        // Policy execution errors produce a violation
        results.push({
          id: randomUUID(),
          policy: "unknown",
          category: "infrastructure",
          status: "violation",
          details: "Policy check threw an unexpected error",
          checkedAt: new Date().toISOString(),
          tenantId,
        });
      }
    }

    // Replace cached checks for this tenant
    const filtered = this.latestChecks.filter((c) => c.tenantId !== tenantId);
    this.latestChecks.length = 0;
    this.latestChecks.push(...filtered, ...results);

    return results;
  }

  getLatestChecks(tenantId?: string): ComplianceCheck[] {
    if (!tenantId) return [...this.latestChecks];
    return this.latestChecks.filter((c) => c.tenantId === tenantId);
  }

  setBaseline(key: string, value: unknown): void {
    this.baseline.set(key, value);
  }

  /** Returns true when the current value differs from the baseline. */
  checkDrift(key: string, current: unknown): boolean {
    const base = this.baseline.get(key);
    return JSON.stringify(base) !== JSON.stringify(current);
  }

  getComplianceSummary(): {
    compliant: number;
    warnings: number;
    violations: number;
  } {
    let compliant = 0, warnings = 0, violations = 0;
    const statuses = new Map<string, ComplianceStatus>();

    // Use the latest check per policy
    for (const check of this.latestChecks) {
      const existing = statuses.get(check.policy);
      if (!existing || this.statusSeverity(check.status) > this.statusSeverity(existing)) {
        statuses.set(check.policy, check.status);
      }
    }

    for (const status of statuses.values()) {
      if (status === "compliant") compliant++;
      else if (status === "warning") warnings++;
      else violations++;
    }

    return { compliant, warnings, violations };
  }

  private statusSeverity(s: ComplianceStatus): number {
    return s === "violation" ? 2 : s === "warning" ? 1 : 0;
  }
}

export const complianceAutomation = new ComplianceAutomation();

// Register built-in policies
complianceAutomation.registerPolicy("jwt-secret-set", async (tenantId) => ({
  policy: "jwt-secret-set",
  category: "security",
  status: (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32)
    ? "compliant"
    : "violation",
  details: process.env.JWT_SECRET
    ? "JWT_SECRET is configured"
    : "JWT_SECRET is not set or too short (< 32 chars)",
  tenantId,
}));

complianceAutomation.registerPolicy("supabase-configured", async (tenantId) => ({
  policy: "supabase-configured",
  category: "infrastructure",
  status: (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
    ? "compliant"
    : "warning",
  details: (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
    ? "Supabase connection is configured"
    : "Supabase env vars not set — database connectivity unavailable",
  tenantId,
}));
