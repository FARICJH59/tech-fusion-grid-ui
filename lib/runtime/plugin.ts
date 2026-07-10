import { logger } from "@/lib/telemetry/otel";
import type { RuntimeContext } from "@/lib/runtime/context";
import type { Plugin, PluginId } from "@/lib/runtime/types";

export class PluginLoader {
  private readonly plugins = new Map<PluginId, Plugin>();

  async load(plugin: Plugin, ctx: RuntimeContext): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin '${plugin.id}' is already loaded`);
    }
    await plugin.initialize(ctx);
    this.plugins.set(plugin.id, plugin);
  }

  async unloadAll(): Promise<void> {
    for (const plugin of [...this.plugins.values()].reverse()) {
      if (!plugin.teardown) {
        this.plugins.delete(plugin.id);
        continue;
      }

      try {
        await plugin.teardown();
      } catch (error) {
        logger.error("[runtime/plugin] Plugin teardown failed", {
          pluginId: plugin.id,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.plugins.delete(plugin.id);
      }
    }
  }

  list(): Plugin[] {
    return [...this.plugins.values()];
  }

  get(id: PluginId): Plugin | undefined {
    return this.plugins.get(id);
  }
}
