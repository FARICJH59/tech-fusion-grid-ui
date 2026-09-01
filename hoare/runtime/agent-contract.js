'use strict';

const crypto = require('crypto');

function assertString(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name}_REQUIRED`);
}

function createAgentManifest(input = {}) {
  assertString(input.id, 'AGENT_ID');
  assertString(input.name, 'AGENT_NAME');
  const capabilities = Array.isArray(input.capabilities) ? [...new Set(input.capabilities.map(String))] : [];
  return Object.freeze({
    id: input.id,
    name: input.name,
    version: input.version || '0.1.0',
    description: input.description || '',
    capabilities,
    compliance: Array.isArray(input.compliance) ? [...new Set(input.compliance.map(String))] : [],
    security: input.security || { mode: 'policy-governed' },
    transport: input.transport || ['http'],
    metadata: input.metadata || {}
  });
}

function createExecutionContext(input = {}) {
  return Object.freeze({
    execution_id: input.execution_id || `exec-${crypto.randomUUID()}`,
    tenant_id: input.tenant_id || 'default',
    agent_id: input.agent_id,
    actor: input.actor || 'system',
    requested_at: input.requested_at || new Date().toISOString(),
    trace_id: input.trace_id || crypto.randomUUID(),
    policy: input.policy || {}
  });
}

function createObservation(input = {}) {
  assertString(input.agent_id, 'AGENT_ID');
  return {
    schema_version: '1.0',
    execution_id: input.execution_id,
    agent_id: input.agent_id,
    status: input.status || 'SUCCESS',
    result: input.result ?? null,
    error: input.error ?? null,
    observed_at: input.observed_at || new Date().toISOString()
  };
}

module.exports = { createAgentManifest, createExecutionContext, createObservation };
