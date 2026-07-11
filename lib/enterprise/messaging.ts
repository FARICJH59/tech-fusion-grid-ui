export const MQTT_HARDENING_FEATURES = [
  "production-emqx-mosquitto-profile",
  "mTLS",
  "tenant-acls",
  "certificate-rotation",
  "secure-broker-authentication",
  "reconnect-handling",
  "retry-policies",
  "dead-letter-routing",
] as const;

export type TenantAclRule = {
  tenantId: string;
  topic: string;
  access: "read" | "write" | "readwrite";
};

export type MessagingPolicy = {
  brokerMode: "emqx" | "mosquitto";
  mtlsRequired: boolean;
  authMode: "username-password" | "jwt" | "x509";
  certRotationHours: number;
  retryMaxAttempts: number;
  deadLetterTopic: string;
};

export class EnterpriseMessagingRuntime {
  private readonly aclRules = new Map<string, TenantAclRule[]>();

  constructor(private readonly policy: MessagingPolicy = {
    brokerMode: "emqx",
    mtlsRequired: true,
    authMode: "x509",
    certRotationHours: 24,
    retryMaxAttempts: 5,
    deadLetterTopic: "runtime/dead-letter",
  }) {}

  listFeatures() {
    return MQTT_HARDENING_FEATURES;
  }

  policySnapshot(): MessagingPolicy {
    return this.policy;
  }

  setTenantAcl(tenantId: string, rules: TenantAclRule[]): void {
    this.aclRules.set(tenantId, rules);
  }

  getTenantAcl(tenantId: string): TenantAclRule[] {
    return this.aclRules.get(tenantId) ?? [];
  }

  canAccess(tenantId: string, topic: string, direction: "read" | "write"): boolean {
    return this.getTenantAcl(tenantId).some((rule) => {
      if (rule.topic !== topic) return false;
      if (rule.access === "readwrite") return true;
      return rule.access === direction;
    });
  }

  toDeadLetter(topic: string, payload: string, reason: string) {
    return {
      route: this.policy.deadLetterTopic,
      sourceTopic: topic,
      payload,
      reason,
      timestamp: new Date().toISOString(),
    };
  }
}
