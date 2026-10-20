import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createSkillDefinition, createSkillInstance, createEntity,
  createModuleRegistry, registerModule, configureModules, composeModules} from '@rpg/gameplay';

test('SK02–SK04: exact identities, multiple actors/instances, detached immutable deterministic data', () => {
  const definitionInput = {skillId: 'fireball'};
  const entityInput = {id: 'player-1', kind: 'player'};
  const initial = {instanceId: 'skill-instance-001'};
  const definition = createSkillDefinition(definitionInput);
  const player = createEntity(entityInput);
  const monster = createEntity({id: 'monster-1', kind: 'monster'});
  const a = createSkillInstance(definition, player, initial);
  const b = createSkillInstance(definition, monster, {instanceId: 'skill-instance-002'});
  const c = createSkillInstance(definition, player, {instanceId: 'instance-b'});
  const expected = {instanceId: 'skill-instance-001', skillId: 'fireball', entityId: 'player-1'};
  assert.deepEqual(definition, {skillId: 'fireball'});
  assert.deepEqual([a, b, c], [expected,
    {instanceId: 'skill-instance-002', skillId: 'fireball', entityId: 'monster-1'},
    {instanceId: 'instance-b', skillId: 'fireball', entityId: 'player-1'}]);
  assert.notEqual(definition, definitionInput);
  for (const snapshot of [definition, a, b, c]) {
    assert.ok(Object.isFrozen(snapshot));
    assert.equal(Object.getOwnPropertySymbols(snapshot).length, 0);
  }
  assert.deepEqual(Reflect.ownKeys(a).sort(), ['entityId', 'instanceId', 'skillId']);
  assert.throws(() => {definition.skillId = 'other';}, TypeError);
  assert.throws(() => {a.entityId = 'other';}, TypeError);
  for (const input of [definitionInput, entityInput, initial]) assert.equal(Object.isFrozen(input), false);
  definitionInput.skillId = 'changed'; entityInput.id = 'changed'; initial.instanceId = 'changed';
  assert.deepEqual(definition, {skillId: 'fireball'});
  assert.deepEqual(a, expected);

  const mutableDefinition = {skillId: ' heal '}, mutableEntity = {id: ' Actor / 1 ', kind: ' Custom Kind '};
  const mutableInitial = {instanceId: ' Instance / 1 '};
  const saved = structuredClone([mutableDefinition, mutableEntity, mutableInitial]);
  const snapshot = createSkillInstance(mutableDefinition, mutableEntity, mutableInitial);
  assert.deepEqual(snapshot, {instanceId: ' Instance / 1 ', skillId: ' heal ', entityId: ' Actor / 1 '});
  assert.deepEqual([mutableDefinition, mutableEntity, mutableInitial], saved);
  for (const input of [mutableDefinition, mutableEntity, mutableInitial]) assert.equal(Object.isFrozen(input), false);
  mutableDefinition.skillId = mutableEntity.id = mutableInitial.instanceId = 'mutated';
  assert.deepEqual(snapshot, {instanceId: ' Instance / 1 ', skillId: ' heal ', entityId: ' Actor / 1 '});
  assert.notDeepEqual(createSkillDefinition({skillId: 'Fireball'}), definition);
  assert.deepEqual(createSkillDefinition(Object.assign(Object.create(null), {skillId: '__proto__'})), {skillId: '__proto__'});

  const now = Date.now, random = Math.random;
  try {
    Date.now = Math.random = () => {throw Error('Implicit time/RNG access');};
    const repeated = createSkillInstance(createSkillDefinition({skillId: 'fireball'}),
      createEntity({id: 'player-1', kind: 'player'}), {instanceId: 'skill-instance-001'});
    assert.deepEqual(repeated, expected); assert.notEqual(repeated, a);
    assert.notEqual(createSkillDefinition({skillId: 'fireball'}), definition);
  } finally {Date.now = now; Math.random = random;}
  // Duplicate IDs are structurally valid; there is no global registry or authorization claim.
  console.log('SKILL_FOUNDATION_IDENTITY_PASS fireball/player-1/skill-instance-001; monster-1/skill-instance-002; exact/detached/frozen/repeated');
});

