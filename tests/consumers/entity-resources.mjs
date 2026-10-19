import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEntity, createEntityResourceState, getEntityResourceCurrent,
  normalizeEntityResource, transitionEntityResource, regenerateEntityResource,
  createEntityAttributeState, setEntityBaseAttribute, calculateEntityStats,
  createEntityCollection, addEntity, removeEntity, listEntities,
} from '@rpg/gameplay';

const entity = createEntity({id: 'actor-1', kind: 'player'});
const definitions = () => ({health: {minimum: 0, maximum: 100, current: 80}, mana: {minimum: 0, maximum: 50}});
const options = (operation = 'decrease', amount = 25) => ({operation, amount, maximum: 100,
  rule: {minimum: 0, currentAboveMaximum: 'reject', allowIncreaseFromMinimum: true}});
const regen = () => ({minimum: 0, maximum: 100, ratePerSecond: 2.5, elapsedSeconds: 2,
  eligible: true, precision: {decimalPlaces: 2}});
const stateAt = current => createEntityResourceState(entity, {health: {minimum: 0, maximum: 200, current}});
const diagnostic = (before, after, applied, reachedMinimum = false) => ({resource: 'health', before, after, applied, reachedMinimum});

test('A/E: caller-defined initialization, omitted/zero current, exact/special IDs and explicit normalization', () => {
  const input = definitions();
  const initial = createEntityResourceState(entity, input);
  assert.deepEqual(initial, {entityId: 'actor-1', current: {health: 80, mana: 50}});
  input.health.current = 999;
  input.mana.maximum = 999;
  assert.equal(initial.current.health, 80);
  for (const actor of [entity, createEntity({id: 'monster', kind: 'monster'}), createEntity({id: 'npc', kind: 'npc'})]) {
    assert.deepEqual(createEntityResourceState(actor, {}), {entityId: actor.id, current: {}});
  }
  const special = createEntityResourceState(entity, Object.fromEntries([
    ['__proto__', {minimum: -2, maximum: 3, current: -10}],
    ['constructor', {minimum: 1, maximum: 2, current: 9}],
    [' odd key ', {minimum: 0, maximum: 5, current: 0}],
    ['fixed', {minimum: 1.25, maximum: 1.25}],
  ]));
  assert.deepEqual(special.current, JSON.parse('{"__proto__":-2,"constructor":2," odd key ":0,"fixed":1.25}'));
  assert.equal(Object.getPrototypeOf(special.current), Object.prototype);
  assert.equal(getEntityResourceCurrent(special, '__proto__'), -2);
  for (const key of ['toString', 'odd key', 'Health', 'unknown']) assert.equal(getEntityResourceCurrent(initial, key), undefined);
  const full = createEntityResourceState(entity, {health: {minimum: 0, maximum: 100}});
  const normalized = normalizeEntityResource(full, 'health', {minimum: 0, maximum: 80});
  assert.deepEqual(normalized.calculation, {resource: 'health', before: 100, after: 80, initialized: false});
  assert.equal(full.current.health, 100);
  assert.equal(normalized.state.current.health, 80);
  assert.equal(normalizeEntityResource(initial, 'health', {minimum: 0, maximum: 120}).state.current.health, 80);
  assert.equal(normalizeEntityResource({entityId: 'external', current: {health: -5}}, 'health', {minimum: 2, maximum: 10}).state.current.health, 2);
  for (const value of [initial, initial.current, normalized, normalized.state, normalized.state.current, normalized.calculation]) assert.ok(Object.isFrozen(value));
  assert.throws(() => {normalized.calculation.after = 999;}, TypeError);
  assert.throws(() => {initial.current.mana = 0;}, TypeError);
  assert.equal(Object.isFrozen(input), false);
});

