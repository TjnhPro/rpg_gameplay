import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEntity, createEntityAttributeState, getEntityBaseAttributes,
  setEntityBaseAttribute, calculateEntityStats, createEntityCollection,
  addEntity, getEntity, removeEntity, replaceEntity, listEntities,
} from '@rpg/gameplay';

const entity = createEntity({id: 'actor-1', kind: 'player'});
const rule = () => ({default: 0, bounds: {}, enabled: true});
const derived = () => ({...rule(), default: 5, scaling: [{attribute: 'strength', coefficient: 2, enabled: true}], training: 0});
const config = () => ({attributeOrder: ['strength'], statOrder: ['power'],
  attributeRules: {strength: rule()}, attributeBaselines: {strength: 0},
  baseStats: {power: 5}, rules: {power: derived()}, flatContributions: {}, modifiers: []});
const modifier = (id, target, operation, value, enabled = true) => ({
  identity: {source: 'caller', sourceInstanceId: 'active-set', id}, target, operation, value, enabled,
});

test('A: arbitrary immutable base state, keyed updates, identity and collection independence', () => {
  const input = JSON.parse('{"strength":10," odd key ":-1.25,"constructor":3,"__proto__":4}');
  const state = createEntityAttributeState(entity, input);
  input.strength = 999;
  assert.deepEqual(getEntityBaseAttributes(state), JSON.parse('{"strength":10," odd key ":-1.25,"constructor":3,"__proto__":4}'));
  const next = setEntityBaseAttribute(state, '__proto__', -0.5);
  assert.equal(next.baseAttributes.__proto__, -0.5);
  assert.equal(state.baseAttributes.__proto__, 4);
  assert.equal(Object.getPrototypeOf(next.baseAttributes), Object.prototype);
  assert.equal(next.entityId, 'actor-1');
  assert.deepEqual(entity, {id: 'actor-1', kind: 'player'});
  for (const actor of [entity, createEntity({id: 'm', kind: 'monster'}), createEntity({id: 'n', kind: 'npc'})]) {
    assert.deepEqual(createEntityAttributeState(actor, {}), {entityId: actor.id, baseAttributes: {}});
  }
  const independent = createEntityAttributeState(entity, {strength: 2});
  assert.equal(independent.baseAttributes.strength, 2);
  assert.equal(state.baseAttributes.strength, 10);
  for (const value of [state, state.baseAttributes, next, next.baseAttributes, getEntityBaseAttributes(state)]) assert.ok(Object.isFrozen(value));
  assert.throws(() => { state.entityId = 'other'; }, TypeError);
  assert.throws(() => { next.baseAttributes.__proto__ = 20; }, TypeError);
  assert.throws(() => Object.defineProperty(getEntityBaseAttributes(state), 'strength', {value: 30}), TypeError);
  assert.equal(Object.isFrozen(input), false);
  assert.deepEqual(createEntityAttributeState(entity, Object.assign(Object.create(null), {x: -1.5})).baseAttributes, {x: -1.5});
  // Read/update also capture valid structural data without aliasing it.
  const mutable = {entityId: 'structural', baseAttributes: {x: 1}};
  const read = getEntityBaseAttributes(mutable);
  const changed = setEntityBaseAttribute(mutable, 'x', 2);
  mutable.baseAttributes.x = 99;
  assert.deepEqual(read, {x: 1});
  assert.deepEqual(changed, {entityId: 'structural', baseAttributes: {x: 2}});
  const collection = addEntity(createEntityCollection(), entity);
  const bound = createEntityAttributeState(getEntity(collection, 'actor-1'), {strength: 10});
  const replaced = replaceEntity(collection, {id: 'actor-1', kind: 'companion'});
  const removed = removeEntity(replaced, 'actor-1');
  assert.deepEqual(listEntities(collection), [{id: 'actor-1', kind: 'player'}]);
  assert.deepEqual(listEntities(removed), []);
  assert.equal(calculateEntityStats(bound, config()).stats.power, 25);
  assert.equal(bound.entityId, 'actor-1');
});

