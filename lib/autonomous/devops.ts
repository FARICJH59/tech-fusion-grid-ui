/**
 * AutonomousDevOps — deployment planning, canary/blue-green/rolling strategies,
 * configuration management, and release approvals.
 */

import { randomUUID } from "node:crypto";
import { eventBus } from "@/lib/runtime/event-bus";
import type { DeploymentPlan, DeploymentStrategy, ServiceId } from "./types";

export class AutonomousDevOps {
  private readonly plans = new Map<string, DeploymentPlan>();
  private readonly versions = new Map<ServiceId, string>();
  private readonly configs = new Map<ServiceId, Record<string, unknown>>();

  planDeployment(
    opts: Omit<DeploymentPlan, "id" | "createdAt" | "status">,
  ): DeploymentPlan {
    const plan: DeploymentPlan = {
      ...opts,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    if (opts.strategy === "canary" && plan.canaryWeight === undefined) {
      plan.canaryWeight = 10;
    }
    this.plans.set(plan.id, plan);
    return plan;
  }

  approvePlan(id: string, approvedBy: string): void {
    const plan = this.plans.get(id);
    if (!plan || plan.status !== "pending") return;
    plan.approvedBy = approvedBy;
  }

  async executePlan(id: string): Promise<void> {
    const plan = this.plans.get(id);
    if (!plan) throw new Error(`Deployment plan ${id} not found`);
    if (!plan.approvedBy) throw new Error(`Plan ${id} must be approved before execution`);
    if (plan.status !== "pending") throw new Error(`Plan ${id} is not in pending state`);

    plan.status = "in-progress";
    eventBus.emit({
      type: "deployment.started",
      tenantId: "system",
      timestamp: new Date().toISOString(),
      payload: { planId: id, serviceId: plan.serviceId, strategy: plan.strategy },
      version: "1",
    });

    // Simulate deployment work
    await Promise.resolve();

    plan.status = "completed";
    plan.completedAt = new Date().toISOString();
    this.versions.set(plan.serviceId, plan.toVersion);

    eventBus.emit({
      type: "deployment.completed",
      tenantId: "system",
      timestamp: plan.completedAt,
      payload: { planId: id, serviceId: plan.serviceId, toVersion: plan.toVersion },
      version: "1",
    });
  }

  async rollback(id: string, reason: string): Promise<void> {
    const plan = this.plans.get(id);
    if (!plan) throw new Error(`Deployment plan ${id} not found`);

    plan.status = "rolled-back";
    plan.rollbackTriggeredAt = new Date().toISOString();
    this.versions.set(plan.serviceId, plan.fromVersion);

    eventBus.emit({
      type: "deployment.rolled_back",
      tenantId: "system",
      timestamp: plan.rollbackTriggeredAt,
      payload: { planId: id, serviceId: plan.serviceId, reason, toVersion: plan.fromVersion },
      version: "1",
    });
  }

  getPlan(id: string): DeploymentPlan | undefined {
    return this.plans.get(id);
  }

  listPlans(serviceId?: ServiceId): DeploymentPlan[] {
    const all = [...this.plans.values()];
    return serviceId ? all.filter((p) => p.serviceId === serviceId) : all;
  }

  getServiceVersion(serviceId: ServiceId): string | undefined {
    return this.versions.get(serviceId);
  }

  setServiceVersion(serviceId: ServiceId, version: string): void {
    this.versions.set(serviceId, version);
  }

  getConfig(serviceId: ServiceId): Record<string, unknown> {
    return this.configs.get(serviceId) ?? {};
  }

  setConfig(serviceId: ServiceId, config: Record<string, unknown>): void {
    this.configs.set(serviceId, { ...config });
  }

  /** Returns key-value pairs that differ between stored and new config. */
  diffConfig(
    serviceId: ServiceId,
    newConfig: Record<string, unknown>,
  ): Record<string, unknown> {
    const current = this.getConfig(serviceId);
    const diff: Record<string, unknown> = {};
    const allKeys = new Set([...Object.keys(current), ...Object.keys(newConfig)]);
    for (const key of allKeys) {
      if (JSON.stringify(current[key]) !== JSON.stringify(newConfig[key])) {
        diff[key] = newConfig[key];
      }
    }
    return diff;
  }

  /** Convenience: plan + approve in one call. */
  planAndApprove(
    opts: Omit<DeploymentPlan, "id" | "createdAt" | "status">,
    approvedBy: string,
  ): DeploymentPlan {
    const plan = this.planDeployment(opts);
    this.approvePlan(plan.id, approvedBy);
    return plan;
  }
}

export const autonomousDevOps = new AutonomousDevOps();

// Register canary as a valid strategy alias — exported for test assertions
export const DEPLOYMENT_STRATEGIES: DeploymentStrategy[] = ["rolling", "canary", "blue-green"];