test('B/C/D: authoritative increase/decrease diagnostics, above-max policies and minimum recovery', () => {
  const initial = createEntityResourceState(entity, definitions());
  const decreased = transitionEntityResource(initial, 'health', options());
  const increased = transitionEntityResource(decreased.state, 'health', options('increase', 15));
  assert.deepEqual(decreased.transition, diagnostic(80, 55, 25));
  assert.deepEqual(increased.transition, diagnostic(55, 70, 15));
  assert.deepEqual(initial.current, {health: 80, mana: 50});
  assert.deepEqual(increased.state.current, {health: 70, mana: 50});
  const above = stateAt(120);
  const allow = {...options('increase', 10), rule: {...options().rule, currentAboveMaximum: 'allow'}};
  assert.deepEqual(transitionEntityResource(above, 'health', allow).transition, diagnostic(120, 100, -20));
  assert.deepEqual(transitionEntityResource(above, 'health', {...allow, operation: 'decrease'}).transition, diagnostic(120, 100, 10));
  assert.throws(() => transitionEntityResource(above, 'health', options()), /Current resource exceeds maximum/);
  assert.equal(above.current.health, 120);
  assert.deepEqual(transitionEntityResource(stateAt(5), 'health', options('decrease', 20)).transition, diagnostic(5, 0, 5, true));
  const minimum = stateAt(0);
  assert.deepEqual(transitionEntityResource(minimum, 'health', {...options('increase', 20),
    rule: {...options().rule, allowIncreaseFromMinimum: false}}).transition, diagnostic(0, 0, 0));
  assert.deepEqual(transitionEntityResource(minimum, 'health', options('increase', 20)).transition, diagnostic(0, 20, 20));
  assert.deepEqual(transitionEntityResource(stateAt(100), 'health', options('increase', 2)).transition, diagnostic(100, 100, 0));
  assert.deepEqual(transitionEntityResource(initial, 'health', options('decrease', 0)).transition, diagnostic(80, 80, 0));
  assert.deepEqual(transitionEntityResource(stateAt(2.5), 'health', {...options('decrease', 1.25), maximum: 3,
    rule: {...options().rule, minimum: 1.5}}).transition, diagnostic(2.5, 1.5, 1, true));
  assert.deepEqual(transitionEntityResource(stateAt(2), 'health', {...options('increase', 5), maximum: 2,
    rule: {...options().rule, minimum: 2}}).transition, diagnostic(2, 2, 0));
  for (const value of [increased, increased.state, increased.state.current, increased.transition]) assert.ok(Object.isFrozen(value));
  assert.throws(() => {increased.transition.applied = 0;}, TypeError);
  assert.deepEqual(Object.keys(increased.state), ['entityId', 'current']); // No inferred life/death.
});

test('F: explicit regeneration, rounding/caps and ineligible Kernel no-op without ignored-field reads', () => {
  const initial = stateAt(30);
  assert.deepEqual(regenerateEntityResource(initial, 'health', regen()).transition, diagnostic(30, 35, 5));
  assert.deepEqual(regenerateEntityResource(stateAt(98), 'health', regen()).transition, diagnostic(98, 100, 2));
  assert.deepEqual(regenerateEntityResource(initial, 'health', {...regen(), ratePerSecond: 0}).transition, diagnostic(30, 30, 0));
  assert.deepEqual(regenerateEntityResource(initial, 'health', {...regen(), elapsedSeconds: 0}).transition, diagnostic(30, 30, 0));
  assert.deepEqual(regenerateEntityResource(stateAt(30.12), 'health', {...regen(), ratePerSecond: 0.333, elapsedSeconds: 1}).transition,
    diagnostic(30.12, 30.45, 30.45 - 30.12)); // Independent literal oracle; retain IEEE-754 difference.
  // Coarse precision must not reduce current when rounded value is lower.
  assert.deepEqual(regenerateEntityResource(stateAt(30.14), 'health', {...regen(), ratePerSecond: 0, precision: {decimalPlaces: 1}}).transition,
    diagnostic(30.14, 30.14, 0));
  assert.deepEqual(regenerateEntityResource(initial, 'health', {...regen(), ratePerSecond: Number.MAX_VALUE, elapsedSeconds: 2}).transition,
    diagnostic(30, 100, 70));
  let reads = 0;
  const ignored = {eligible: false};
  for (const key of ['minimum', 'maximum', 'ratePerSecond', 'elapsedSeconds', 'precision']) {
    Object.defineProperty(ignored, key, {enumerable: true, get() {reads++; throw new Error('Ignored field read');}});
  }
  const above = stateAt(120);
  const noop = regenerateEntityResource(above, 'health', ignored);
  assert.deepEqual(noop.transition, diagnostic(120, 120, 0));
  assert.equal(reads, 0);
  assert.deepEqual(regenerateEntityResource(initial, 'health', {...regen(), eligible: false,
    minimum: NaN, maximum: -Infinity, ratePerSecond: -1, elapsedSeconds: undefined, precision: null}).transition, diagnostic(30, 30, 0));
  assert.equal(initial.current.health, 30);
  assert.notEqual(noop.state, above);
  assert.ok(Object.isFrozen(noop.transition));
});

