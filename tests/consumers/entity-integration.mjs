import assert from 'node:assert/strict';
import test from 'node:test';
import * as g from '@rpg/gameplay';

// Consumer-owned fixture policy, never a library preset or a second engine.
function session() {
  const trace = [], calls = {clock: 0, random: 0, ids: 0};
  const execution = g.createExecutionContext({
    clock: {now() { calls.clock++; return 2000; }},
    random: {next() { calls.random++; return 0.25; }},
    ids: {next() { calls.ids++; return 'player-1'; }},
  });
  const registry = g.registerModule(g.createModuleRegistry(), {id: 'entity', optional: true, dependencies: []});
  assert.deepEqual(g.composeModules(registry, g.configureModules(registry)).moduleIds, []);
  const composition = g.composeModules(registry, g.configureModules(registry, {enable: ['entity']}));
  trace.push(['modules', ...composition.moduleIds]);
  const messaging = g.createGameplayMessaging(composition);
  let runtime = g.createGameplayRuntime(composition, {entity: {
    initialize() { trace.push(['initialize', 'entity']); },
    start() { trace.push(['start', 'entity']); },
    stop() { trace.push(['stop', 'entity', g.unsubscribeModuleEvents(messaging, 'entity')]); },
    dispose() { trace.push(['dispose', 'entity']); },
  }});
  const originalInspection = g.inspectGameplayRuntime(runtime);
  const advance = fn => { const result = fn(runtime); assert.equal(result.ok, true); runtime = result.runtime; };
  advance(g.initializeGameplayRuntime); advance(g.startGameplayRuntime);
  assert.deepEqual(calls, {clock: 0, random: 0, ids: 0});
  const actor = g.createEntity({id: g.nextExecutionId(execution), kind: 'player'});
  const monster = g.createEntity({id: 'monster-1', kind: 'monster'});
  const npc = g.createEntity({id: 'npc-1', kind: 'npc'});
  const collection = [actor, monster, npc].reduce(g.addEntity, g.createEntityCollection());
  trace.push(['collection', g.listEntities(collection)]);
  assert.deepEqual(g.getEntity(collection, actor.id), actor);
  assert.equal(g.hasEntity(collection, 'missing'), false);
  const replaced = g.replaceEntity(collection, {id: npc.id, kind: 'merchant'});
  assert.deepEqual(g.listEntities(replaced).map(x => x.id), ['player-1', 'monster-1', 'npc-1']);
  assert.deepEqual(g.listEntities(g.removeEntity(replaced, npc.id)), [actor, monster]);
  assert.equal(g.getEntity(collection, npc.id).kind, 'npc');

  const attributes = g.createEntityAttributeState(actor, {strength: 10});
  const config = {attributeOrder: ['strength'], statOrder: ['max-life'],
    attributeRules: {strength: {default: 0, bounds: {}, enabled: true}}, attributeBaselines: {strength: 0},
    baseStats: {'max-life': 5}, rules: {'max-life': {default: 5, bounds: {}, enabled: true,
      scaling: [{attribute: 'strength', coefficient: 2, enabled: true}], training: 0}},
    flatContributions: {}, modifiers: []};
  const stats = g.calculateEntityStats(attributes, config);
  const updated = g.setEntityBaseAttribute(attributes, 'strength', 12);
  assert.equal(stats.stats['max-life'], 25); // No auto-recalculation.
  const recalculated = g.calculateEntityStats(updated, config);
  const modified = g.calculateEntityStats(updated, {...config, modifiers: [{
    identity: {source: 'caller', sourceInstanceId: 'set-1', id: 'flat'},
    target: 'max-life', operation: 'add_flat', value: 3, enabled: true,
  }]});
  trace.push(['stats', stats.stats['max-life'], recalculated.stats['max-life'], modified.stats['max-life']]);
  const initial = g.createEntityResourceState(actor, {health: {minimum: 0, maximum: modified.stats['max-life'], current: 30}});
  assert.equal(initial.current.health, 30); // Changing selected stats does not synchronize resources.
  const normalized = g.normalizeEntityResource(initial, 'health', {minimum: 0, maximum: stats.stats['max-life']});
  trace.push(['normalize', normalized.calculation]);
  const policy = {resourceId: 'health', minimum: 0, maximum: stats.stats['max-life']};
  const options = (operation, amount) => ({operation, amount, maximum: policy.maximum,
    rule: {minimum: 0, currentAboveMaximum: 'reject', allowIncreaseFromMinimum: true}});
  const ready = g.transitionEntityResource(normalized.state, 'health', options('decrease', 5));
  trace.push(['ready', ready.transition]);
  let resources = ready.state, life = g.createEntityLifeState(actor, {status: 'alive'});
  const oldLife = life;
  const other = {attributes: g.createEntityAttributeState(monster, {strength: 3}),
    resources: g.createEntityResourceState(monster, {health: {minimum: 0, maximum: 11, current: 7}}),
    life: g.createEntityLifeState(monster, {status: 'alive'})};
  const otherBefore = structuredClone(other);
  const events = [];
  for (const eventType of ['entity-defeated', 'entity-revived']) {
    for (const label of ['first', 'second']) g.subscribeEvent(messaging, {moduleId: 'entity', eventType,
      handler(event) { events.push([label, event.type, event.payload.entityId, event.payload.after]); }});
  }
  g.registerCommandHandler(messaging, {moduleId: 'entity', commandType: 'deplete', handler(command) {
    // Commit caller references only after every independent operation succeeds.
    const spent = g.transitionEntityResource(resources, 'health', options('decrease', command.payload));
    const defeated = g.resolveEntityDefeat(life, spent.state, policy);
    resources = spent.state; life = defeated.state;
    return {status: 'success', value: {transition: spent.transition, outcome: defeated.outcome}};
  }});
  trace.push(['execution', g.readExecutionTime(execution), g.nextExecutionRandom(execution), actor.id]);
  trace.push(['command', g.dispatchCommand(messaging, {type: 'deplete', payload: 20})]);
  assert.deepEqual(events, []); // Domain changes and command dispatch publish nothing.
  assert.equal(oldLife.status, 'alive');
  trace.push(['publish-defeat', g.publishEvent(messaging, {type: 'entity-defeated', payload: {...life, after: life.status}})]);
  assert.equal(g.resolveEntityDefeat(life, resources, policy).outcome, 'unchanged');
  const failedResources = resources, failedLife = life;
  assert.throws(() => g.reviveEntity(life, resources, policy), TypeError);
  assert.throws(() => g.resolveEntityDefeat(life, other.resources, policy), TypeError);
  assert.equal(resources, failedResources); assert.equal(life, failedLife);
  const invalid = g.dispatchCommand(messaging, {type: 'deplete', payload: -1});
  assert.equal(invalid.status, 'failed');
  assert.equal(invalid.failure.commandType, 'deplete'); assert.equal(invalid.failure.moduleId, 'entity');
  assert.equal(resources, failedResources); assert.equal(life, failedLife);
  trace.push(['invalid', 'revival-at-minimum', 'identity-mismatch', invalid.status, resources.current.health, life.status]);
  const recovered = g.regenerateEntityResource(resources, 'health', {minimum: 0, maximum: policy.maximum,
    ratePerSecond: 5, elapsedSeconds: 2, eligible: true, precision: {decimalPlaces: 2}});
  assert.equal(life.status, 'dead'); // Explicit caller elapsed time, no scheduler or automatic revival.
  trace.push(['recover', recovered.transition]);
  const revived = g.reviveEntity(life, recovered.state, policy);
  trace.push(['life', revived]);
  assert.equal(g.reviveEntity(revived.state, recovered.state, policy).outcome, 'unchanged');
  trace.push(['publish-revival', g.publishEvent(messaging, {type: 'entity-revived', payload: revived})]);
  trace.push(['events', events]);
  let attempts = 0;
  g.subscribeEvent(messaging, {moduleId: 'entity', eventType: 'caller-failure', handler() { attempts++; }});
  g.subscribeEvent(messaging, {moduleId: 'entity', eventType: 'caller-failure', handler() { attempts++; throw Error('listener failed'); }});
  g.subscribeEvent(messaging, {moduleId: 'entity', eventType: 'caller-failure', handler() { attempts++; }});
  const failure = g.publishEvent(messaging, {type: 'caller-failure', payload: revived});
  assert.equal(failure.ok, false);
  trace.push(['failure', failure.completedDeliveries, attempts, failure.failure.moduleId, failure.failure.message]);
  assert.equal(revived.state.status, 'alive'); assert.equal(recovered.state.current.health, 10);
  // Completed external callbacks remain completed: no rollback or retry.
  assert.deepEqual(other, otherBefore);
  assert.deepEqual(attributes.baseAttributes, {strength: 10});
  assert.deepEqual(initial.current, {health: 30});
  assert.deepEqual(ready.state.current, {health: 20});
  assert.deepEqual(failedResources.current, {health: 0});
  assert.deepEqual(collection.entities, [actor, monster, npc]);
  for (const snapshot of [collection.entities, attributes.baseAttributes, stats.stats, normalized.state.current,
    ready.transition, failedLife, failedResources.current, revived, revived.state, recovered.state.current]) {
    assert.ok(Object.isFrozen(snapshot));
    assert.equal(Reflect.set(snapshot, 'consumerMutation', 1), false);
  }
  // Same data/functions carry opaque caller profile data. No movement/combat/render assertion.
  const profiles = ['text', '2d', '2.5d'].map((profile, i) => ({profile, entityId: actor.id,
    data: i === 0 ? {action: 'inspect'} : i === 1 ? {position: {x: 1, y: 2}} : {position: {x: 1, y: 2, z: 3}, direction: 'north'}}));
  const observed = [];
  g.subscribeEvent(messaging, {moduleId: 'entity', eventType: 'profile-data', handler(event) { observed.push(event.payload); }});
  for (const payload of profiles) assert.equal(g.publishEvent(messaging, {type: 'profile-data', payload}).completedDeliveries, 1);
  assert.deepEqual(observed, profiles);
  assert.deepEqual(observed.map(x => g.getEntity(collection, x.entityId)), [actor, actor, actor]);
  advance(g.stopGameplayRuntime); advance(g.disposeGameplayRuntime);
  trace.push(['after-cleanup', g.publishEvent(messaging, {type: 'entity-revived', payload: revived}).completedDeliveries]);
  trace.push(['inspection', g.inspectGameplayRuntime(runtime).status, originalInspection.status]);
  assert.deepEqual(calls, {clock: 1, random: 1, ids: 1});
  return trace;
}

