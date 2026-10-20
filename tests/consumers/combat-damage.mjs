import assert from 'node:assert/strict';
import test from 'node:test';
import {createEntity, createEntityCollection, addEntity, createEntityResourceState,
  createEntityLifeState, createCombatActionContext, evaluateCombatActionAdmission,
  evaluateCombatTargetValidation, resolveCombatAttack, applyCombatAttackDamage,
  createExecutionContext, transitionEntityResource, resolveEntityDefeat} from '@rpg/gameplay';

const contextInput = reverse => ({actionId: 'attack-001', actionType: 'basic_attack',
  sourceEntityId: reverse ? 'monster-1' : 'player-1',
  target: {kind: 'entity', entityId: reverse ? 'player-1' : 'monster-1'}});
const policy = (resourceId = 'health', currentAboveMaximum = 'reject') =>
  ({resourceId, minimum: 0, maximum: 100, currentAboveMaximum});
function session({damage = 30, current = 100, status = 'alive', resourceId = 'health', reverse = false,
  dodge = false, mitigatedCritical = false} = {}) {
  const source = createEntity({id: contextInput(reverse).sourceEntityId, kind: reverse ? 'monster' : 'player'});
  const target = createEntity({id: contextInput(reverse).target.entityId, kind: reverse ? 'player' : 'monster'});
  const entities = addEntity(addEntity(createEntityCollection(), source), target);
  const life = createEntityLifeState(target, {status});
  // Creation bounds deliberately exceed the application maximum for above-max evidence.
  const resources = createEntityResourceState(target, {[resourceId]: {minimum: 0, maximum: 200, current},
    mana: {minimum: 0, maximum: 50}, stamina: {minimum: 0, maximum: 30}});
  const context = createCombatActionContext(contextInput(reverse));
  const admission = evaluateCombatActionAdmission(context, entities, createEntityLifeState(source, {status: 'alive'}), {eligible: true});
  const targetResult = evaluateCombatTargetValidation(admission, entities, life,
    {relation: 'enemy', allowedRelations: ['enemy'], allowedLifeStatuses: ['alive', 'dead']});
  const draws = [];
  const execution = createExecutionContext({clock: {now() {throw Error('Unexpected clock');}},
    random: {next() {draws.push(0.2); return 0.2;}}});
  const numerical = {hit: {dodgeChance: dodge ? 0.5 : 0, eligible: true, rule: {enabled: true, bounds: {min: 0, max: 1}}},
    critical: {chance: 0.5, bonus: 0.5, eligible: true, rule: {enabled: mitigatedCritical, bounds: {min: 0, max: 1}}},
    damage: {base: damage, rank: 1, perRank: 0, scaling: [], flat: {definition: 0, additional: 0, resolved: 0}, bonuses: []},
    mitigation: {ruleKey: 'armor', rating: 100, rule: {enabled: mitigatedCritical, bounds: {min: 0, max: 1},
      levelScalingEnabled: false, ...(mitigatedCritical ? {baseK: 100, levelPenalty: 0} : {})}}};
  const attack = resolveCombatAttack(admission, targetResult, numerical, execution);
  return {attack, resources, life, policy: policy(resourceId), draws, entities};
}
const apply = s => applyCombatAttackDamage(s.attack, s.resources, s.life, s.policy);
const transition = (before, after, applied, reachedMinimum = false, resource = 'health') =>
  ({resource, before, after, applied, reachedMinimum});
const lifeResult = (before, after, outcome, entityId = 'monster-1') =>
  ({entityId, before, after, outcome, state: {entityId, status: after}});
function frozenTree(value) {
  if (value !== null && typeof value === 'object') {
    assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozenTree);
  }
}

