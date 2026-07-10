/**
 * FleetManager — manages distributed edge/IoT/cloud nodes including heartbeat
 * monitoring, config sync, and remote updates.
 */

import { randomUUID } from "node:crypto";
import { eventBus } from "@/lib/runtime/event-bus";
import { onShutdown } from "@/lib/utils/shutdown";
import type { FleetNode, FleetNodeType } from "./types";

const DEFAULT_STALE_THRESHOLD_MS = 90_000;

export class FleetManager {
  private readonly nodes = new Map<string, FleetNode>();
  private readonly nodeConfigs = new Map<string, Record<string, unknown>>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  registerNode(node: Omit<FleetNode, "registeredAt" | "lastHeartbeat">): FleetNode {
    const now = new Date().toISOString();
    const fullNode: FleetNode = {
      ...node,
      registeredAt: now,
      lastHeartbeat: now,
      status: node.status ?? "online",
    };
    this.nodes.set(node.id, fullNode);

    eventBus.emit({
      type: "fleet.node_registered",
      tenantId: node.tenantId ?? "system",
      timestamp: now,
      payload: { nodeId: node.id, type: node.type, name: node.name },
      version: "1",
    });

    return fullNode;
  }

  deregisterNode(id: string): void {
    this.nodes.delete(id);
    this.nodeConfigs.delete(id);
  }

  heartbeat(id: string, metrics?: FleetNode["metrics"]): void {
    const node = this.nodes.get(id);
    if (!node) return;

    const now = new Date().toISOString();
    node.lastHeartbeat = now;
    if (metrics) node.metrics = metrics;
    if (node.status === "offline") node.status = "online";

    eventBus.emit({
      type: "fleet.node_heartbeat",
      tenantId: node.tenantId ?? "system",
      timestamp: now,
      payload: { nodeId: id, metrics: metrics ?? null },
      version: "1",
    });
  }

  getNode(id: string): FleetNode | undefined {
    return this.nodes.get(id);
  }

  listNodes(filter?: { type?: FleetNodeType; status?: FleetNode["status"] }): FleetNode[] {
    let results = [...this.nodes.values()];
    if (filter?.type) results = results.filter((n) => n.type === filter.type);
    if (filter?.status) results = results.filter((n) => n.status === filter.status);
    return results;
  }

  getFleetHealth(): { total: number; online: number; offline: number; degraded: number } {
    let online = 0, offline = 0, degraded = 0;
    for (const node of this.nodes.values()) {
      if (node.status === "online") online++;
      else if (node.status === "offline") offline++;
      else if (node.status === "degraded") degraded++;
    }
    return { total: this.nodes.size, online, offline, degraded };
  }

  syncConfig(nodeId: string, config: Record<string, unknown>): void {
    const node = this.nodes.get(nodeId);
    if (node) node.config = config;
    this.nodeConfigs.set(nodeId, config);
  }

  async updateNode(nodeId: string, version: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);
    // Simulate async OTA update
    await Promise.resolve();
    node.version = version;
  }

  checkHeartbeats(staleThresholdMs = DEFAULT_STALE_THRESHOLD_MS): void {
    const cutoff = Date.now() - staleThresholdMs;
    for (const node of this.nodes.values()) {
      const lastBeat = new Date(node.lastHeartbeat).getTime();
      if (lastBeat < cutoff && node.status !== "offline") {
        node.status = "offline";
        eventBus.emit({
          type: "fleet.node_offline",
          tenantId: node.tenantId ?? "system",
          timestamp: new Date().toISOString(),
          payload: { nodeId: node.id, lastHeartbeat: node.lastHeartbeat },
          version: "1",
        });
      }
    }
  }

  startHeartbeatMonitor(intervalMs = 30_000): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => this.checkHeartbeats(), intervalMs);
    if (typeof this.heartbeatTimer === "object" && "unref" in this.heartbeatTimer) {
      (this.heartbeatTimer as ReturnType<typeof setInterval> & { unref: () => void }).unref();
    }
  }

  stopHeartbeatMonitor(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export const fleetManager = new FleetManager();

onShutdown("fleet-manager", async () => {
  fleetManager.stopHeartbeatMonitor();
});
