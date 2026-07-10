import { AgentRegistry } from "@/lib/runtime/agent-registry";
import { createRuntimeContext, type RuntimeContext } from "@/lib/runtime/context";
import { ExecutionEngine } from "@/lib/runtime/execution-engine";
import { ExecutionQueue } from "@/lib/runtime/execution-queue";
import { InMemoryEventBus, type IEventBus } from "@/lib/runtime/event-bus";
import { PluginLoader } from "@/lib/runtime/plugin";
import { ToolRegistry } from "@/lib/runtime/tool-registry";
import { WorkflowRegistry } from "@/lib/runtime/workflow-registry";
import type { Plugin } from "@/lib/runtime/types";
import { logger } from "@/lib/telemetry/otel";
import { onShutdown, registerShutdownHooks } from "@/lib/utils/shutdown";

export type RuntimeManagerOptions = {
  plugins?: Plugin[];
};

export class RuntimeManager {
  readonly agents: AgentRegistry;
  readonly tools: ToolRegistry;
  readonly workflows: WorkflowRegistry;
  readonly queue: ExecutionQueue;
  readonly bus: IEventBus;
  readonly engine: ExecutionEngine;
  readonly plugins: PluginLoader;

  private state: "stopped" | "starting" | "running" | "stopping" = "stopped";
  private readonly configuredPlugins: Plugin[];
  private shutdownRegistered = false;

  constructor(options: RuntimeManagerOptions = {}) {
    this.agents = new AgentRegistry();
    this.tools = new ToolRegistry();
    this.workflows = new WorkflowRegistry();
    this.queue = new ExecutionQueue();
    this.bus = new InMemoryEventBus();
    this.engine = new ExecutionEngine(
      { agents: this.agents, tools: this.tools, workflows: this.workflows },
      this.bus,
      this.queue,
    );
    this.plugins = new PluginLoader();
    this.configuredPlugins = options.plugins ?? [];
  }

  async start(): Promise<void> {
    if (this.state === "running" || this.state === "starting") {
      return;
    }

    this.state = "starting";
    registerShutdownHooks({ timeoutMs: 10_000 });

    if (!this.shutdownRegistered) {
      this.shutdownRegistered = true;
      onShutdown("hoare-runtime-manager", async () => {
        await this.stop();
      });
    }

    const systemContext = this.createContext("system", "runtime-startup");
    for (const plugin of this.configuredPlugins) {
      await this.plugins.load(plugin, systemContext);
    }

    logger.info("[runtime/manager] HOARE runtime started", {
      plugins: this.plugins.list().length,
    });
    this.state = "running";
  }

  async stop(): Promise<void> {
    if (this.state === "stopped" || this.state === "stopping") {
      return;
    }

    this.state = "stopping";
    const drained = this.queue.drain();
    await this.plugins.unloadAll();
    logger.info("[runtime/manager] HOARE runtime stopped", {
      drainedExecutions: drained.length,
    });
    this.state = "stopped";
  }

  getState(): "stopped" | "starting" | "running" | "stopping" {
    return this.state;
  }

  createContext(tenantId: string, correlationId: string): RuntimeContext {
    return createRuntimeContext(tenantId, correlationId, {
      getAgent: (id) => this.agents.get(id),
      getTool: (id, version) => this.tools.get(id, version),
      getWorkflow: (id) => this.workflows.get(id),
      emit: (event) => this.bus.emit(event),
    });
  }
}

export const hoareRuntime = new RuntimeManager();