test('validation: malformed boundaries fail atomically, unknown operations never upsert, accessors never execute', () => {
  let reads = 0;
  const getter = {get health() {reads++; return {minimum: 0, maximum: 10};}};
  for (const input of [null, [], new Date(), Object.create({health: {minimum: 0, maximum: 1}}), getter,
    {[Symbol('s')]: {}}, {' ': {minimum: 0, maximum: 1}}, {health: null}, {health: {minimum: 2, maximum: 1}},
    {health: {minimum: NaN, maximum: 10}}, {health: {minimum: 0, maximum: Infinity}},
    {health: {minimum: 0, maximum: 10, current: undefined}}, {health: {minimum: 0, maximum: 10, current: '1'}},
    {health: {minimum: 0, maximum: 10, extra: 1}}, {health: {minimum: 0, maximum: 10, get current() {reads++; return 1;}}}]) {
    assert.throws(() => createEntityResourceState(entity, input), TypeError);
  }
  const defs = {...definitions(), bad: {minimum: 10, maximum: 1}};
  const before = structuredClone(defs);
  assert.throws(() => createEntityResourceState(entity, defs), TypeError);
  assert.deepEqual(defs, before);
  assert.throws(() => createEntityResourceState({...entity, current: {}}, {}), TypeError);
  const state = stateAt(30);
  const operations = [s => getEntityResourceCurrent(s, 'health'),
    s => normalizeEntityResource(s, 'health', {minimum: 0, maximum: 100}),
    s => transitionEntityResource(s, 'health', options()), s => regenerateEntityResource(s, 'health', regen())];
  for (const bad of [null, {}, {...state, extra: 1}, {entityId: ' ', current: {}}, {entityId: 'x', current: {health: Infinity}},
    {entityId: 'x', get current() {reads++; return {health: 30};}}]) {
    for (const operation of operations) assert.throws(() => operation(bad), TypeError);
  }
  for (const key of ['', ' ', null, 1]) assert.throws(() => getEntityResourceCurrent(state, key), TypeError);
  for (const key of ['unknown', '__proto__', 'constructor']) {
    assert.throws(() => normalizeEntityResource(state, key, {minimum: 0, maximum: 100}), TypeError);
    assert.throws(() => transitionEntityResource(state, key, options()), TypeError);
    assert.throws(() => regenerateEntityResource(state, key, regen()), TypeError);
  }
  for (const patch of [{amount: -1}, {amount: NaN}, {amount: Infinity}, {amount: '1'}, {operation: 'heal'},
    {maximum: -1}, {maximum: Infinity}, {rule: {}}, {rule: {...options().rule, minimum: 31}},
    {rule: {...options().rule, currentAboveMaximum: 'clamp'}}, {rule: {...options().rule, allowIncreaseFromMinimum: 1}},
    {get amount() {reads++; return 1;}}, {extra: 1}]) {
    // Preserve getters so the boundary, not object spread, rejects them.
    const input = Object.defineProperties(options(), Object.getOwnPropertyDescriptors(patch));
    assert.throws(() => transitionEntityResource(state, 'health', input), TypeError);
  }
  for (const patch of [{ratePerSecond: -1}, {elapsedSeconds: -1}, {elapsedSeconds: NaN}, {ratePerSecond: Infinity},
    {minimum: 31}, {maximum: 29}, {minimum: 100, maximum: 50}, {eligible: 1}, {precision: null},
    {precision: {decimalPlaces: -1}}, {precision: {decimalPlaces: 101}}, {precision: {decimalPlaces: 1.5}},
    {precision: {decimalPlaces: '2'}}, {get ratePerSecond() {reads++; return 1;}}, {extra: 1}]) {
    const input = Object.defineProperties(regen(), Object.getOwnPropertyDescriptors(patch));
    assert.throws(() => regenerateEntityResource(state, 'health', input), TypeError);
  }
  for (const bounds of [{minimum: 1, maximum: 0}, {minimum: 0, maximum: NaN}, {minimum: 0}, {minimum: 0, maximum: 10, current: 1}]) {
    assert.throws(() => normalizeEntityResource(state, 'health', bounds), TypeError);
  }
  assert.equal(reads, 0);
  assert.deepEqual(state.current, {health: 30});
});

