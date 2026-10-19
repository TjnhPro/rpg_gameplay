import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEntity, createEntityLifeState, resolveEntityDefeat, reviveEntity,
  createEntityResourceState, transitionEntityResource, normalizeEntityResource,
  createEntityCollection, addEntity, removeEntity, listEntities,
  createEntityAttributeState, getEntityBaseAttributes,
  createModuleRegistry, registerModule, configureModules, composeModules,
  createGameplayMessaging, subscribeEvent, unsubscribeEvent, publishEvent,
} from '@rpg/gameplay';

const actor = createEntity({id: 'player-1', kind: 'player'});
const policy = {resourceId: 'health', minimum: 0, maximum: 100};
const life = (status = 'alive') => createEntityLifeState(actor, {status});
const resources = current => createEntityResourceState(actor, {health: {minimum: 0, maximum: 200, current}, mana: {minimum: 0, maximum: 10, current: 7}});
const options = (operation, amount) => ({operation, amount, maximum: 100,
  rule: {minimum: 0, currentAboveMaximum: 'reject', allowIncreaseFromMinimum: true}});
const expected = (before, after, outcome, entityId = 'player-1') => ({entityId, before, after, outcome, state: {entityId, status: after}});

test('A/D: explicit 10→0 defeat and 0→30 recovery/revival; no automatic life change or repeat outcome', () => {
  const initial = life(), start = resources(10);
  const spent = transitionEntityResource(start, 'health', options('decrease', 10));
  assert.deepEqual(spent.transition, {resource: 'health', before: 10, after: 0, applied: 10, reachedMinimum: true});
  assert.equal(initial.status, 'alive');
  const defeated = resolveEntityDefeat(initial, spent.state, policy);
  assert.deepEqual(defeated, expected('alive', 'dead', 'defeated'));
  assert.deepEqual(resolveEntityDefeat(defeated.state, spent.state, policy), expected('dead', 'dead', 'unchanged'));
  assert.throws(() => reviveEntity(defeated.state, spent.state, policy), TypeError);
  const restored = transitionEntityResource(spent.state, 'health', options('increase', 30));
  assert.deepEqual(restored.transition, {resource: 'health', before: 0, after: 30, applied: 30, reachedMinimum: false});
  assert.equal(defeated.state.status, 'dead');
  assert.deepEqual(resolveEntityDefeat(defeated.state, restored.state, policy), expected('dead', 'dead', 'unchanged'));
  const revived = reviveEntity(defeated.state, restored.state, policy);
  assert.deepEqual(revived, expected('dead', 'alive', 'revived'));
  assert.deepEqual(reviveEntity(revived.state, restored.state, policy), expected('alive', 'alive', 'unchanged'));
  // Caller may explicitly reinitialize resources, then revive without a generic reset engine.
  assert.deepEqual(reviveEntity(defeated.state, resources(100), policy), expected('dead', 'alive', 'revived'));
  assert.deepEqual(start.current, {health: 10, mana: 7});
  assert.deepEqual(spent.state.current, {health: 0, mana: 7});
  assert.deepEqual(restored.state.current, {health: 30, mana: 7});
  assert.deepEqual(actor, {id: 'player-1', kind: 'player'});
  for (const snapshot of [initial, defeated, defeated.state, revived, revived.state]) {
    assert.ok(Object.isFrozen(snapshot));
    assert.throws(() => {snapshot.status = 'dead';}, TypeError);
  }
  assert.throws(() => {revived.state.status = 'dead';}, TypeError);
  assert.throws(() => {revived.outcome = 'unchanged';}, TypeError);
  assert.deepEqual(Reflect.ownKeys(revived), ['entityId', 'before', 'after', 'outcome', 'state']);
  assert.deepEqual(Reflect.ownKeys(revived.state), ['entityId', 'status']);
  console.log('LIFE_TRACE_PASS health10→0; alive→dead/defeated; health0→30; dead→alive/revived; repeats=unchanged');
});

test('creation/ownership: explicit statuses, arbitrary kinds, detached snapshots and isolated actors', () => {
  const definition = {id: ' odd actor ', kind: 'custom-kind'}, config = {status: 'dead'};
  const saved = createEntityLifeState(definition, config);
  definition.id = 'changed'; config.status = 'alive';
  assert.deepEqual(saved, {entityId: ' odd actor ', status: 'dead'});
  for (const kind of ['player', 'monster', 'npc', ' alive ']) {
    const entity = createEntity({id: kind, kind});
    for (const status of ['alive', 'dead']) assert.deepEqual(createEntityLifeState(entity, {status}), {entityId: kind, status});
  }
  const a = {entityId: actor.id, status: 'alive'}, resource = {entityId: actor.id, current: {health: 50, mana: 7}};
  const result = resolveEntityDefeat(a, resource, policy);
  assert.deepEqual(result, expected('alive', 'alive', 'unchanged'));
  assert.notEqual(result.state, a);
  a.status = 'dead'; resource.current.health = 0;
  assert.equal(result.state.status, 'alive');
  assert.equal(Object.isFrozen(a), false); assert.equal(Object.isFrozen(resource.current), false);
  const b = createEntity({id: 'monster-2', kind: 'monster'}), bLife = createEntityLifeState(b, {status: 'alive'});
  const bResource = createEntityResourceState(b, {health: {minimum: 0, maximum: 100, current: 50}});
  const collection = addEntity(addEntity(createEntityCollection(), actor), b);
  const attributes = createEntityAttributeState(actor, {vigor: 9});
  resolveEntityDefeat(life(), resources(0), policy);
  assert.deepEqual(bLife, {entityId: 'monster-2', status: 'alive'});
  assert.deepEqual(bResource.current, {health: 50});
  assert.deepEqual(listEntities(collection), [actor, b]);
  assert.deepEqual(getEntityBaseAttributes(attributes), {vigor: 9});
  assert.deepEqual(listEntities(removeEntity(collection, actor.id)), [b]);
  assert.deepEqual(reviveEntity(saved, {entityId: ' odd actor ', current: {health: 30}}, policy), expected('dead', 'alive', 'revived', ' odd actor '));
});

