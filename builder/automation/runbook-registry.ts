export interface RunbookDefinition<Input = Record<string, unknown>> {
  name: string;
  version: string;
  description: string;
  inputs: readonly string[];
  execute(input: Input): Promise<unknown>;
}

export class RunbookRegistry {
  private readonly runbooks = new Map<string, RunbookDefinition>();

  register(runbook: RunbookDefinition): this {
    if (!runbook.name || !runbook.version) throw new Error("RUNBOOK_ID_REQUIRED");
    const key = `${runbook.name}@${runbook.version}`;
    if (this.runbooks.has(key)) throw new Error(`RUNBOOK_ALREADY_REGISTERED:${key}`);
    this.runbooks.set(key, runbook);
    return this;
  }

  get(name: string, version: string): RunbookDefinition {
    const runbook = this.runbooks.get(`${name}@${version}`);
    if (!runbook) throw new Error(`RUNBOOK_NOT_REGISTERED:${name}@${version}`);
    return runbook;
  }

  names(): string[] {
    return [...new Set([...this.runbooks.values()].map((runbook) => runbook.name))];
  }
}
