import { resolveEntitlements, type SubscriptionTier } from "@/lib/enterprise/entitlements";
import type { Agent } from "../../packages/agent-sdk/src/agent";
import type { AgentExecutionContext } from "../../packages/agent-sdk/src/context";

export type AgentContextInput = Omit<AgentExecutionContext, "budget" | "metadata"> & {
  budget?: AgentExecutionContext["budget"];
  metadata?: Record<string, unknown>;
  subscriptionTier?: SubscriptionTier;
  creditsRemaining?: number;
};

export function createAgentExecutionContext(agent: Agent, input: AgentContextInput): AgentExecutionContext {
  const defaultContext = agent.defaultContext ?? {};
  const tier = input.subscriptionTier ?? "enterprise";
  const credits = input.creditsRemaining ?? 1_000;
  const entitlements = resolveEntitlements(tier, credits, input.actor.role as never);

  return {
    requestId: input.requestId,
    sessionId: input.sessionId ?? defaultContext.sessionId,
    correlationId: input.correlationId ?? `${agent.identity.id}:${input.requestId}`,
    tenant: {
      ...defaultContext.tenant,
      ...input.tenant,
    },
    actor: {
      ...defaultContext.actor,
      ...input.actor,
    },
    budget: {
      maxCostUsd: entitlements.limits.maxEventsPerMinute / 1_000,
      ...defaultContext.budget,
      ...input.budget,
    },
    metadata: {
      entitlements,
      agent: agent.identity,
      ...defaultContext.metadata,
      ...input.metadata,
    },
  };
}
