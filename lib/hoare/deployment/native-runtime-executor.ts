import { spawn, type ChildProcess } from "node:child_process";
import { deploymentRegistry, type DeploymentRecord } from "@/lib/hoare/deployment/deployment-registry";

export type RuntimeProcessStatus = "starting" | "running" | "stopped" | "failed";

export type RuntimeProcess = {
  deploymentId: string;
  pid?: number;
  status: RuntimeProcessStatus;
  startedAt?: string;
  stoppedAt?: string;
  exitCode?: number | null;
  error?: string;
};

type ManagedProcess = {
  child: ChildProcess;
  record: RuntimeProcess;
};

/**
 * Provider-neutral local runtime executor.
 *
 * It deliberately executes only an allow-listed command. Generated workloads
 * should be materialized into an isolated workspace before this layer is used.
 * The executor owns process lifecycle; the deployment registry owns durable
 * control-plane state.
 */
export class NativeRuntimeExecutor {
  private readonly processes = new Map<string, ManagedProcess>();

  async start(deployment: DeploymentRecord, command: string, args: string[] = []): Promise<RuntimeProcess> {
    if (this.processes.has(deployment.id)) {
      return this.processes.get(deployment.id)!.record;
    }

    if (!command || command.includes(";") || command.includes("&&") || command.includes("|")) {
      throw new Error("Unsafe runtime command");
    }

    const now = new Date().toISOString();
    const record: RuntimeProcess = {
      deploymentId: deployment.id,
      status: "starting",
      startedAt: now,
    };

    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, HOARE_DEPLOYMENT_ID: deployment.id },
      detached: false,
      stdio: "ignore",
    });

    record.pid = child.pid;
    this.processes.set(deployment.id, { child, record });
    await deploymentRegistry.update(deployment.tenantId, deployment.id, { status: "building" });

    child.once("spawn", () => {
      record.status = "running";
      void deploymentRegistry.update(deployment.tenantId, deployment.id, { status: "running" });
    });

    child.once("error", (error) => {
      record.status = "failed";
      record.error = error.message;
      void deploymentRegistry.update(deployment.tenantId, deployment.id, {
        status: "failed",
        error: error.message,
      });
      this.processes.delete(deployment.id);
    });

    child.once("exit", (code) => {
      record.exitCode = code;
      record.stoppedAt = new Date().toISOString();
      record.status = code === 0 ? "stopped" : "failed";
      void deploymentRegistry.update(deployment.tenantId, deployment.id, {
        status: record.status,
        error: code === 0 ? undefined : `Process exited with code ${code}`,
      });
      this.processes.delete(deployment.id);
    });

    return record;
  }

  async stop(tenantId: string, deploymentId: string): Promise<RuntimeProcess | null> {
    const managed = this.processes.get(deploymentId);
    if (!managed) return null;

    managed.child.kill("SIGTERM");
    managed.record.status = "stopped";
    managed.record.stoppedAt = new Date().toISOString();
    await deploymentRegistry.update(tenantId, deploymentId, { status: "stopped" });
    this.processes.delete(deploymentId);
    return managed.record;
  }

  status(deploymentId: string): RuntimeProcess | null {
    return this.processes.get(deploymentId)?.record ?? null;
  }

  list(): RuntimeProcess[] {
    return [...this.processes.values()].map(({ record }) => record);
  }
}

export const nativeRuntimeExecutor = new NativeRuntimeExecutor();
