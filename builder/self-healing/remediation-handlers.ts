export type RemediationCommand = "runtime.restart" | "runtime.scale" | "runtime.rollback" | "runtime.isolate";

export interface RemediationContext {
  tenantId: string;
  target: string;
  incidentId: string;
  parameters: Record<string, unknown>;
}

export interface RemediationResult {
  command: RemediationCommand;
  accepted: boolean;
  actionId: string;
  message: string;
}

export type RemediationHandler = (context: RemediationContext) => Promise<RemediationResult>;

export class RemediationHandlerRegistry {
  private readonly handlers = new Map<RemediationCommand, RemediationHandler>();

  register(command: RemediationCommand, handler: RemediationHandler): void {
    this.handlers.set(command, handler);
  }

  has(command: string): command is RemediationCommand {
    return this.handlers.has(command as RemediationCommand);
  }

  async execute(command: RemediationCommand, context: RemediationContext): Promise<RemediationResult> {
    const handler = this.handlers.get(command);
    if (!handler) throw new Error(`REMEDIATION_HANDLER_NOT_REGISTERED:${command}`);
    return handler(context);
  }
}

export function createSafeRemediationRegistry(): RemediationHandlerRegistry {
  const registry = new RemediationHandlerRegistry();

  for (const command of ["runtime.restart", "runtime.scale", "runtime.rollback", "runtime.isolate"] as const) {
    registry.register(command, async (context) => ({
      command,
      accepted: true,
      actionId: `${context.incidentId}:${command}`,
      message: `Remediation command ${command} accepted for governed execution`,
    }));
  }

  return registry;
}
