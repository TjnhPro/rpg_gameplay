import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../../dist/index.js';

test('effect admission and expiry use explicit eligibility and caller time', () => {
  const target = g.createEntity({id: 'target', kind: 'monster'});
  const entities = g.addEntity(g.addEntity(g.createEntityCollection(), target), {id: 'source', kind: 'player'});
  const definition = g.createEffectDefinition({effectId: 'poison'});
  const instance = g.createEffectInstance(definition, target, {effectInstanceId: 'poison-1',
    source: {kind: 'entity', sourceId: 'source', sourceKey: 'skill/poison'}});
  const initial = g.createEffectState(target);
  const policy = {sourceEligible: true, targetEligible: true, allowedTargetLifeStatuses: ['alive']};
  const life = {entityId: target.id, status: 'alive'};
  const application = g.applyEffect(definition, {instance}, initial, entities, life, policy);
  assert.equal(application.status, 'applied');
  const denied = g.applyEffect(definition, {instance}, initial, entities,
    {...life, status: 'dead'}, policy);
  assert.equal(denied.status, 'rejected');
  assert.equal(initial.instances.length, 0);
  let now = 1000;
  const context = g.createExecutionContext({clock: {now: () => now}});
  const lifecycle = g.createEffectLifecycleState(initial, context);
  const started = g.startEffectLifetime(lifecycle, application, {mode: 'timed', durationMs: 5000}, context);
  assert.equal(started.state.lifetimes[0].expiresAtMs, 6000);
  now = 5999;
  assert.equal(g.advanceEffectLifecycle(started.state, context).state.effectState.instances.length, 1);
  now = 6000;
  const expired = g.advanceEffectLifecycle(started.state, context);
  assert.deepEqual(expired.state.effectState.instances, []);
  assert.equal(started.state.effectState.instances.length, 1);
});
