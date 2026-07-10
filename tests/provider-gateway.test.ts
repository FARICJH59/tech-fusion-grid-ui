import test from "node:test";
import assert from "node:assert/strict";

import { AIGateway } from "../lib/providers/gateway";
import type {
  CompletionRequest,
  CompletionResponse,
  IProvider,
  ProviderHealth,
} from "../lib/providers/types";

class MockProvider implements IProvider {
  readonly id: "openai" | "anthropic" | "gemini";
  private readonly responder: (req: CompletionRequest) => Promise<CompletionResponse>;
  private readonly healthResponder: () => Promise<ProviderHealth>;
  calls = 0;

  constructor(
    id: "openai" | "anthropic" | "gemini",
    responder: (req: CompletionRequest) => Promise<CompletionResponse>,
    healthResponder: () => Promise<ProviderHealth>,
  ) {
    this.id = id;
    this.responder = responder;
    this.healthResponder = healthResponder;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    this.calls += 1;
    return this.responder(req);
  }

  async healthCheck(): Promise<ProviderHealth> {
    return this.healthResponder();
  }
}

function request(): CompletionRequest {
  return {
    model: "mock-model",
    messages: [{ role: "user", content: "hello" }],
  };
}

function response(provider: CompletionResponse["provider"], content: string): CompletionResponse {
  return {
    id: `${provider}-1`,
    model: "mock-model",
    provider,
    content,
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    durationMs: 1,
  };
}

test("provider-gateway: registerProvider makes provider available", () => {
  const gateway = new AIGateway();
  const provider = new MockProvider(
    "openai",
    async () => response("openai", "ok"),
    async () => ({ provider: "openai", status: "healthy", checkedAt: new Date().toISOString() }),
  );

  gateway.registerProvider(provider);
  assert.equal(gateway.getProvider("openai"), provider);
});

test("provider-gateway: complete calls the preferred provider", async () => {
  const gateway = new AIGateway({ defaultProvider: "openai" });
  const provider = new MockProvider(
    "openai",
    async () => response("openai", "primary"),
    async () => ({ provider: "openai", status: "healthy", checkedAt: new Date().toISOString() }),
  );
  gateway.registerProvider(provider);

  const result = await gateway.complete(request(), "openai");
  assert.equal(result.provider, "openai");
  assert.equal(provider.calls, 1);
});

test("provider-gateway: complete falls back on provider error", async () => {
  const gateway = new AIGateway({ defaultProvider: "openai", fallbackOrder: ["anthropic"] });
  const openai = new MockProvider(
    "openai",
    async () => {
      throw new Error("primary failed");
    },
    async () => ({ provider: "openai", status: "degraded", checkedAt: new Date().toISOString() }),
  );
  const anthropic = new MockProvider(
    "anthropic",
    async () => response("anthropic", "fallback"),
    async () => ({ provider: "anthropic", status: "healthy", checkedAt: new Date().toISOString() }),
  );
  gateway.registerProvider(openai);
  gateway.registerProvider(anthropic);

  const result = await gateway.complete(request());
  assert.equal(result.provider, "anthropic");
  assert.equal(openai.calls, 1);
  assert.equal(anthropic.calls, 1);
});

test("provider-gateway: healthCheck returns results for all providers", async () => {
  const gateway = new AIGateway();
  gateway.registerProvider(new MockProvider(
    "openai",
    async () => response("openai", "ok"),
    async () => ({ provider: "openai", status: "healthy", checkedAt: new Date().toISOString() }),
  ));
  gateway.registerProvider(new MockProvider(
    "anthropic",
    async () => response("anthropic", "ok"),
    async () => ({ provider: "anthropic", status: "down", checkedAt: new Date().toISOString() }),
  ));

  const health = await gateway.healthCheck();
  assert.equal(health.length, 2);
  assert.equal(health[0]?.provider, "openai");
  assert.equal(health[1]?.provider, "anthropic");
});

test("provider-gateway: healthyProviders returns only healthy ones", async () => {
  const gateway = new AIGateway();
  gateway.registerProvider(new MockProvider(
    "openai",
    async () => response("openai", "ok"),
    async () => ({ provider: "openai", status: "healthy", checkedAt: new Date().toISOString() }),
  ));
  gateway.registerProvider(new MockProvider(
    "gemini",
    async () => response("gemini", "ok"),
    async () => ({ provider: "gemini", status: "down", checkedAt: new Date().toISOString() }),
  ));

  const providers = await gateway.healthyProviders();
  assert.deepEqual(providers, ["openai"]);
});

test("provider-gateway: complete throws when all providers fail", async () => {
  const gateway = new AIGateway({ defaultProvider: "openai", fallbackOrder: ["anthropic"] });
  gateway.registerProvider(new MockProvider(
    "openai",
    async () => {
      throw new Error("openai failed");
    },
    async () => ({ provider: "openai", status: "down", checkedAt: new Date().toISOString() }),
  ));
  gateway.registerProvider(new MockProvider(
    "anthropic",
    async () => {
      throw new Error("anthropic failed");
    },
    async () => ({ provider: "anthropic", status: "down", checkedAt: new Date().toISOString() }),
  ));

  await assert.rejects(() => gateway.complete(request()), /All AI providers failed/);
});