test('B: reject malformed attributes/state/configuration before transforms; no accessor evaluation', () => {
  let calls = 0;
  const getter = {get strength() { calls++; return 10; }};
  const invalidMaps = [null, [], () => 1, new Date(), Object.create({strength: 10}), getter,
    {[Symbol('s')]: 1}, {'': 1}, {' \t': 1}, {x: NaN}, {x: Infinity}, {x: -Infinity}, {x: '1'}, {x: () => 1}];
  for (const input of invalidMaps) assert.throws(() => createEntityAttributeState(entity, input), TypeError);
  assert.throws(() => createEntityAttributeState({...entity, attributes: {}}, {}), TypeError);
  const state = createEntityAttributeState(entity, {strength: 10});
  for (const key of ['missing', 'Strength', 'constructor', '', ' ', null, 1]) assert.throws(() => setEntityBaseAttribute(state, key, 1), TypeError);
  for (const value of [NaN, Infinity, -Infinity, '1', undefined, () => 1]) assert.throws(() => setEntityBaseAttribute(state, 'strength', value), TypeError);
  for (const value of [null, {}, {entityId: ' ', baseAttributes: {}}, {...state, extra: 1},
    {get entityId() {calls++; return 'actor-1';}, baseAttributes: {}}]) {
    assert.throws(() => getEntityBaseAttributes(value), TypeError);
    assert.throws(() => setEntityBaseAttribute(value, 'strength', 1), TypeError);
    assert.throws(() => calculateEntityStats(value, config()), TypeError);
  }
  // Each mutation invalidates a different required shape/order/reference invariant.
  const invalid = [
    c => delete c.rules,
    c => {c.extra = 1;},
    c => {c.attributeOrder = ['strength', 'strength'];},
    c => {c.statOrder = ['power', 'power'];},
    c => {c.attributeOrder = [];},
    c => {c.attributeOrder = ['missing'];},
    c => {c.statOrder = ['strength'];},
    c => {c.statOrder = ['power', 'missing'];},
    c => {c.attributeRules = {};},
    c => {c.attributeBaselines = {};},
    c => {c.attributeBaselines.strength = NaN;},
    c => {c.rules.power.scaling[0].attribute = 'unknown';},
    c => {c.rules.power.scaling[0].coefficient = Infinity;},
    c => {c.rules.power.scaling[0].enabled = 1;},
    c => {c.rules.power.training = NaN;},
    c => {c.rules.power.default = undefined;},
    c => {c.rules.power.enabled = 'yes';},
    c => {c.rules.power.bounds = {min: 10, max: 5};},
    c => {c.rules.power.bounds = {min: -Infinity};},
    c => {c.rules.power.precision = {decimalPlaces: 101};},
    c => {c.rules.power.precision = {decimalPlaces: 0.5};},
    c => {c.rules.power.precision = undefined;},
    c => {c.baseStats.unknown = 1;},
    c => {c.baseStats.power = Infinity;},
    c => {c.flatContributions.power = '3';},
    c => {c.transforms = {unknown: x => x};},
    c => {c.transforms = {power: 1};},
    c => {c.attributeOrder = new Array(1);},
    c => {Object.defineProperty(c.statOrder, '0', {get() {calls++; return 'power';}});},
    c => {c.modifiers = new Array(1);},
    c => {c.modifiers = [modifier('x', 'unknown', 'add_flat', 1)];},
    c => {c.modifiers = [modifier('x', 'power', 'multiply', 1)];},
    c => {c.modifiers = [modifier('x', 'power', 'add_flat', NaN)];},
    c => {c.modifiers = [modifier('', 'power', 'add_flat', 1)];},
    c => {c.modifiers = [{...modifier('x', 'power', 'add_flat', 1), enabled: 1}];},
    c => {c.rules = Object.create({power: derived()});},
    c => {Object.defineProperty(c.attributeRules, 'strength', {get() {calls++; return rule();}});},
  ];
  for (const mutate of invalid) {
    const c = config();
    c.transforms = {power: value => {calls++; return value;}};
    mutate(c);
    assert.throws(() => calculateEntityStats(state, c), TypeError, String(mutate));
  }
  assert.equal(calls, 0);
  assert.deepEqual(state.baseAttributes, {strength: 10});
});

