import type { Agent } from "../../packages/agent-sdk/src/agent";
import { AgentRuntime } from "../runtime/agent-runtime";
import { analyzeShelfImage } from "@/lib/shelf-scouter/analyzer";
import { findCatalogLocation } from "@/lib/shelf-scouter/catalog";

export const SHELF_SCOUTER_AGENT_ID = "shelf-scouter";
export const SHELF_SCOUTER_AGENT_VERSION = "1.0.0";

export const shelfScouterAgent: Agent = {
  identity: {
    id: SHELF_SCOUTER_AGENT_ID,
    name: "HOARE Shelf Scouter",
    version: SHELF_SCOUTER_AGENT_VERSION,
    description: "Retail shelf observation, product identification, and store-location intelligence agent.",
  },
  purpose: {
    mission: "Turn shelf imagery into actionable retail intelligence.",
    domain: "retail",
    objectives: [
      "Identify products from shelf imagery.",
      "Resolve products against a tenant store catalog.",
      "Return safe, auditable guidance to the requesting client.",
    ],
  },
  capabilities: {
    supportedActions: ["SCAN_SHELF", "IDENTIFY_PRODUCT", "RESOLVE_LOCATION"],
    supportedTools: [],
    registered: [
      {
        id: "shelf-image-analysis",
        name: "Shelf Image Analysis",
        description: "Analyze a shelf image and resolve the observation against a tenant catalog.",
        type: "analysis",
        version: SHELF_SCOUTER_AGENT_VERSION,
        actions: ["SCAN_SHELF", "IDENTIFY_PRODUCT", "RESOLVE_LOCATION"],
        workflows: ["shelf-scan"],
      },
    ],
    supportedWorkflows: ["shelf-scan"],
  },
  tools: [],
  memory: {
    requiredMemoryType: "short-term",
    storageAdapter: "agent-runtime-memory",
    retentionPolicy: { strategy: "session", maxEntries: 100 },
    namespaces: ["shelf-observations"],
  },
  permissions: [
    {
      id: "shelf-scouter:scan",
      resource: "shelf-scans",
      action: "analyze",
      description: "Analyze shelf imagery for the current tenant.",
      requiredRole: "operator",
      tenantScope: "current-tenant",
      securityPolicies: ["tenant-isolation", "audit-shelf-observations"],
      auditRequired: true,
      riskLevel: "low",
    },
  ],
  workflows: [
    {
      id: "shelf-scan",
      name: "Shelf Scan",
      version: SHELF_SCOUTER_AGENT_VERSION,
      description: "Analyze an image and resolve a tenant-specific store location.",
      collaborationMode: "single-agent",
      approvalMode: "policy-based",
      eventStrategy: "emit-per-step",
      steps: [
        { id: "analyze", name: "Analyze shelf image", type: "task" },
        { id: "resolve", name: "Resolve store location", type: "task", dependsOn: ["analyze"] },
      ],
    },
  ],
  evaluation: {
    tests: [
      { id: "shelf-scan-capability", name: "Shelf scan capability", type: "capability" },
      { id: "shelf-scan-workflow", name: "Shelf scan workflow", type: "workflow" },
    ],
    metrics: ["successRate", "latencyMs", "safetyScore", "reliabilityScore"],
    qualityScoring: "weighted-balanced",
  },
  defaultContext: {
    actor: { id: "shelf-scouter-service", role: "service", type: "service" },
  },
  metadata: {
    providerNeutral: true,
    clientAccess: "web-pwa",
    transport: ["https", "mqtt"],
    compliance: ["tenant-isolation", "auditability"],
  },
};

type ShelfScanPayload = {
  bytes: Buffer;
  mimeType: string;
  storeId: string;
};

export async function executeShelfScan(input: {
  tenantId: string;
  requestId: string;
  actorId?: string;
  storeId: string;
  bytes: Buffer;
  mimeType: string;
}) {
  const runtime = new AgentRuntime();
  await runtime.loadAgent({
    tenantId: input.tenantId,
    agent: shelfScouterAgent,
    context: runtime.createContext(shelfScouterAgent, {
      requestId: input.requestId,
      tenant: { tenantId: input.tenantId },
      actor: { id: input.actorId ?? "shelf-scouter-client", role: "operator", type: "user" },
      metadata: { channel: "web-pwa" },
    }),
  });

  runtime.registerExecutionHandler(SHELF_SCOUTER_AGENT_ID, async ({ context, payload }) => {
    const request = payload as ShelfScanPayload;
    const analysis = await analyzeShelfImage(request.bytes, request.mimeType);
    const location = await findCatalogLocation(analysis.observation, request.storeId);

    return {
      tenantId: context.tenant.tenantId,
      observation: analysis.observation,
      location,
      guidance: location
        ? [
            `Go to aisle ${location.aisle}.`,
            location.section ? `Look in ${location.section}.` : "Use the section signage to narrow the search.",
            location.bay ? `Target bay ${location.bay}.` : "Scan the shelf left-to-right if the bay is not marked.",
          ]
        : [
            "Product identified, but no store-layout match was found.",
            "Use the retailer catalog adapter or scan a clearer shelf label.",
          ],
      mode: analysis.mode === "vision" ? "vision+catalog" : "demo",
      requestId: context.requestId,
    };
  });

  const context = runtime.createContext(shelfScouterAgent, {
    requestId: input.requestId,
    tenant: { tenantId: input.tenantId },
    actor: { id: input.actorId ?? "shelf-scouter-client", role: "operator", type: "user" },
    metadata: { channel: "web-pwa", storeId: input.storeId },
  });

  return runtime.executeAgent({
    tenantId: input.tenantId,
    agentId: SHELF_SCOUTER_AGENT_ID,
    version: SHELF_SCOUTER_AGENT_VERSION,
    context,
    payload: {
      bytes: input.bytes,
      mimeType: input.mimeType,
      storeId: input.storeId,
    } satisfies ShelfScanPayload,
    workflowId: "shelf-scan",
    resultValidator: (result) => Boolean(result && typeof result === "object"),
  });
}