// Independent literal oracle: 5+10*2=25, 5+12*2=29, +3=32;
// normalize30→25, decrease5→20, decrease20→0, explicit5*2→10.
const expected = [
  ['modules', 'entity'], ['initialize', 'entity'], ['start', 'entity'],
  ['collection', [{id: 'player-1', kind: 'player'}, {id: 'monster-1', kind: 'monster'}, {id: 'npc-1', kind: 'npc'}]],
  ['stats', 25, 29, 32],
  ['normalize', {resource: 'health', before: 30, after: 25, initialized: false}],
  ['ready', {resource: 'health', before: 25, after: 20, applied: 5, reachedMinimum: false}],
  ['execution', 2000, 0.25, 'player-1'],
  ['command', {status: 'success', commandType: 'deplete', moduleId: 'entity', value: {
    transition: {resource: 'health', before: 20, after: 0, applied: 20, reachedMinimum: true}, outcome: 'defeated'}}],
  ['publish-defeat', {ok: true, eventType: 'entity-defeated', completedDeliveries: 2}],
  ['invalid', 'revival-at-minimum', 'identity-mismatch', 'failed', 0, 'dead'],
  ['recover', {resource: 'health', before: 0, after: 10, applied: 10, reachedMinimum: false}],
  ['life', {entityId: 'player-1', before: 'dead', after: 'alive', outcome: 'revived', state: {entityId: 'player-1', status: 'alive'}}],
  ['publish-revival', {ok: true, eventType: 'entity-revived', completedDeliveries: 2}],
  ['events', [['first', 'entity-defeated', 'player-1', 'dead'], ['second', 'entity-defeated', 'player-1', 'dead'],
    ['first', 'entity-revived', 'player-1', 'alive'], ['second', 'entity-revived', 'player-1', 'alive']]],
  ['failure', 1, 2, 'entity', 'listener failed'],
  ['stop', 'entity', 8], ['dispose', 'entity'], ['after-cleanup', 0], ['inspection', 'disposed', 'created'],
];

test('EC18: installed Entity/Foundation flow, independent deterministic oracle, failure and isolation', () => {
  const first = session();
  assert.deepEqual(first, expected);
  const second = session();
  assert.deepEqual(second, expected); assert.deepEqual(first, second);
  console.log('ENTITY_INTEGRATION_TRACE_PASS ' + JSON.stringify(first));
  console.log('ENTITY_PROFILE_DATA_PASS text/2d/2.5d compatibility=EVALUATED gameplay=NOT_EVALUATED');
});
