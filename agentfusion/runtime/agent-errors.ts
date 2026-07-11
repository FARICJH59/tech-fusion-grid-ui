export class AgentFusionError extends Error {
  constructor(message: string, readonly code: string, readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "AgentFusionError";
  }
}

export class AgentValidationError extends AgentFusionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "AGENT_VALIDATION_ERROR", details);
  }
}

export class AgentAuthorizationError extends AgentFusionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "AGENT_AUTHORIZATION_ERROR", details);
  }
}

export class AgentExecutionError extends AgentFusionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "AGENT_EXECUTION_ERROR", details);
  }
}

export class AgentWorkflowError extends AgentFusionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "AGENT_WORKFLOW_ERROR", details);
  }
}
