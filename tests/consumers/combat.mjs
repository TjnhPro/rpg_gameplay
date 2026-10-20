import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCombatActionContext, createModuleRegistry, registerModule, configureModules,
  composeModules, resolveModuleDependencies, createEntity, createProgressionState,
  createEntityResourceState, createEntityLifeState, createEntityCollection, listEntities,
} from '@rpg/gameplay';

const request = () => ({actionId: 'attack-001', actionType: 'basic_attack',
  sourceEntityId: 'player-1', target: {kind: 'entity', entityId: 'monster-1'}});
const oracle = {actionId: 'attack-001', actionType: 'basic_attack',
  sourceEntityId: 'player-1', target: {kind: 'entity', entityId: 'monster-1'}};

test('CB02/CB03: exact independent immutable intent, actor neutrality and duplicate IDs', () => {
  const input = request();
  const context = createCombatActionContext(input);
  assert.deepEqual(context, oracle);
  assert.notEqual(context, input); assert.notEqual(context.target, input.target);
  assert.ok(Object.isFrozen(context)); assert.ok(Object.isFrozen(context.target));
  assert.equal(Object.isFrozen(input), false); assert.equal(Object.isFrozen(input.target), false);
  assert.deepEqual(Reflect.ownKeys(context), ['actionId', 'actionType', 'sourceEntityId', 'target']);
  assert.deepEqual(Reflect.ownKeys(context.target), ['kind', 'entityId']);
  for (const key of ['actionId', 'actionType', 'sourceEntityId', 'target', 'damage']) {
    assert.equal(Reflect.set(context, key, 'changed'), false);
  }
  assert.equal(Reflect.set(context.target, 'entityId', 'changed'), false);
  assert.equal(Reflect.set(context.target, 'kind', 'ground'), false);
  assert.throws(() => Object.defineProperty(context.target, 'entityId', {value: 'changed'}), TypeError);
  input.actionId = 'changed'; input.actionType = 'changed'; input.sourceEntityId = 'changed';
  input.target.kind = 'ground'; input.target.entityId = 'changed'; input.target = null;
  assert.deepEqual(context, oracle);
  const duplicate = createCombatActionContext(request());
  assert.deepEqual(duplicate, oracle); assert.notEqual(duplicate, context);
  assert.notEqual(duplicate.target, context.target);
  assert.deepEqual(createCombatActionContext({actionId: 'attack-002', actionType: 'basic_attack',
    sourceEntityId: 'monster-1', target: {kind: 'entity', entityId: 'player-1'}}),
  {actionId: 'attack-002', actionType: 'basic_attack', sourceEntityId: 'monster-1',
    target: {kind: 'entity', entityId: 'player-1'}});
  assert.deepEqual(createCombatActionContext({...request(), target: {kind: 'entity', entityId: 'player-1'}}),
    {actionId: 'attack-001', actionType: 'basic_attack', sourceEntityId: 'player-1',
      target: {kind: 'entity', entityId: 'player-1'}});
  assert.deepEqual(createCombatActionContext({actionId: ' Exact / action ', actionType: ' CUSTOM Intent ',
    sourceEntityId: ' unknown-source ', target: {kind: 'entity', entityId: ' unknown-target '}}),
  {actionId: ' Exact / action ', actionType: ' CUSTOM Intent ', sourceEntityId: ' unknown-source ',
    target: {kind: 'entity', entityId: ' unknown-target '}});
  const nullRecord = Object.assign(Object.create(null), request());
  nullRecord.target = Object.assign(Object.create(null), {kind: 'entity', entityId: 'monster-1'});
  assert.deepEqual(createCombatActionContext(nullRecord), oracle);
});