test('B/C: exact resource selection, nonzero/negative minima, stale maximum and deterministic snapshots', () => {
  const now = Date.now, random = Math.random;
  Date.now = Math.random = () => {throw Error('Implicit time/RNG');};
  try {
    for (const [key, minimum, maximum] of [['vitality', 5, 100], ['__proto__', -5, 5], [' life ', 1.25, 1.25]]) {
      const input = {entityId: actor.id, current: Object.fromEntries([[key, minimum], ['unrelated', 50]])};
      const config = {resourceId: key, minimum, maximum};
      const run = () => resolveEntityDefeat(life(), input, config);
      assert.deepEqual(run(), expected('alive', 'dead', 'defeated'));
      assert.deepEqual(run(), run()); // Replaying an old snapshot is deliberately permitted.
      assert.deepEqual(resolveEntityDefeat(run().state, input, config), expected('dead', 'dead', 'unchanged'));
      assert.throws(() => reviveEntity(run().state, input, config), TypeError);
      assert.deepEqual(reviveEntity(life(), input, config), expected('alive', 'alive', 'unchanged'));
      if (minimum < maximum) {
        const recovered = {...input, current: {...input.current, [key]: maximum}};
        assert.deepEqual(reviveEntity(run().state, recovered, config), expected('dead', 'alive', 'revived'));
      }
    }
    const above = resources(120);
    assert.deepEqual(resolveEntityDefeat(life(), above, policy), expected('alive', 'alive', 'unchanged'));
    assert.deepEqual(resolveEntityDefeat(life('dead'), above, policy), expected('dead', 'dead', 'unchanged'));
    for (const status of ['alive', 'dead']) assert.throws(() => reviveEntity(life(status), above, policy), TypeError);
    assert.equal(above.current.health, 120);
    const normalized = normalizeEntityResource(above, 'health', {minimum: 0, maximum: 100});
    assert.equal(normalized.state.current.health, 100);
    assert.deepEqual(reviveEntity(life('dead'), normalized.state, policy), expected('dead', 'alive', 'revived'));
    assert.equal(above.current.health, 120);
    assert.throws(() => resolveEntityDefeat(life(), {entityId: actor.id, current: {'life': 5}}, {resourceId: ' life ', minimum: 5, maximum: 10}), TypeError);
  } finally {Date.now = now; Math.random = random;}
});