test('SK02–SK04: closed own-data validation, canonical Entity rejection, getters never invoked', () => {
  const definition = {skillId: 'fireball'}, entity = {id: 'player-1', kind: 'player'}, initial = {instanceId: 'instance-a'};
  const originals = structuredClone([definition, entity, initial]);
  let getters = 0;
  function invalidRecords(key) {
    return [undefined, null, [], 'text', 1, true, {},
      ...['', ' \t\n ', 100, null, undefined, {}, Symbol('id')].map(value => ({[key]: value})),
      {[key]: 'valid', extra: true}, {[key]: 'valid', [Symbol('extra')]: true},
      Object.create({[key]: 'inherited'}),
      Object.defineProperty({}, key, {get() {getters++; throw Error('getter');}}),
      Object.defineProperty({[key]: 'valid'}, 'extra', {get() {getters++; throw Error('extra getter');}}),
      Object.defineProperty({[key]: 'valid'}, 'hidden', {value: 1}),
    ];
  }
  for (const input of invalidRecords('skillId')) {
    assert.throws(() => createSkillDefinition(input), TypeError);
    assert.throws(() => createSkillInstance(input, entity, initial), TypeError);
  }
  for (const input of invalidRecords('instanceId')) {
    assert.throws(() => createSkillInstance(definition, entity, input), TypeError);
  }
  for (const input of [undefined, null, [], {}, {id: 'player-1'}, {id: ' ', kind: 'player'},
    {id: 'player-1', kind: 1}, {id: 'player-1', kind: ' '}, {...entity, rank: 1},
    {...entity, [Symbol('extra')]: true}, Object.create(entity),
    Object.defineProperty({kind: 'player'}, 'id', {get() {getters++; throw Error('id getter');}}),
    Object.defineProperty({id: 'player-1'}, 'kind', {get() {getters++; throw Error('kind getter');}})]) {
    assert.throws(() => createSkillInstance(definition, input, initial), TypeError);
  }
  assert.equal(getters, 0);
  assert.deepEqual([definition, entity, initial], originals);
  for (const input of [definition, entity, initial]) assert.equal(Object.isFrozen(input), false);
  assert.deepEqual(createSkillInstance(definition, entity, initial),
    {instanceId: 'instance-a', skillId: 'fireball', entityId: 'player-1'});
  console.log('SKILL_FOUNDATION_VALIDATION_PASS TypeError; getters0; no_partial_mutation');
});

test('SK01/SK05: actual registry, explicit dependencies, independent Progression/Combat selection', () => {
  // Copied actual architecture data, not an alternative dependency declaration.
  const {modules} = JSON.parse(readFileSync(new URL('./skill-modules.json', import.meta.url), 'utf8'));
  const registry = modules.reduce(registerModule, createModuleRegistry());
  assert.deepEqual(composeModules(registry, configureModules(registry)).moduleIds, []);
  const missingEntity = configureModules(registry, {enable: ['skill']});
  assert.deepEqual(missingEntity.enabledModuleIds, ['skill']);
  assert.throws(() => composeModules(registry, missingEntity), error => error instanceof TypeError && /entity/.test(error.message));
  const selection = configureModules(registry, {enable: ['skill', 'entity'], disable: ['progression', 'combat']});
  assert.deepEqual(composeModules(registry, selection).moduleIds, ['entity', 'skill']);
  assert.deepEqual(composeModules(registry, configureModules(registry,
    {enable: ['skill', 'progression', 'entity']})).moduleIds, ['entity', 'progression', 'skill']);
  assert.deepEqual(composeModules(registry, configureModules(registry,
    {enable: ['skill', 'combat', 'entity']})).moduleIds, ['entity', 'combat', 'skill']);
  const definition = createSkillDefinition({skillId: 'not-learned-or-registered'});
  const instance = createSkillInstance(definition, createEntity({id: 'outsider', kind: 'caller-kind'}), {instanceId: 'explicit'});
  assert.deepEqual(instance, {instanceId: 'explicit', skillId: 'not-learned-or-registered', entityId: 'outsider'});
  assert.deepEqual(composeModules(registry, selection).moduleIds, ['entity', 'skill']);
  console.log('SKILL_FOUNDATION_COMPOSITION_PASS entity+skill; missing_entity_rejected; no_auto_enable; independent_siblings');
});