test('C: independent 25/29/32 oracle, explicit recalculation and immutable captured results', () => {
  const initial = createEntityAttributeState(entity, {strength: 10});
  const updated = setEntityBaseAttribute(initial, 'strength', 12);
  const c = config();
  const before = structuredClone(c);
  const first = calculateEntityStats(initial, c);
  const second = calculateEntityStats(updated, c);
  c.modifiers = [modifier('flat', 'power', 'add_flat', 3)];
  const third = calculateEntityStats(updated, c);
  assert.deepEqual(first, {entityId: 'actor-1', effectiveAttributes: {strength: 10}, stats: {power: 25}});
  assert.deepEqual(second, {entityId: 'actor-1', effectiveAttributes: {strength: 12}, stats: {power: 29}});
  assert.equal(third.stats.power, 32);
  assert.equal(initial.baseAttributes.strength, 10);
  assert.equal(calculateEntityStats(updated, config()).stats.power, 29); // no stale resolver
  c.modifiers[0].value = 100;
  c.rules.power.scaling[0].coefficient = 3;
  c.modifiers = [];
  assert.equal(calculateEntityStats(updated, c).stats.power, 41);
  c.attributeBaselines.strength = 2;
  assert.equal(calculateEntityStats(updated, c).stats.power, 35);
  c.baseStats.power = 7;
  assert.equal(calculateEntityStats(updated, c).stats.power, 37);
  c.flatContributions.power = -2;
  assert.equal(calculateEntityStats(updated, c).stats.power, 35);
  assert.equal(first.stats.power, 25);
  assert.equal(third.stats.power, 32);
  assert.deepEqual(config(), before);
  const untouched = config();
  calculateEntityStats(initial, untouched);
  assert.deepEqual(untouched, before);
  for (const value of [third, third.effectiveAttributes, third.stats]) assert.ok(Object.isFrozen(value));
  assert.throws(() => {third.stats.power = 1;}, TypeError);
  assert.throws(() => {third.effectiveAttributes.strength = 1;}, TypeError);
  assert.throws(() => {third.entityId = 'other';}, TypeError);
  assert.deepEqual(Object.keys(third), ['entityId', 'effectiveAttributes', 'stats']);
});

test('D: real Kernel modifier ordering/dedup/conflicts, bounds/precision/baselines and transform order', () => {
  const state = createEntityAttributeState(entity, {strength: 10});
  const c = config();
  c.attributeBaselines.strength = 2;
  c.attributeRules.strength.bounds.max = 12;
  const flat = modifier('flat', 'power', 'add_flat', 3);
  c.modifiers = [modifier('attr', 'strength', 'add_flat', 5), flat, {...flat},
    modifier('pct', 'power', 'add_percent', 0.5), modifier('pp', 'power', 'add_percentage_points', 2),
    modifier('off', 'power', 'add_flat', 999, false)];
  // Attribute clamp15→12; stat5+(12−2)*2=25; (25+3)*1.5+2=44.
  assert.deepEqual(calculateEntityStats(state, c), {entityId: 'actor-1', effectiveAttributes: {strength: 12}, stats: {power: 44}});
  c.modifiers.reverse();
  assert.equal(calculateEntityStats(state, c).stats.power, 44);
  c.modifiers.push({...flat, value: 4});
  assert.throws(() => calculateEntityStats(state, c), /Conflicting Modifier instance/);
  const ordered = config();
  ordered.attributeOrder = ['z', 'a'];
  ordered.attributeRules = {a: rule(), z: {...rule(), precision: {decimalPlaces: 1}}};
  ordered.attributeBaselines = {a: 0, z: 0};
  ordered.statOrder = ['second', 'first', 'off'];
  ordered.rules = {
    first: {...derived(), default: 1, scaling: [], bounds: {max: 3.25}, precision: {decimalPlaces: 1}},
    second: {...derived(), default: -10, scaling: [{attribute: 'z', coefficient: 2, enabled: true}], bounds: {min: -7}},
    off: {...derived(), enabled: false, scaling: []},
  };
  ordered.baseStats = {};
  const trace = [];
  ordered.transforms = {
    first: value => {trace.push(['first', value]); return 3.26;},
    second: value => {trace.push(['second', value]); return value;},
    off: value => {trace.push(['off', value]); return value;},
  };
  const orderedState = createEntityAttributeState(entity, {a: -2, z: 1.24});
  const actual = calculateEntityStats(orderedState, ordered);
  assert.deepEqual(actual.effectiveAttributes, {z: 1.2, a: -2});
  assert.deepEqual(Object.keys(actual.effectiveAttributes), ['z', 'a']);
  assert.deepEqual(actual.stats, {second: -7, first: 3.25, off: 0});
  assert.deepEqual(Object.keys(actual.stats), ['second', 'first', 'off']);
  assert.deepEqual(trace, [['second', -7.6], ['first', 1], ['off', 5]]);
  trace.length = 0;
  assert.deepEqual(calculateEntityStats(orderedState, ordered), actual);
  assert.equal(trace.length, 3);
});

