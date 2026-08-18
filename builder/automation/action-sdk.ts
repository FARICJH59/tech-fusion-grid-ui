export interface HoareActionContext {
  tenantId: string;
  projectId: string;
  environment: "development" | "staging" | "production";
  requestedBy: string;
  correlationId: string;
}

export interface HoareAction<Input = Record<string, unknown>, Output = unknown> {
  readonly name: string;
  readonly version: string;
  readonly permissions: readonly string[];
  execute(input: Input, context: HoareActionContext): Promise<Output>;
  rollback?(input: Input, context: HoareActionContext): Promise<void>;
}

export class ActionRegistry {
  private readonly actions = new Map<string, HoareAction>();

  register(action: HoareAction): this {
    const key = `${action.name}@${action.version}`;
    if (this.actions.has(key)) throw new Error(`ACTION_ALREADY_REGISTERED:${key}`);
    this.actions.set(key, action);
    return this;
  }

  get(name: string, version: string): HoareAction {
    const action = this.actions.get(`${name}@${version}`);
    if (!action) throw new Error(`ACTION_NOT_REGISTERED:${name}@${version}`);
    return action;
  }
}