test('CB21–CB24: normal/custom-resource damage preserves exact canonical results and other resources', () => {
  const s = session(), result = apply(s);
  assert.deepEqual(result, {context: contextInput(false), outcome: 'processed', calculatedDamage: 30, appliedDamage: 30,
    resourceResult: {state: {entityId: 'monster-1', current: {health: 70, mana: 50, stamina: 30}},
      transition: transition(100, 70, 30)}, lifeResult: lifeResult('alive', 'alive', 'unchanged')});
  // Literal oracle above is independent; canonical comparisons supplement it.
  const canonical = transitionEntityResource(s.resources, 'health', {maximum: 100, amount: 30, operation: 'decrease',
    rule: {minimum: 0, currentAboveMaximum: 'reject', allowIncreaseFromMinimum: false}});
  assert.deepEqual(result.resourceResult, canonical);
  assert.deepEqual(result.lifeResult, resolveEntityDefeat(s.life, canonical.state, {resourceId: 'health', minimum: 0, maximum: 100}));
  const custom = apply(session({resourceId: 'vitality', current: 80}));
  assert.deepEqual(custom.resourceResult.state.current, {vitality: 50, mana: 50, stamina: 30});
  assert.deepEqual(custom.resourceResult.transition, transition(80, 50, 30, false, 'vitality'));
  const other = apply(session({damage: 25}));
  assert.deepEqual(other.resourceResult.state.current, {health: 75, mana: 50, stamina: 30});
  const bounded = session({current: 40}); bounded.policy.minimum = 10; bounded.policy.maximum = 90;
  const atCallerMinimum = apply(bounded);
  assert.deepEqual(atCallerMinimum.resourceResult.transition, transition(40, 10, 30, true));
  assert.equal(atCallerMinimum.lifeResult.outcome, 'defeated');
  assert.deepEqual(apply(session({current: 10, damage: 0.25})).resourceResult.transition, transition(10, 9.75, 0.25));
  console.log('COMBAT_DAMAGE_NORMAL_PASS 100->70/applied30; vitality80->50; mana50/stamina30_unchanged');
});

test('CB23–CB24: lethal, overkill, dead targets and positive attempts already at minimum', () => {
  for (const [current, damage, status, expectedApplied, outcome] of [
    [100, 150, 'alive', 100, 'defeated'], [10, 25, 'alive', 10, 'defeated'],
    [0, 20, 'dead', 0, 'unchanged'], [0, 20, 'alive', 0, 'defeated'],
    [10, 25, 'dead', 10, 'unchanged'],
  ]) {
    const result = apply(session({current, damage, status}));
    assert.equal(result.outcome, 'processed'); assert.equal(result.calculatedDamage, damage);
    assert.equal(result.appliedDamage, expectedApplied);
    assert.deepEqual(result.resourceResult.transition, transition(current, 0, expectedApplied, current > 0));
    assert.deepEqual(result.lifeResult, lifeResult(status, 'dead', outcome));
    const repeated = applyCombatAttackDamage(session({damage}).attack, result.resourceResult.state, result.lifeResult.state, policy());
    assert.equal(repeated.lifeResult.outcome, 'unchanged'); assert.equal(repeated.appliedDamage, 0);
  }
  // An accepted dead target above minimum stays dead after nonlethal damage, never revived.
  assert.deepEqual(apply(session({status: 'dead'})).lifeResult, lifeResult('dead', 'dead', 'unchanged'));
  console.log('COMBAT_DAMAGE_DEFEAT_PASS overkill150/applied100; partial25/applied10; minimum_alive_defeated/applied0; dead_unchanged');
});

test('CB22–CB23: above-maximum authoritative applied differs from resource delta; reject stays canonical', () => {
  const s = session({current: 140, damage: 20}); s.policy.currentAboveMaximum = 'allow';
  const result = apply(s);
  assert.deepEqual(result.resourceResult.transition, transition(140, 100, 20));
  assert.equal(result.calculatedDamage, 20); assert.equal(result.appliedDamage, 20);
  assert.equal(result.resourceResult.transition.before - result.resourceResult.transition.after, 40);
  assert.equal(result.lifeResult.outcome, 'unchanged');
  const original = JSON.stringify(s);
  s.policy.currentAboveMaximum = 'reject';
  assert.throws(() => apply(s), /Current resource exceeds maximum/);
  s.policy.currentAboveMaximum = 'allow'; assert.equal(JSON.stringify(s), original);
  console.log('COMBAT_DAMAGE_ABOVEMAX_PASS 140->100; calculated20/applied20/delta40; reject_no_partial');
});

test('CB22/CB25: dodge/zero no-op never normalize above-max or evaluate defeat at minimum', () => {
  for (const dodge of [true, false]) for (const current of [140, 0]) {
    const s = session({dodge, damage: dodge ? 30 : 0, current, status: 'alive'});
    const before = JSON.stringify(s), count = s.draws.length;
    const result = apply(s);
    assert.deepEqual(result, {context: contextInput(false), outcome: dodge ? 'dodged' : 'zero_damage',
      calculatedDamage: 0, appliedDamage: 0, resourceResult: null, lifeResult: null});
    assert.equal(JSON.stringify(s), before); assert.equal(s.draws.length, count);
    assert.equal(s.resources.current.health, current); assert.equal(s.life.status, 'alive'); frozenTree(result);
  }
  console.log('COMBAT_DAMAGE_NOOP_PASS dodge/zero=null_transitions; HP140_not_normalized; HP0_alive_not_defeated');
});