test('E: schema-free empty/special-key actors and captured configuration before caller callbacks', () => {
  const empty = {attributeOrder: [], statOrder: [], attributeRules: {}, attributeBaselines: {},
    baseStats: {}, rules: {}, flatContributions: {}, modifiers: []};
  const npc = createEntity({id: 'guide', kind: 'npc'});
  assert.deepEqual(calculateEntityStats(createEntityAttributeState(npc, {}), empty),
    {entityId: 'guide', effectiveAttributes: {}, stats: {}});
  const special = {...empty, attributeOrder: ['__proto__'], statOrder: ['constructor'],
    attributeRules: Object.fromEntries([['__proto__', rule()]]), attributeBaselines: Object.fromEntries([['__proto__', 0]]),
    rules: {constructor: {...derived(), scaling: [{attribute: '__proto__', coefficient: 2, enabled: true}]}}};
  assert.deepEqual(calculateEntityStats(createEntityAttributeState(npc, JSON.parse('{"__proto__":-1.5}')), special),
    {entityId: 'guide', effectiveAttributes: JSON.parse('{"__proto__":-1.5}'), stats: {constructor: 2}});
  const c = config();
  c.statOrder = ['power', 'later'];
  c.rules.later = {...derived(), scaling: []};
  const later = value => value;
  c.transforms = {power: value => {
    c.rules.later.default = 999;
    c.statOrder.reverse();
    c.transforms.later = () => 100;
    return value;
  }, later};
  const originalTime = Date.now, originalRandom = Math.random;
  Date.now = Math.random = () => {throw new Error('Implicit time/RNG forbidden');};
  try {
    const result = calculateEntityStats(createEntityAttributeState(entity, {strength: 10}), c);
    assert.deepEqual(result.stats, {power: 25, later: 5});
    assert.deepEqual(Object.keys(result.stats), ['power', 'later']);
  } finally {Date.now = originalTime; Math.random = originalRandom;}
  for (const value of [c, c.rules.later, c.rules.later.scaling, c.transforms, later]) assert.equal(Object.isFrozen(value), false);
  const failure = config();
  failure.transforms = {power: () => {throw new Error('caller failure');}};
  assert.throws(() => calculateEntityStats(createEntityAttributeState(entity, {strength: 10}), failure), /caller failure/);
  for (const value of [NaN, Infinity, undefined, '25', {value: 25}, Promise.resolve(25)]) {
    failure.transforms.power = () => value;
    assert.throws(() => calculateEntityStats(createEntityAttributeState(entity, {strength: 10}), failure), TypeError);
  }
});
