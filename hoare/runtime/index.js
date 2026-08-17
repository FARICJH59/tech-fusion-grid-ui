'use strict';

const { AgentRegistry } = require('./agent-registry');
const { createAgentManifest, createExecutionContext, createObservation } = require('./agent-contract');

class HoareRuntime {
  constructor() { this.registry = new AgentRegistry(); }

  register(manifestInput, handler) {
    return this.registry.register(createAgentManifest(manifestInput), handler);
  }

  agents() { return this.registry.list(); }

  capabilities(capability) { return this.registry.findByCapability(capability); }

  async execute(agentId, input = {}, context = {}) {
    const execution = createExecutionContext({ ...context, agent_id: agentId });
    try {
      const result = await this.registry.execute(agentId, execution, input);
      return createObservation({ execution_id: execution.execution_id, agent_id: agentId, result });
    } catch (error) {
      return createObservation({
        execution_id: execution.execution_id,
        agent_id: agentId,
        status: 'FAILED',
        error: { code: error.code || 'AGENT_EXECUTION_FAILED', message: error.message }
      });
    }
  }
}

module.exports = { HoareRuntime, AgentRegistry, createAgentManifest, createExecutionContext, createObservation };