test('CB21/CB25: malformed receipts reject closed schemas, nested data and inconsistent stage links without getters', () => {
  let getters = 0;
  const accessor = (record, key) => Object.defineProperty(record, key, {get() {getters++; throw Error('Getter');}, configurable: true});
  const changes = [
    ...[-1, NaN, Infinity, '30'].map(n => a => {a.finalDamage = n;}),
    a => {a.outcome = 'processed';}, a => {a.extra = true;}, a => {delete a.b0;},
    a => {a.context.target.entityId = '';}, a => {a.context = Object.create(a.context);},
    a => {a.hit = accessor(a.hit, 'hit');}, a => {a.hit.hit = false;}, a => {a.hit.onHitSuccess = false;},
    a => {a.hit.eligible = 1;}, a => {a.hit.roll = 1;}, a => {a.hit.chance = Infinity;},
    a => {a.critical.bonus = NaN;}, a => {a.critical.isCritical = true;},
    a => {a.critical = accessor(a.critical, 'roll');}, a => {a.b0.scaling = new Array(1);},
    a => {a.b0.scaling = [{source: 'x', value: NaN}];},
    a => {a.b0.scaling = [{source: 'x', value: 1}, {source: 'x', value: 1}];},
    a => {a.b0.raw = Infinity;}, a => {a.b0.extra = 1;},
    a => {a.b1.criticalBonus = 1;}, a => {a.b1.beforeDefense = 99;},
    a => {a.mitigation.finalDamage = 99;}, a => {a.mitigation.status = 'missing_config';},
    a => {a.mitigation.missing = ['unknown'];}, a => {a.mitigation.missing = accessor(['baseK'], '0');},
    a => {a.mitigation.levelGap = -1;}, a => {a.mitigation.effectiveK = 0;},
    a => {a.mitigation.reduction = NaN;}, a => {a.mitigation.levelScalingEnabled = 'false';},
    a => {a.mitigation = accessor(a.mitigation, 'finalDamage');},
    a => {accessor(a, 'finalDamage');}, a => {a[Symbol()] = true;},
  ];
  const s = session(); const before = JSON.stringify(s);
  for (const change of changes) {
    const invalid = structuredClone(s.attack); change(invalid);
    assert.throws(() => applyCombatAttackDamage(invalid, s.resources, s.life, s.policy), TypeError);
  }
  for (const invalid of [undefined, null, 30, {}, Object.create(s.attack)]) {
    assert.throws(() => applyCombatAttackDamage(invalid, s.resources, s.life, s.policy), TypeError);
  }
  const miss = session({dodge: true});
  for (const change of [a => {a.finalDamage = 1;}, a => {a.b0 = {};}, a => {a.hit.dodged = false;}]) {
    const invalid = structuredClone(miss.attack); change(invalid);
    assert.throws(() => applyCombatAttackDamage(invalid, miss.resources, miss.life, miss.policy), TypeError);
  }
  assert.equal(getters, 0); assert.equal(JSON.stringify(s), before);
});

