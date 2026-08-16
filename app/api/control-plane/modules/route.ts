import { NextResponse } from "next/server";

const modules = [
  { id: "agents", label: "Agent Builder", capability: "agent.create" },
  { id: "workflows", label: "Workflow Builder", capability: "workflow.create" },
  { id: "tenants", label: "Tenants", capability: "tenant.manage" },
  { id: "identity", label: "Identity & IAM", capability: "system.manage" },
  { id: "policies", label: "Policy Center", capability: "system.manage" },
  { id: "runtime", label: "Runtime", capability: "system.view" },
  { id: "deployments", label: "Deployments", capability: "cloud.deploy" },
  { id: "billing", label: "Metering & Billing", capability: "system.view" },
];

export async function GET() {
  return NextResponse.json({
    modules,
    source: "HOARE_CONTROL_PLANE",
    timestamp: new Date().toISOString(),
  });
}
