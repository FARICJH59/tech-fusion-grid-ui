import assert from 'node:assert/strict';
import test from 'node:test';

const { HoareRuntime } = require('../hoare/runtime');

test('HOARE registers and executes a tenant-scoped agent', async () => {
  const runtime = new HoareRuntime();

  runtime.register({
    id: 'shelf-scouter',
    name: 'Shelf Scouter',
    version: '1.0.0',
    capabilities: ['vision.shelf.scan', 'inventory.observe'],
    compliance: ['audit-ready']
  }, async ({ context, input }: any) => ({
    tenant_id: context.tenant_id,
    image: input.image,
    products: []
  }));

  assert.equal(runtime.agents().length, 1);
  assert.equal(runtime.capabilities('vision.shelf.scan').length, 1);

  const observation = await runtime.execute('shelf-scouter', { image: 'test.jpg' }, {
    tenant_id: 'tenant-demo',
    actor: 'client'
  });

  assert.equal(observation.status, 'SUCCESS');
  assert.equal(observation.agent_id, 'shelf-scouter');
  assert.equal(observation.result.tenant_id, 'tenant-demo');
  assert.ok(observation.execution_id);
});

test('HOARE normalizes agent failures', async () => {
  const runtime = new HoareRuntime();
  runtime.register({ id: 'failing-agent', name: 'Failing Agent' }, async () => {
    throw new Error('intentional failure');
  });

  const observation = await runtime.execute('failing-agent');
  assert.equal(observation.status, 'FAILED');
  assert.equal(observation.error.code, 'AGENT_EXECUTION_FAILED');
});