test('G/H: deterministic isolated actors, structural ownership and explicit EC08 maximum handoff', () => {
  const originalTime = Date.now, originalRandom = Math.random;
  Date.now = Math.random = () => {throw new Error('Implicit time/RNG forbidden');};
  try {
    const actor2 = createEntity({id: 'actor-2', kind: 'monster'});
    const a = createEntityResourceState(entity, definitions()), b = createEntityResourceState(actor2, definitions());
    const trace = () => {
      const decreased = transitionEntityResource(a, 'health', options());
      return regenerateEntityResource(decreased.state, 'health', regen());
    };
    assert.deepEqual(trace(), trace());
    assert.equal(trace().state.current.health, 60);
    assert.deepEqual(b, {entityId: 'actor-2', current: {health: 80, mana: 50}});
    const mutable = {entityId: 'structural', current: {health: 30, mana: 9}};
    const detached = regenerateEntityResource(mutable, 'health', regen());
    mutable.current.mana = 999;
    assert.deepEqual(detached.state.current, {health: 35, mana: 9});
    const numeric = {default: 0, enabled: true, bounds: {}};
    const config = {attributeOrder: ['vigor'], statOrder: ['capacity'], attributeRules: {vigor: numeric},
      attributeBaselines: {vigor: 0}, baseStats: {}, rules: {capacity: {...numeric,
        scaling: [{attribute: 'vigor', coefficient: 2, enabled: true}], training: 0}}, flatContributions: {}, modifiers: []};
    const attributes = createEntityAttributeState(entity, {vigor: 50});
    const firstStats = calculateEntityStats(attributes, config);
    const resources = createEntityResourceState(entity, {health: {minimum: 0, maximum: firstStats.stats.capacity}});
    const nextStats = calculateEntityStats(setEntityBaseAttribute(attributes, 'vigor', 40), config);
    assert.equal(firstStats.stats.capacity, 100);
    assert.equal(nextStats.stats.capacity, 80);
    assert.equal(resources.current.health, 100); // No implicit sync/refill.
    const normalized = normalizeEntityResource(resources, 'health', {minimum: 0, maximum: nextStats.stats.capacity});
    assert.equal(normalized.state.current.health, 80);
    assert.equal(resources.current.health, 100);
    const collection = addEntity(createEntityCollection(), entity);
    assert.deepEqual(listEntities(removeEntity(collection, entity.id)), []);
    assert.equal(normalized.state.entityId, entity.id); // No global membership authority.
    assert.deepEqual(entity, {id: 'actor-1', kind: 'player'});
    assert.deepEqual(Object.keys(normalized.state), ['entityId', 'current']);
  } finally {Date.now = originalTime; Math.random = originalRandom;}
});
