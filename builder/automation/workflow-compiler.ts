import type { HoareWorkflow } from "./hoare-workflow";

export interface ExecutionPlan {
  adapter: string;
  workflow: HoareWorkflow;
  actions: readonly string[];
}

export interface WorkflowCompiler {
  supports(target: string): boolean;
  compile(workflow: HoareWorkflow): Promise<ExecutionPlan>;
}

export class ExecutionAdapterRegistry {
  private readonly compilers: WorkflowCompiler[] = [];

  register(compiler: WorkflowCompiler): this {
    this.compilers.push(compiler);
    return this;
  }

  async compile(workflow: HoareWorkflow, target: string): Promise<ExecutionPlan> {
    const compiler = this.compilers.find((candidate) => candidate.supports(target));
    if (!compiler) throw new Error(`EXECUTION_ADAPTER_NOT_FOUND:${target}`);
    return compiler.compile(workflow);
  }
}