test('CB04: closed own-data input rejects malformed shapes and primitives without getters', () => {
  let reads = 0;
  const getter = (record, key) => Object.defineProperty(record, key, {
    get() {reads++; throw Error('Getter invoked');}, enumerable: true, configurable: true});
  for (const key of ['actionId', 'actionType', 'sourceEntityId', 'target']) {
    const missing = request(); delete missing[key];
    assert.throws(() => createCombatActionContext(missing), TypeError);
    assert.throws(() => createCombatActionContext(getter(request(), key)), TypeError);
    const inherited = Object.assign(Object.create({[key]: request()[key]}), missing);
    assert.throws(() => createCombatActionContext(inherited), TypeError);
  }
  for (const key of ['kind', 'entityId']) {
    const missing = {...request().target}; delete missing[key];
    for (const target of [missing, getter({...request().target}, key),
      Object.assign(Object.create({[key]: request().target[key]}), missing)]) {
      assert.throws(() => createCombatActionContext({...request(), target}), TypeError);
    }
  }
  const invalidStrings = ['', ' \t\n ', 1, NaN, Infinity, null, undefined, true, 1n,
    Symbol('id'), {}, [], () => 'id', new String('boxed')];
  for (const value of invalidStrings) {
    for (const key of ['actionId', 'actionType', 'sourceEntityId']) {
      assert.throws(() => createCombatActionContext({...request(), [key]: value}), TypeError);
    }
    assert.throws(() => createCombatActionContext({...request(), target: {kind: 'entity', entityId: value}}), TypeError);
  }
  for (const kind of ['Entity', ' entity ', 'ground', 'area', '', null, 1, {}, Symbol('entity')]) {
    assert.throws(() => createCombatActionContext({...request(), target: {kind, entityId: 'monster-1'}}), TypeError);
  }
  for (const malformed of [null, undefined, [], 'request', 0, true, () => {}, {},
    {...request(), extra: 1}, {...request(), [Symbol('extra')]: 1},
    Object.defineProperty(request(), 'hidden', {value: 1}), Object.create(request()),
    getter({...request()}, 'extra')]) {
    assert.throws(() => createCombatActionContext(malformed), TypeError);
  }
  for (const target of [null, undefined, [], 'target', 0, true, () => {}, {},
    {...request().target, extra: 1}, {...request().target, [Symbol('extra')]: 1},
    Object.defineProperty({...request().target}, 'hidden', {value: 1}),
    Object.create(request().target), getter({...request().target}, 'extra')]) {
    assert.throws(() => createCombatActionContext({...request(), target}), TypeError);
  }
  assert.equal(reads, 0);
  assert.deepEqual(createCombatActionContext(request()), oracle);
  console.log('COMBAT_VALIDATION_PASS closed_root/target; TypeError; getter_calls=0');
});

test('CB01: optional explicit composition, Entity dependency, independent Progression selection', () => {
  let registry = createModuleRegistry();
  for (const definition of [
    {id: 'combat', optional: true, dependencies: ['entity']},
    {id: 'progression', optional: true, dependencies: ['entity']},
    {id: 'entity', optional: true, dependencies: []},
  ]) registry = registerModule(registry, definition);
  assert.deepEqual(composeModules(registry, configureModules(registry)).moduleIds, []);
  const combatOnly = configureModules(registry, {enable: ['combat']});
  assert.deepEqual(combatOnly.enabledModuleIds, ['combat']);
  assert.throws(() => resolveModuleDependencies(registry, combatOnly), /requires dependency 'entity' to be enabled/);
  assert.throws(() => composeModules(registry, combatOnly), /requires dependency 'entity' to be enabled/);
  assert.deepEqual(combatOnly.enabledModuleIds, ['combat']);
  const selected = configureModules(registry, {enable: ['combat', 'entity']});
  assert.deepEqual(resolveModuleDependencies(registry, selected), ['entity', 'combat']);
  assert.deepEqual(composeModules(registry, selected).moduleIds, ['entity', 'combat']);
  assert.deepEqual(composeModules(registry, configureModules(registry, {enable: ['entity']})).moduleIds, ['entity']);
  assert.deepEqual(composeModules(registry, configureModules(registry,
    {enable: ['progression', 'entity']})).moduleIds, ['entity', 'progression']);
  assert.deepEqual(composeModules(registry, configureModules(registry,
    {enable: ['entity', 'progression', 'combat']})).moduleIds, ['entity', 'combat', 'progression']);
});

test('CB03/CB05: two literal-oracle sessions and mode-neutral callers, no time/RNG or domain changes', () => {
  const actor = createEntity({id: 'player-1', kind: 'player'});
  const progression = createProgressionState(actor, {level: 10, experience: 1500});
  const resources = createEntityResourceState(actor, {health: {minimum: 0, maximum: 100, current: 80},
    mana: {minimum: 0, maximum: 50, current: 30}});
  const life = createEntityLifeState(actor, {status: 'alive'});
  const collection = createEntityCollection();
  const now = Date.now, random = Math.random;
  Date.now = Math.random = () => {throw Error('Implicit time/RNG');};
  let first, second;
  try {
    first = createCombatActionContext(request()); second = createCombatActionContext(request());
    for (const mode of ['Text RPG', 'Realtime RPG', 'Turn-Based RPG']) {
      assert.deepEqual(createCombatActionContext(request()), oracle, mode);
    }
  } finally {Date.now = now; Math.random = random;}
  assert.deepEqual(first, oracle); assert.deepEqual(second, oracle); assert.deepEqual(first, second);
  assert.notEqual(first, second); assert.notEqual(first.target, second.target);
  assert.deepEqual(actor, {id: 'player-1', kind: 'player'});
  assert.deepEqual(progression, {entityId: 'player-1', level: 10, experience: 1500});
  assert.deepEqual(resources, {entityId: 'player-1', current: {health: 80, mana: 30}});
  assert.deepEqual(life, {entityId: 'player-1', status: 'alive'});
  assert.deepEqual(listEntities(collection), []);
  console.log('COMBAT_CONTEXT_PASS sessions=2 literal_oracle; attack-001/basic_attack/player-1/entity:monster-1; modes=3; execution=NOT_IMPLEMENTED');
});
