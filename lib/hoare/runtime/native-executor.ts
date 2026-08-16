import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";

export type ServiceSpec = {
  id: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  port?: number;
  healthUrl?: string;
};

export type ServiceState = "starting" | "running" | "stopped" | "failed";

export type ServiceRuntime = {
  id: string;
  pid?: number;
  state: ServiceState;
  startedAt?: string;
  exitCode?: number | null;
  health?: "unknown" | "healthy" | "unhealthy";
};

export class NativeRuntimeExecutor {
  private readonly processes = new Map<string, ChildProcess>();
  private readonly states = new Map<string, ServiceRuntime>();

  start(spec: ServiceSpec): ServiceRuntime {
    if (this.processes.has(spec.id)) return this.states.get(spec.id)!;

    const child = spawn(spec.command, spec.args ?? [], {
      cwd: spec.cwd,
      env: { ...process.env, ...(spec.env ?? {}) },
      stdio: "pipe",
    });

    const state: ServiceRuntime = {
      id: spec.id,
      pid: child.pid,
      state: "starting",
      startedAt: new Date().toISOString(),
      health: "unknown",
    };

    this.states.set(spec.id, state);
    this.processes.set(spec.id, child);

    child.once("spawn", () => {
      const current = this.states.get(spec.id);
      if (current) current.state = "running";
    });

    child.once("error", () => {
      const current = this.states.get(spec.id);
      if (current) current.state = "failed";
    });

    child.once("exit", (code) => {
      const current = this.states.get(spec.id);
      if (current) {
        current.state = code === 0 ? "stopped" : "failed";
        current.exitCode = code;
      }
      this.processes.delete(spec.id);
    });

    return state;
  }

  stop(id: string): ServiceRuntime | undefined {
    const child = this.processes.get(id);
    const state = this.states.get(id);
    if (!child || !state) return state;
    child.kill("SIGTERM");
    state.state = "stopped";
    this.processes.delete(id);
    return state;
  }

  restart(spec: ServiceSpec): ServiceRuntime {
    this.stop(spec.id);
    return this.start(spec);
  }

  status(): ServiceRuntime[] {
    return [...this.states.values()].map((value) => ({ ...value }));
  }

  id(): string {
    return randomUUID();
  }
}
