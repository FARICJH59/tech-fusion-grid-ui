import type { HoareWorkflow } from "../../builder/automation/hoare-workflow";

/**
 * Example of the customer-facing abstraction. The customer asks HOARE to
 * deploy; the workflow remains provider-neutral until execution is selected.
 */
export const customerCloudRunDeployment: HoareWorkflow = {
  name: "customer-cloud-run-deployment",
  version: "1",
  description: "Governed production deployment generated from customer intent",
  trigger: {
    type: "customer.intent",
    intent: "Deploy my application to Google Cloud Run in production, run security checks, verify health, and roll back on failed verification.",
  },
  environment: "production",
  policy: "production-deployment",
  identity: "short-lived-cloud-identity",
  executionTarget: "gcp",
  concurrency: {
    key: "tenant:${tenantId}:service:${serviceId}",
    cancelInProgress: false,
  },
  actions: [
    { id: "build", action: "build-container", version: "1", risk: "low" },
    { id: "security", action: "security-scan", version: "1", needs: ["build"], risk: "low" },
    { id: "attest", action: "attest-artifact", version: "1", needs: ["security"], risk: "medium" },
    { id: "deploy", action: "deploy-cloud-run", version: "1", needs: ["attest"], risk: "medium" },
    { id: "verify", action: "verify-deployment", version: "1", needs: ["deploy"], risk: "low" },
  ],
  verification: ["health-check", "revision-ready", "traffic-serving"],
  rollback: "rollback-cloud-run",
  observability: ["deployment-events", "runtime-health", "audit-events"],
};
