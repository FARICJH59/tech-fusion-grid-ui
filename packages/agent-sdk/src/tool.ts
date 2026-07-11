import type { AgentExecutionContext } from "./context";
import type { AgentPermission } from "./permission";

export const TOOL_CATEGORIES = ["api", "database", "cloud", "iot", "enterprise"] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export type ToolSchema = {
  type: string;
  description?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolExecutionContext = AgentExecutionContext & {
  dryRun?: boolean;
  timeoutMs?: number;
};

export type ToolReference = {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  permissions: string[];
};

export type ToolExecutionRecord<Output> = {
  toolId: string;
  output: Output;
  durationMs: number;
};

export interface Tool<Input = unknown, Output = unknown> {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  inputSchema: ToolSchema;
  outputSchema: ToolSchema;
  permissions: AgentPermission[];
  validateInput?(input: Input): boolean;
  validateOutput?(output: Output): boolean;
  execute(input: Input, context: ToolExecutionContext): Promise<Output> | Output;
}

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.id)) {
      throw new Error(`Tool '${tool.id}' is already registered.`);
    }
    this.tools.set(tool.id, tool);
  }

  get(toolId: string): Tool | undefined {
    return this.tools.get(toolId);
  }

  list(category?: ToolCategory): Tool[] {
    return [...this.tools.values()].filter((tool) => (category ? tool.category === category : true));
  }

  async execute<Input, Output>(
    toolId: string,
    input: Input,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionRecord<Output>> {
    const tool = this.tools.get(toolId) as Tool<Input, Output> | undefined;
    if (!tool) {
      throw new Error(`Tool '${toolId}' is not registered.`);
    }

    if (tool.validateInput && !tool.validateInput(input)) {
      throw new Error(`Tool '${toolId}' rejected invalid input.`);
    }

    const startedAt = Date.now();
    const output = await tool.execute(input, context);

    if (tool.validateOutput && !tool.validateOutput(output)) {
      throw new Error(`Tool '${toolId}' produced invalid output.`);
    }

    return {
      toolId,
      output,
      durationMs: Date.now() - startedAt,
    };
  }
}
