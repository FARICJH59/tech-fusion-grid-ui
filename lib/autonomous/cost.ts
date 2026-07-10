/**
 * CostOptimizationEngine — tracks resource costs per tenant and generates
 * actionable recommendations.
 */

import { randomUUID } from "node:crypto";
import { eventBus } from "@/lib/runtime/event-bus";
import type { CostEntry, CostRecommendation } from "./types";

const GPU_IDLE_THRESHOLD = 0.20;     // < 20% utilisation → scale-down recommendation
const AI_COST_THRESHOLD = 50_000_000; // 50 USD in micro-USD → optimization recommendation

export class CostOptimizationEngine {
  private readonly entries: CostEntry[] = [];
  private readonly recommendations = new Map<string, CostRecommendation>();
  private readonly alertThresholds = new Map<string, number>();

  recordCost(entry: Omit<CostEntry, "timestamp">): void {
    this.entries.push({ ...entry, timestamp: new Date().toISOString() });
  }

  getTenantCosts(tenantId: string, windowMs?: number): CostEntry[] {
    const since = windowMs ? Date.now() - windowMs : 0;
    return this.entries.filter(
      (e) => e.tenantId === tenantId && new Date(e.timestamp).getTime() >= since,
    );
  }

  getTotalCostMicroUsd(tenantId: string, windowMs?: number): number {
    return this.getTenantCosts(tenantId, windowMs).reduce(
      (sum, e) => sum + e.costMicroUsd,
      0,
    );
  }

  generateRecommendations(tenantId: string): CostRecommendation[] {
    const generated: CostRecommendation[] = [];
    const costs = this.getTenantCosts(tenantId);
    const breakdown = this.getCostBreakdown(tenantId);

    // AI model cost too high?
    const aiCost = breakdown["ai-model"] ?? 0;
    if (aiCost > AI_COST_THRESHOLD) {
      generated.push(this.upsertRecommendation({
        id: `${tenantId}:optimize-ai`,
        type: "optimize",
        description: `AI model cost (${(aiCost / 1_000_000).toFixed(2)} USD) exceeds threshold — consider switching to a lighter model`,
        estimatedSavingsMicroUsd: Math.floor(aiCost * 0.3),
        priority: "high",
      }));
    }

    // GPU idle?
    const gpuEntries = costs.filter((e) => e.resourceType === "gpu");
    const avgGpuUtil = gpuEntries.length > 0
      ? gpuEntries.reduce((s, e) => s + e.quantity, 0) / gpuEntries.length
      : 0;
    if (gpuEntries.length > 0 && avgGpuUtil < GPU_IDLE_THRESHOLD) {
      generated.push(this.upsertRecommendation({
        id: `${tenantId}:scale-down-gpu`,
        type: "scale-down",
        description: `GPU utilisation (${(avgGpuUtil * 100).toFixed(1)}%) is below 20% — consider scaling down`,
        estimatedSavingsMicroUsd: Math.floor((breakdown["gpu"] ?? 0) * 0.5),
        priority: "medium",
      }));
    }

    // Redis high?
    const redisCost = breakdown["redis"] ?? 0;
    if (redisCost > 5_000_000) {
      generated.push(this.upsertRecommendation({
        id: `${tenantId}:cleanup-redis`,
        type: "cleanup",
        description: "Redis cost is elevated — review TTL policies and evict stale keys",
        estimatedSavingsMicroUsd: Math.floor(redisCost * 0.25),
        priority: "low",
      }));
    }

    // Multiple idle Cloud Run services?
    const crCost = breakdown["cloud-run"] ?? 0;
    const crEntries = costs.filter((e) => e.resourceType === "cloud-run");
    const uniqueServices = new Set(crEntries.map((e) => e.unit)).size;
    if (uniqueServices > 3 && crCost > 10_000_000) {
      generated.push(this.upsertRecommendation({
        id: `${tenantId}:consolidate-cr`,
        type: "consolidate",
        description: `${uniqueServices} Cloud Run services detected — consider consolidating idle instances`,
        estimatedSavingsMicroUsd: Math.floor(crCost * 0.2),
        priority: "medium",
      }));
    }

    if (generated.length > 0) {
      eventBus.emit({
        type: "cost.optimized",
        tenantId,
        timestamp: new Date().toISOString(),
        payload: { recommendations: generated.length },
        version: "1",
      });
    }

    return generated;
  }

  getRecommendations(tenantId?: string): CostRecommendation[] {
    const all = [...this.recommendations.values()];
    if (!tenantId) return all;
    return all.filter((r) => r.id.startsWith(`${tenantId}:`));
  }

  setAlertThreshold(tenantId: string, thresholdMicroUsd: number): void {
    this.alertThresholds.set(tenantId, thresholdMicroUsd);
  }

  checkAlerts(): { tenantId: string; currentCost: number; threshold: number }[] {
    const alerts: { tenantId: string; currentCost: number; threshold: number }[] = [];
    for (const [tenantId, threshold] of this.alertThresholds.entries()) {
      const currentCost = this.getTotalCostMicroUsd(tenantId);
      if (currentCost > threshold) {
        alerts.push({ tenantId, currentCost, threshold });
        eventBus.emit({
          type: "cost.alert",
          tenantId,
          timestamp: new Date().toISOString(),
          payload: { currentCost, threshold },
          version: "1",
        });
      }
    }
    return alerts;
  }

  getCostBreakdown(tenantId: string): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const entry of this.getTenantCosts(tenantId)) {
      breakdown[entry.resourceType] = (breakdown[entry.resourceType] ?? 0) + entry.costMicroUsd;
    }
    return breakdown;
  }

  clearOldEntries(olderThanMs = 7 * 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - olderThanMs;
    const before = this.entries.length;
    const kept = this.entries.filter(
      (e) => new Date(e.timestamp).getTime() >= cutoff,
    );
    this.entries.length = 0;
    this.entries.push(...kept);
    return before - this.entries.length;
  }

  private upsertRecommendation(
    rec: Omit<CostRecommendation, "createdAt">,
  ): CostRecommendation {
    const existing = this.recommendations.get(rec.id);
    if (existing) {
      Object.assign(existing, rec);
      return existing;
    }
    const full: CostRecommendation = { ...rec, createdAt: new Date().toISOString() };
    this.recommendations.set(rec.id, full);
    return full;
  }
}

export const costOptimizationEngine = new CostOptimizationEngine();