test('validation: closed own-data boundaries and canonical forged-resource rejection before any no-op', () => {
  let reads = 0;
  const access = key => Object.defineProperty({}, key, {enumerable: true, get() {reads++; throw Error('Getter invoked');}});
  for (const value of [null, [], {}, true, 0, '', 'dying', 'Alive', undefined]) {
    assert.throws(() => createEntityLifeState(actor, {status: value}), TypeError);
  }
  for (const config of [undefined, null, {}, [], {status: 'alive', extra: 1}, access('status'), Object.create({status: 'alive'}), {status: 'alive', [Symbol()]: 1}]) {
    assert.throws(() => createEntityLifeState(actor, config), TypeError);
  }
  for (const entity of [null, {}, {...actor, status: 'alive'}, {id: ' ', kind: 'player'}, {id: 'x', kind: ''}, Object.defineProperty({kind: 'player'}, 'id', Object.getOwnPropertyDescriptor(access('id'), 'id'))]) {
    assert.throws(() => createEntityLifeState(entity, {status: 'alive'}), TypeError);
  }
  const good = resources(0), dead = life('dead');
  const badLives = [null, [], {}, {entityId: '', status: 'dead'}, {entityId: actor.id, status: 'dying'},
    {...dead, extra: 1}, Object.create(dead), Object.defineProperty({status: 'dead'}, 'entityId', Object.getOwnPropertyDescriptor(access('entityId'), 'entityId')),
    Object.defineProperty({entityId: actor.id}, 'status', Object.getOwnPropertyDescriptor(access('status'), 'status'))];
  const badResources = [null, [], {}, {...good, extra: 1}, {entityId: 'other', current: {health: 0}},
    {entityId: actor.id, current: {}}, {entityId: actor.id, current: {health: -1}},
    {entityId: actor.id, current: {health: 0, mana: NaN}}, {entityId: actor.id, current: {health: '0'}},
    {entityId: actor.id, current: {health: Infinity}}, {entityId: actor.id, current: access('health')},
    {entityId: actor.id, current: Object.create({health: 0})}, Object.create(good),
    Object.defineProperty({entityId: actor.id}, 'current', Object.getOwnPropertyDescriptor(access('current'), 'current'))];
  const badPolicies = [null, [], {}, {...policy, extra: 1}, {...policy, resourceId: ' '}, {...policy, resourceId: 'missing'},
    {...policy, resourceId: '__proto__'}, {...policy, minimum: 2, maximum: 1}, {...policy, minimum: NaN},
    {...policy, maximum: Infinity}, {...policy, maximum: '100'}, Object.create(policy),
    Object.defineProperty({...policy}, 'minimum', Object.getOwnPropertyDescriptor(access('minimum'), 'minimum'))];
  for (const operation of [resolveEntityDefeat, reviveEntity]) {
    for (const bad of badLives) assert.throws(() => operation(bad, good, policy), TypeError);
    for (const status of ['alive', 'dead']) {
      for (const bad of badResources) assert.throws(() => operation(life(status), bad, policy), TypeError);
      for (const bad of badPolicies) assert.throws(() => operation(life(status), good, bad), TypeError);
    }
  }
  assert.equal(reads, 0);
  assert.deepEqual(good.current, {health: 0, mana: 7});
  assert.deepEqual(dead, {entityId: 'player-1', status: 'dead'});
});

test('E: caller-only GF12 publication, sequential deduplication, GF13 snapshot order and fail-fast without rollback', () => {
  const registry = registerModule(createModuleRegistry(), {id: 'entity', optional: true, dependencies: []});
  const messaging = createGameplayMessaging(composeModules(registry, configureModules(registry, {enable: ['entity']})));
  const trace = [];
  const subscribe = (eventType, handler) => subscribeEvent(messaging, {moduleId: 'entity', eventType, handler});
  const emit = result => result.outcome === 'unchanged' ? undefined : publishEvent(messaging, {type: `entity-${result.outcome}`, payload: result});
  let second;
  subscribe('entity-defeated', event => {
    trace.push(`first:${event.payload.after}`);
    unsubscribeEvent(messaging, second);
    subscribe('entity-defeated', () => {trace.push('late');});
  });
  second = subscribe('entity-defeated', event => {trace.push(`second:${event.payload.entityId}`);});
  subscribe('entity-revived', () => {trace.push('revive:first');});
  subscribe('entity-revived', () => {trace.push('revive:second');});
  const defeated = resolveEntityDefeat(life(), resources(0), policy);
  assert.deepEqual(trace, []); // Life operations have no messaging binding.
  assert.deepEqual(emit(defeated), {ok: true, eventType: 'entity-defeated', completedDeliveries: 2});
  assert.deepEqual(trace, ['first:dead', 'second:player-1']); // Unsubscribed second still in active snapshot; late not yet included.
  assert.equal(emit(resolveEntityDefeat(defeated.state, resources(0), policy)), undefined);
  const restored = transitionEntityResource(resources(0), 'health', options('increase', 30));
  assert.deepEqual(trace, ['first:dead', 'second:player-1']);
  const revived = reviveEntity(defeated.state, restored.state, policy);
  assert.equal(defeated.state.status, 'dead');
  assert.deepEqual(emit(revived), {ok: true, eventType: 'entity-revived', completedDeliveries: 2});
  assert.equal(emit(reviveEntity(revived.state, restored.state, policy)), undefined);
  assert.deepEqual(trace, ['first:dead', 'second:player-1', 'revive:first', 'revive:second']);
  let attempts = 0;
  const failing = createGameplayMessaging(composeModules(registry, configureModules(registry, {enable: ['entity']})));
  subscribeEvent(failing, {moduleId: 'entity', eventType: 'caller-death', handler() {attempts++;}});
  subscribeEvent(failing, {moduleId: 'entity', eventType: 'caller-death', handler() {attempts++; throw Error('listener failed');}});
  subscribeEvent(failing, {moduleId: 'entity', eventType: 'caller-death', handler() {attempts++;}});
  const failure = publishEvent(failing, {type: 'caller-death', payload: defeated});
  assert.equal(failure.ok, false); assert.equal(failure.completedDeliveries, 1);
  assert.equal(failure.failure.eventType, 'caller-death'); assert.equal(failure.failure.moduleId, 'entity');
  assert.equal(failure.failure.message, 'listener failed'); assert.equal(attempts, 2);
  assert.deepEqual(defeated, expected('alive', 'dead', 'defeated'));
  assert.equal(Object.isFrozen(defeated.state), true); // No rollback/retry after listener failure.
  console.log('LIFE_EVENTS_PASS explicit_only; first/second; repeats=0; fail_fast=1_completed/2_attempts; no_rollback');
});
