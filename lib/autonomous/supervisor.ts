/**
 * RuntimeSupervisor — service lifecycle management for the Autonomous
 * Operations Platform. Tracks registrations, health, and restart policies.
 */

import { randomUUID } from "node:crypto";
import { eventBus } from "@/lib/runtime/event-bus";
import { onShutdown } from "@/lib/utils/shutdown";
import type { ServiceId, ServiceRegistration, ServiceStatus } from "./types";

export class RuntimeSupervisor {
  private readonly services = new Map<ServiceId, ServiceRegistration>();
  private healthLoopTimer: ReturnType<typeof setInterval> | null = null;

  register(svc: Omit<ServiceRegistration, "registeredAt" | "restartCount">): void {
    const registration: ServiceRegistration = {
      ...svc,
      registeredAt: new Date().toISOString(),
      restartCount: 0,
    };
    this.services.set(svc.id, registration);
    eventBus.emit({
      type: "service.registered",
      tenantId: svc.tenantId ?? "system",
      timestamp: registration.registeredAt,
      payload: { serviceId: svc.id, name: svc.name, version: svc.version },
      version: "1",
    });
  }

  deregister(id: ServiceId): void {
    const svc = this.services.get(id);
    if (!svc) return;
    this.services.delete(id);
    eventBus.emit({
      type: "service.deregistered",
      tenantId: svc.tenantId ?? "system",
      timestamp: new Date().toISOString(),
      payload: { serviceId: id },
      version: "1",
    });
  }

  getService(id: ServiceId): ServiceRegistration | undefined {
    return this.services.get(id);
  }

  listServices(): ServiceRegistration[] {
    return [...this.services.values()];
  }

  updateStatus(id: ServiceId, status: ServiceStatus): void {
    const svc = this.services.get(id);
    if (!svc) return;
    const prev = svc.status;
    svc.status = status;
    if (prev !== status) {
      eventBus.emit({
        type: "service.health_changed",
        tenantId: svc.tenantId ?? "system",
        timestamp: new Date().toISOString(),
        payload: { serviceId: id, from: prev, to: status },
        version: "1",
      });
    }
  }

  async triggerRestart(id: ServiceId, reason: string): Promise<void> {
    const svc = this.services.get(id);
    if (!svc) return;

    const policy = svc.restartPolicy ?? "on-failure";
    const maxRestarts = svc.maxRestarts ?? 5;

    if (policy === "never") return;
    if (policy === "on-failure" && svc.status !== "failed" && svc.status !== "degraded") return;
    if (svc.restartCount >= maxRestarts) {
      this.updateStatus(id, "failed");
      return;
    }

    svc.restartCount++;
    this.updateStatus(id, "starting");
    // Simulate restart — in production this would invoke the actual start hook
    await Promise.resolve();
    this.updateStatus(id, "running");
    eventBus.emit({
      type: "service.health_changed",
      tenantId: svc.tenantId ?? "system",
      timestamp: new Date().toISOString(),
      payload: { serviceId: id, event: "restarted", reason, restartCount: svc.restartCount },
      version: "1",
    });
  }

  /** Restart all services one by one with an optional delay between each. */
  async rollingRestart(delayBetweenMs = 500): Promise<void> {
    const ordered = this.sortByDependencies([...this.services.values()]);
    for (const svc of ordered) {
      await this.triggerRestart(svc.id, "rolling-restart");
      if (delayBetweenMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayBetweenMs));
      }
    }
  }

  startHealthLoop(intervalMs = 30_000): void {
    if (this.healthLoopTimer) return;
    this.healthLoopTimer = setInterval(() => {
      for (const svc of this.services.values()) {
        svc.lastHealthCheck = new Date().toISOString();
        // Auto-restart failed services with "always" policy
        if ((svc.status === "failed" || svc.status === "degraded") && svc.restartPolicy === "always") {
          void this.triggerRestart(svc.id, "health-loop");
        }
      }
    }, intervalMs);
    // Allow Node.js to exit even if the loop is still running
    if (typeof this.healthLoopTimer === "object" && "unref" in this.healthLoopTimer) {
      (this.healthLoopTimer as ReturnType<typeof setInterval> & { unref: () => void }).unref();
    }
  }

  stopHealthLoop(): void {
    if (this.healthLoopTimer) {
      clearInterval(this.healthLoopTimer);
      this.healthLoopTimer = null;
    }
  }

  getHealthSummary(): { total: number; running: number; failed: number; degraded: number } {
    let running = 0, failed = 0, degraded = 0;
    for (const svc of this.services.values()) {
      if (svc.status === "running") running++;
      else if (svc.status === "failed") failed++;
      else if (svc.status === "degraded") degraded++;
    }
    return { total: this.services.size, running, failed, degraded };
  }

  /** Topological sort — services whose dependencies are met come first. */
  private sortByDependencies(svcs: ServiceRegistration[]): ServiceRegistration[] {
    const result: ServiceRegistration[] = [];
    const visited = new Set<ServiceId>();

    const visit = (svc: ServiceRegistration) => {
      if (visited.has(svc.id)) return;
      for (const depId of svc.dependencies ?? []) {
        const dep = this.services.get(depId);
        if (dep) visit(dep);
      }
      visited.add(svc.id);
      result.push(svc);
    };

    for (const svc of svcs) visit(svc);
    return result;
  }
}

export const runtimeSupervisor = new RuntimeSupervisor();

onShutdown("runtime-supervisor", async () => {
  runtimeSupervisor.stopHealthLoop();
});
