import type { ToolDefinition, ToolId, ToolVersion } from "@/lib/runtime/types";

function compareVersions(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

type StoredToolDefinition = ToolDefinition<never, unknown>;

export class ToolRegistry {
  private readonly tools = new Map<ToolId, Map<ToolVersion, StoredToolDefinition>>();

  register<TInput, TOutput>(def: ToolDefinition<TInput, TOutput>): void {
    const versions = this.tools.get(def.id) ?? new Map<ToolVersion, StoredToolDefinition>();
    if (versions.has(def.version)) {
      throw new Error(`Tool '${def.id}@${def.version}' is already registered`);
    }
    // The registry stores heterogeneous tool signatures, so the execute
    // function type must be erased at the storage boundary.
    versions.set(def.version, def as unknown as StoredToolDefinition);
    this.tools.set(def.id, versions);
  }

  deregister(id: ToolId, version?: ToolVersion): boolean {
    const versions = this.tools.get(id);
    if (!versions) {
      return false;
    }

    if (version) {
      const removed = versions.delete(version);
      if (versions.size === 0) {
        this.tools.delete(id);
      }
      return removed;
    }

    this.tools.delete(id);
    return true;
  }

  get(id: ToolId, version?: ToolVersion): ToolDefinition | undefined {
    const versions = this.tools.get(id);
    if (!versions) {
      return undefined;
    }

    if (version) {
      return versions.get(version) as unknown as ToolDefinition | undefined;
    }

    const latestVersion = [...versions.keys()].sort(compareVersions).at(-1);
    return latestVersion
      ? versions.get(latestVersion) as unknown as ToolDefinition | undefined
      : undefined;
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()].flatMap(
      (versions) => [...versions.values()] as unknown as ToolDefinition[],
    );
  }

  listVersions(id: ToolId): ToolVersion[] {
    const versions = this.tools.get(id);
    return versions ? [...versions.keys()].sort(compareVersions) : [];
  }

  count(): number {
    return [...this.tools.values()].reduce((total, versions) => total + versions.size, 0);
  }
}
