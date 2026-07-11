export type EmergencyStopState = {
  tenantId: string;
  organizationId: string;
  resource: string;
  active: boolean;
  activatedBy?: string;
  reason?: string;
  updatedAt: string;
};

export class EmergencyControls {
  private readonly states = new Map<string, EmergencyStopState>();

  activate(input: {
    tenantId: string;
    organizationId: string;
    resource: string;
    operatorId: string;
    reason: string;
  }): EmergencyStopState {
    const state: EmergencyStopState = {
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      resource: input.resource,
      active: true,
      activatedBy: input.operatorId,
      reason: input.reason,
      updatedAt: new Date().toISOString(),
    };
    this.states.set(this.key(input.tenantId, input.organizationId, input.resource), state);
    return state;
  }

  release(input: { tenantId: string; organizationId: string; resource: string }): EmergencyStopState {
    const state: EmergencyStopState = {
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      resource: input.resource,
      active: false,
      updatedAt: new Date().toISOString(),
    };
    this.states.set(this.key(input.tenantId, input.organizationId, input.resource), state);
    return state;
  }

  isActive(tenantId: string, organizationId: string, resource: string): boolean {
    return this.states.get(this.key(tenantId, organizationId, resource))?.active ?? false;
  }

  private key(tenantId: string, organizationId: string, resource: string): string {
    return `${tenantId}:${organizationId}:${resource}`;
  }
}

export const emergencyControls = new EmergencyControls();
