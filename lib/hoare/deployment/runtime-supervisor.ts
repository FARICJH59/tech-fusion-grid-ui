import { createHash, randomUUID } from "node:crypto";
import { loadRuntime, persistRuntime, type PersistedRuntime } from "./runtime-store";

export type RuntimeLifecycle = "stopped" | "starting" | "running" | "stopping" | "failed";

export interface RuntimeOperation {
  id: string;
  type: "start" | "stop" | "restart";
  requestedAt: string;
  completedAt: string;
  status: "completed";
}

export interface SupervisedRuntime extends PersistedRuntime {
  runtime: PersistedRuntime["runtime"] & {
    lifecycle: RuntimeLifecycle;
    generation: number;
    lastOperation?: RuntimeOperation;
    supervisorHeartbeat: string;
  };
}

async function get(deploymentId: string): Promise<SupervisedRuntime> {
  const value = await loadRuntime(deploymentId);
  if (!value) throw new Error("Deployment not found");
  return value as SupervisedRuntime;
}

async function transition(deploymentId: string, type: RuntimeOperation["type"]): Promise<SupervisedRuntime> {
  const value = await get(deploymentId);
  const now = new Date().toISOString();
  const current = value.runtime.lifecycle ?? "stopped";

  if (type === "start" && current === "running") return value;
  if (type === "stop" && current === "stopped") return value;

  const lifecycle: RuntimeLifecycle = type === "stop" ? "stopping" : "starting";
  value.runtime = { ...value.runtime, lifecycle, supervisorHeartbeat: now };
  await persistRuntime(value);

  const completed = new Date().toISOString();
  const next: RuntimeLifecycle = type === "stop" ? "stopped" : "running";
  const generation = type === "restart" ? (value.runtime.generation ?? 0) + 1 : (value.runtime.generation ?? 0);
  const operation: RuntimeOperation = { id: randomUUID(), type, requestedAt: now, completedAt: completed, status: "completed" };
  value.runtime = {
    ...value.runtime,
    lifecycle: next,
    generation,
    lastOperation: operation,
    supervisorHeartbeat: completed,
    runtimeDigest: createHash("sha256").update(`${value.runtime.runtimeDigest}:${generation}`).digest("hex"),
  };
  await persistRuntime(value);
  return value;
}

export const runtimeSupervisor = {
  get,
  start: (deploymentId: string) => transition(deploymentId, "start"),
  stop: (deploymentId: string) => transition(deploymentId, "stop"),
  restart: (deploymentId: string) => transition(deploymentId, "restart"),
};