test('CB21/CB25: identity, full Resource/Life and explicit policy validation also precede no-op', () => {
  let getters = 0;
  const access = (record, key) => Object.defineProperty(record, key, {get() {getters++; throw Error('Getter');}, configurable: true});
  for (const options of [{}, {dodge: true}, {damage: 0}]) {
    const s = session(options), before = JSON.stringify(s);
    const invalidStates = [
      [{...s.resources, entityId: 'player-1'}, s.life],
      [s.resources, {...s.life, entityId: 'other-monster'}],
      [{...s.resources, current: {...s.resources.current, mana: NaN}}, s.life],
      [{...s.resources, current: {health: -1}}, s.life],
      [{...s.resources, extra: true}, s.life], [Object.create(s.resources), s.life],
      [access({...s.resources}, 'current'), s.life],
      [{...s.resources, current: access({...s.resources.current}, 'health')}, s.life],
      [s.resources, {...s.life, status: 'living'}], [s.resources, {...s.life, extra: true}],
      [s.resources, access({...s.life}, 'status')], [s.resources, Object.create(s.life)],
      [s.resources, Object.assign(Object.create({custom: true}), s.life)],
    ];
    for (const [resources, life] of invalidStates) {
      assert.throws(() => applyCombatAttackDamage(s.attack, resources, life, s.policy), TypeError);
    }
    const invalidPolicies = [undefined, {}, {minimum: 0, maximum: 100, currentAboveMaximum: 'reject'},
      {...s.policy, resourceId: 'missing'}, {...s.policy, resourceId: ''}, {...s.policy, minimum: NaN},
      {...s.policy, maximum: Infinity}, {...s.policy, minimum: 101}, {...s.policy, currentAboveMaximum: 'clamp'},
      {...s.policy, extra: true}, Object.create(s.policy), access({...s.policy}, 'minimum')];
    for (const invalid of invalidPolicies) assert.throws(() => applyCombatAttackDamage(s.attack, s.resources, s.life, invalid), TypeError);
    assert.equal(JSON.stringify(s), before);
  }
  assert.equal(getters, 0);
  console.log('COMBAT_DAMAGE_VALIDATION_PASS identity/policy/receipt/whole_state; before_noop; getters0; no_partial');
});

test('CB25: immutable detached combined result without freezing caller data', () => {
  const original = session(), attack = structuredClone(original.attack), resources = structuredClone(original.resources),
    life = {...original.life}, config = {...original.policy};
  const before = JSON.stringify({attack, resources, life, config});
  const result = applyCombatAttackDamage(attack, resources, life, config);
  frozenTree(result); assert.equal(JSON.stringify({attack, resources, life, config}), before);
  for (const value of [attack, attack.context, attack.context.target, resources, resources.current, life, config]) assert.equal(Object.isFrozen(value), false);
  assert.notEqual(result.context, attack.context); assert.notEqual(result.resourceResult.state, resources);
  assert.notEqual(result.resourceResult.state.current, resources.current); assert.notEqual(result.lifeResult.state, life);
  attack.context.target.entityId = 'changed'; resources.current.health = 999; life.status = 'dead'; config.minimum = 70;
  assert.equal(result.context.target.entityId, 'monster-1'); assert.equal(result.resourceResult.state.current.health, 70);
  assert.equal(result.lifeResult.state.status, 'alive');
  for (const mutate of [() => {result.appliedDamage = 1;}, () => {result.resourceResult.state.current.health = 1;},
    () => {result.resourceResult.transition.applied = 1;}, () => {result.lifeResult.state.status = 'dead';},
    () => {result.context.target.entityId = 'other';}]) assert.throws(mutate, TypeError);
});

test('CB25: two independent actual end-to-end sessions match literal oracle and reverse actor parity', () => {
  const expected = {context: contextInput(false), outcome: 'processed', calculatedDamage: 75, appliedDamage: 60,
    resourceResult: {state: {entityId: 'monster-1', current: {health: 0, mana: 50, stamina: 30}},
      transition: transition(60, 0, 60, true)}, lifeResult: lifeResult('alive', 'dead', 'defeated')};
  const first = session({damage: 100, current: 60, mitigatedCritical: true});
  const second = session({damage: 100, current: 60, mitigatedCritical: true});
  const now = Date.now, random = Math.random;
  try {
    Date.now = Math.random = () => {throw Error('Hidden time/RNG');};
    const a = apply(first), b = apply(second);
    assert.deepEqual(a, expected); assert.deepEqual(b, expected); assert.notEqual(a, b);
    assert.deepEqual(first.draws, [0.2]); assert.deepEqual(second.draws, [0.2]);
    const reversed = apply(session({damage: 100, current: 60, mitigatedCritical: true, reverse: true}));
    assert.deepEqual(reversed, {...expected, context: contextInput(true),
      resourceResult: {...expected.resourceResult, state: {...expected.resourceResult.state, entityId: 'player-1'}},
      lifeResult: lifeResult('alive', 'dead', 'defeated', 'player-1')});
    // No ledger/exactly-once authority: a caller can branch the same receipt again.
    assert.deepEqual(apply(first), expected);
  } finally {Date.now = now; Math.random = random;}
  assert.equal(first.resources.current.health, 60); assert.equal(first.life.status, 'alive');
  console.log('COMBAT_DAMAGE_REPLAY_PASS sessions2; CB03->CB09->CB15->CB20->CB25; final75/applied60; alive->dead; parity');
});
