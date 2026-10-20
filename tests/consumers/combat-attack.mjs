import assert from 'node:assert/strict';
import test from 'node:test';
import {createEntity, createEntityCollection, addEntity, createEntityLifeState,
  createCombatActionContext, evaluateCombatActionAdmission, evaluateCombatTargetValidation,
  resolveCombatAttack, createExecutionContext, createEntityResourceState} from '@rpg/gameplay';
import {calculateHit, calculateCritical, calculateDamageB0, calculateDamageB1, calculateMitigation} from '@rpg/core/kernel';

const request = (reverse = false) => ({actionId: 'attack-001', actionType: 'basic_attack',
  sourceEntityId: reverse ? 'monster-1' : 'player-1',
  target: {kind: 'entity', entityId: reverse ? 'player-1' : 'monster-1'}});
function stages(reverse = false) {
  const player = createEntity({id: 'player-1', kind: 'player'});
  const monster = createEntity({id: 'monster-1', kind: 'monster'});
  const entities = addEntity(addEntity(createEntityCollection(), player), monster);
  const sourceLife = createEntityLifeState(reverse ? monster : player, {status: 'alive'});
  const targetLife = createEntityLifeState(reverse ? player : monster, {status: 'alive'});
  const context = createCombatActionContext(request(reverse));
  const admission = evaluateCombatActionAdmission(context, entities, sourceLife, {eligible: true});
  const target = evaluateCombatTargetValidation(admission, entities, targetLife,
    {relation: 'enemy', allowedRelations: ['enemy'], allowedLifeStatuses: ['alive']});
  return {admission, target, entities, sourceLife, targetLife};
}
const rule = (enabled = true) => ({enabled, bounds: {min: 0, max: 1}});
function numerical() {
  return {hit: {dodgeChance: 0, eligible: true, rule: rule()},
    critical: {chance: 0.5, bonus: 0.5, eligible: true, rule: rule()},
    damage: {base: 100, rank: 1, perRank: 0, scaling: [],
      flat: {definition: 0, additional: 0, resolved: 0}, bonuses: []},
    mitigation: {ruleKey: 'armor', rating: 100,
      rule: {enabled: true, bounds: {min: 0, max: 1}, baseK: 100, levelPenalty: 0, levelScalingEnabled: false}}};
}
function randomStream(samples) {
  const trace = [];
  const execution = createExecutionContext({clock: {now() {throw Error('Hidden clock');}},
    random: {next() {const sample = samples[trace.length]; trace.push(sample); return sample;}}});
  return {execution, trace};
}
function run(input = numerical(), samples = [0.2], previous = stages()) {
  const rng = randomStream(samples);
  const result = resolveCombatAttack(previous.admission, previous.target, input, rng.execution);
  return {result, trace: rng.trace};
}
function disabledDefense(input) {
  input.mitigation.rule = {enabled: false, bounds: {}, levelScalingEnabled: false};
  return input;
}
const bonus = (id, value) => ({id, source: 'caller', eligible: true, reason: 'resolved', value,
  contributions: [{id: 'term', value}]});
const oracle = {context: request(), outcome: 'landed',
  hit: {hit: true, dodged: false, onHitSuccess: true, eligible: true, enabled: true, chance: 0, roll: null},
  critical: {chance: 0.5, roll: 0.2, isCritical: true, bonus: 0.5, multiplier: 1.5},
  b0: {base: 100, scaling: [], flat: 0, raw: 100},
  b1: {criticalBonus: 0.5, totalBonus: 0.5, beforeDefense: 150},
  mitigation: {ruleKey: 'armor', status: 'applied', missing: [], levelGap: null, levelScalingEnabled: false,
    effectiveK: 100, rawReduction: 0.5, reduction: 0.5, inputDamage: 150, preventedDamage: 75, finalDamage: 75},
  finalDamage: 75};

test('CB16–CB19: literal full landed oracle and real public Kernel diagnostics', () => {
  const {result, trace} = run();
  assert.deepEqual(result, oracle);
  assert.deepEqual(trace, [0.2]);
  // Independent literal above is authoritative; direct Kernel comparisons supplement it.
  assert.deepEqual(result.hit, calculateHit({...numerical().hit, roll: () => {throw Error('Unexpected draw');}}));
  assert.deepEqual(result.critical, calculateCritical({...numerical().critical, roll: 0.2}));
  assert.deepEqual(result.b0, calculateDamageB0({base: 100, rank: 1, perRank: 0, sourceOrder: [],
    sourceValue: () => {throw Error('No scaling');}, coefficient: () => {throw Error('No coefficient');},
    resolveFlat: () => ({definition: 0, additional: 0, resolved: 0})}));
  assert.deepEqual(result.b1, calculateDamageB1(100, [], 0.5));
  assert.deepEqual(result.mitigation, calculateMitigation({...numerical().mitigation, damage: 150}));
  const normal = disabledDefense(numerical()); normal.critical.rule.enabled = false;
  const plain = run(normal, []);
  assert.equal(plain.result.finalDamage, 100);
  assert.equal(plain.result.mitigation.status, 'disabled');
  assert.deepEqual(plain.result.mitigation.missing, ['baseK', 'levelPenalty']);
  assert.deepEqual(plain.trace, []);
  const critical = run(disabledDefense(numerical()));
  assert.equal(critical.result.finalDamage, 150); // Never 225: additive Crit used once.
  const level = numerical(); level.mitigation.sourceLevel = 12; level.mitigation.targetLevel = 10;
  level.mitigation.rule.levelScalingEnabled = true; level.mitigation.rule.levelPenalty = 0.5;
  level.mitigation.rating = 200;
  const leveled = run(level).result;
  assert.deepEqual(leveled.mitigation, {ruleKey: 'armor', status: 'applied', missing: [], levelGap: 2,
    levelScalingEnabled: true, effectiveK: 200, rawReduction: 0.5, reduction: 0.5,
    inputDamage: 150, preventedDamage: 75, finalDamage: 75});
  console.log('COMBAT_ATTACK_ORACLE_PASS hit; critical0.5; B0=100 B1=150 mitigation0.5 final75; no_double_crit');
});

test('CB19: ordered scaling, rank, flat and already-effective bonuses use Kernel', () => {
  const input = disabledDefense(numerical()); input.critical.rule.enabled = false;
  input.damage.base = 50; input.damage.scaling = [{source: 'strength', value: 20, coefficient: 2}];
  assert.deepEqual(run(input, []).result.b0, {base: 50, scaling: [{source: 'strength', value: 40}], flat: 0, raw: 90});
  input.damage = {...input.damage, base: 100, rank: 3, perRank: 0.1, scaling: []};
  assert.equal(run(input, []).result.b0.raw, 120);
  input.damage = {...input.damage, base: 50, rank: 1, perRank: 0,
    scaling: [{source: 'z-strength', value: 20, coefficient: 2}, {source: 'a-magic', value: 10, coefficient: 3}],
    flat: {definition: 2, additional: 3, resolved: 4}};
  assert.deepEqual(run(input, []).result.b0, {base: 50,
    scaling: [{source: 'z-strength', value: 40}, {source: 'a-magic', value: 30}], flat: 9, raw: 129});
  const bonuses = disabledDefense(numerical()); bonuses.damage.bonuses = [bonus('A', 0.2), bonus('B', 0.1)];
  const result = run(bonuses).result;
  assert.deepEqual(result.b1, {criticalBonus: 0.5, totalBonus: 0.8, beforeDefense: 180});
  assert.equal(result.finalDamage, 180);
  bonuses.damage.bonuses = [bonus('A', 0.2)];
  assert.deepEqual(run(bonuses).result.b1, {criticalBonus: 0.5, totalBonus: 0.7, beforeDefense: 170});
  bonuses.damage.bonuses = [{...bonus('already-effective', 0.2), eligible: false}];
  assert.equal(run(bonuses).result.b1.beforeDefense, 170); // B1 does not re-resolve eligibility.
});

test('CB17–CB18: lazy exact RNG matrix and dodge omits every unrun stage', () => {
  const dodged = numerical(); dodged.hit.dodgeChance = 0.5;
  // Structurally valid finite inputs would overflow if downstream arithmetic ran.
  dodged.damage.base = Number.MAX_VALUE; dodged.damage.rank = 3; dodged.damage.perRank = Number.MAX_VALUE;
  const miss = run(dodged, [0.2]);
  assert.deepEqual(miss, {trace: [0.2], result: {context: request(), outcome: 'dodged', finalDamage: 0,
    hit: {hit: false, dodged: true, onHitSuccess: false, eligible: true, enabled: true, chance: 0.5, roll: 0.2}}});
  for (const key of ['critical', 'b0', 'b1', 'mitigation']) assert.equal(Object.hasOwn(miss.result, key), false);
  const cases = [
    ['two-stage', p => {p.hit.dodgeChance = 0.2;}, [0.8, 0.2], 2, true],
    ['zero-dodge', () => {}, [0.2], 1, true],
    ['dodge-disabled', p => {p.hit.dodgeChance = 0.9; p.hit.rule.enabled = false;}, [0.2], 1, true],
    ['dodge-ineligible', p => {p.hit.dodgeChance = 0.9; p.hit.eligible = false;}, [0.2], 1, true],
    ['zero-critical', p => {p.critical.chance = 0;}, [0.2], 1, false],
    ['critical-disabled', p => {p.critical.rule.enabled = false;}, [], 0, false],
    ['critical-ineligible', p => {p.critical.eligible = false;}, [], 0, false],
  ];
  for (const [label, configure, samples, draws, isCritical] of cases) {
    const input = numerical(); configure(input);
    const {result, trace} = run(input, samples);
    assert.equal(result.outcome, 'landed', label); assert.equal(result.critical.isCritical, isCritical, label);
    assert.equal(trace.length, draws, label); assert.deepEqual(trace, samples, label);
  }
  const noRandom = disabledDefense(numerical()); noRandom.critical.eligible = false;
  const previous = stages();
  assert.equal(resolveCombatAttack(previous.admission, previous.target, noRandom,
    createExecutionContext({clock: {now() {throw Error('No clock');}}})).finalDamage, 100);
  console.log('COMBAT_ATTACK_RNG_PASS dodge1_crit0; landed1+1; zero_dodge0; zero_crit1; disabled/ineligible0');
});

test('CB16: rejected/malformed stages and all context mismatches fail before numerical work', () => {
  const previous = stages(); let touches = 0;
  const poison = new Proxy({}, {ownKeys() {touches++; throw Error('Numerical input touched');}});
  const rng = randomStream([0.2]);
  const rejected = evaluateCombatActionAdmission(previous.admission.context, previous.entities,
    {entityId: 'player-1', status: 'dead'}, {eligible: true});
  assert.throws(() => resolveCombatAttack(rejected, poison, poison, rng.execution), TypeError);
  const denied = evaluateCombatTargetValidation(previous.admission, previous.entities, previous.targetLife,
    {relation: 'enemy', allowedRelations: ['ally'], allowedLifeStatuses: ['alive']});
  assert.throws(() => resolveCombatAttack(previous.admission, denied, poison, rng.execution), TypeError);
  for (const field of ['actionId', 'actionType', 'sourceEntityId']) {
    const target = {...previous.target, context: {...request(), [field]: 'different'}};
    assert.throws(() => resolveCombatAttack(previous.admission, target, poison, rng.execution), TypeError);
  }
  for (const change of [{target: {kind: 'entity', entityId: 'other'}},
    {target: {kind: 'ground', entityId: 'monster-1'}}]) {
    assert.throws(() => resolveCombatAttack(previous.admission,
      {...previous.target, context: {...request(), ...change}}, poison, rng.execution), TypeError);
  }
  for (const change of [{targetEntityId: 'wrong'}, {relation: 'self'}, {relation: 'unknown'},
    {targetLifeStatus: 'living'}, {reason: 'relation_not_allowed'}, {extra: true}]) {
    assert.throws(() => resolveCombatAttack(previous.admission, {...previous.target, ...change}, poison, rng.execution), TypeError);
  }
  for (const change of [{status: 'accepted'}, {reason: 'source_dead'}, {extra: true}, {context: null}]) {
    assert.throws(() => resolveCombatAttack({...previous.admission, ...change}, previous.target, poison, rng.execution), TypeError);
  }
  assert.equal(touches, 0); assert.deepEqual(rng.trace, []);
  // Opaque/custom action types are permitted by explicit resolver invocation.
  const custom = stages(); const context = {...request(), actionType: 'caller_attack'};
  custom.admission = {...custom.admission, context}; custom.target = {...custom.target, context};
  assert.equal(run(numerical(), [0.2], custom).result.finalDamage, 75);
});

test('CB16/CB19: malformed numerical snapshots fail before any RNG, without getters', () => {
  let getters = 0;
  const accessor = (record, key) => Object.defineProperty(record, key,
    {get() {getters++; throw Error('Getter called');}, configurable: true});
  const changes = [
    p => {p.hit.dodgeChance = NaN;}, p => {p.critical.bonus = Infinity;},
    p => {p.damage.base = '100';}, p => {p.damage.perRank = NaN;},
    ...[0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1].map(rank => p => {p.damage.rank = rank;}),
    p => {p.hit.eligible = 1;}, p => {p.critical.rule.enabled = undefined;},
    p => {p.hit.rule.bounds = {min: 1, max: 0};}, p => {p.mitigation.rule.bounds = {max: Infinity};},
    p => {p.damage.scaling = [{source: '', value: 20, coefficient: 2}];},
    p => {p.damage.scaling = [{source: 'x', value: 1, coefficient: NaN}];},
    p => {p.damage.scaling = [{source: 'x', value: 1, coefficient: 2}, {source: 'x', value: 3, coefficient: 4}];},
    p => {p.damage.scaling = new Array(1);}, p => {p.damage.scaling = accessor([{}], '0');},
    p => {p.damage.bonuses = Object.assign([], {extra: true});},
    p => {p.damage.bonuses = [{...bonus('x', 0.2), contributions: [{id: '', value: 1}]}];},
    p => {p.damage.bonuses = [{...bonus('x', 0.2), value: NaN}];},
    p => {p.damage.flat = accessor(p.damage.flat, 'resolved');},
    p => {p.damage.flat.resolved = Infinity;}, p => {p.damage.flat = () => ({definition: 0, additional: 0, resolved: 0});},
    p => {delete p.mitigation.rule.baseK;}, p => {delete p.mitigation.rule.levelPenalty;},
    p => {p.mitigation.rule.baseK = 0;}, p => {p.mitigation.rule.levelPenalty = -1;},
    p => {p.mitigation.rule.levelScalingEnabled = true;}, p => {p.mitigation.rating = NaN;},
    p => {p.mitigation.ruleKey = '';}, p => {p.mitigation = Object.create(p.mitigation);},
    p => {p.mitigation.sourceLevel = undefined;},
    p => {p.mitigation = Object.assign(Object.create({sourceLevel: 1}), p.mitigation);},
    p => {p.damage.scaling = Object.assign([], {[Symbol()]: true});},
    p => {p.critical = accessor(p.critical, 'chance');}, p => {p.damage.extra = true;},
    p => {delete p.damage.bonuses;}, p => {p.hit.rule = Object.create(p.hit.rule);},
  ];
  const previous = stages(), rng = randomStream([0.2]);
  for (const change of changes) {
    const input = numerical(); change(input);
    assert.throws(() => resolveCombatAttack(previous.admission, previous.target, input, rng.execution), TypeError);
  }
  for (const invalid of [undefined, null, {}, [], Object.create(numerical()), {...numerical(), extra: 1}]) {
    assert.throws(() => resolveCombatAttack(previous.admission, previous.target, invalid, rng.execution), TypeError);
  }
  assert.equal(getters, 0); assert.deepEqual(rng.trace, []);
  console.log('COMBAT_ATTACK_VALIDATION_PASS invalid_stages/numerics_before_RNG; getter_calls=0; missing_enabled_config=TypeError');
});

test('CB18–CB19: invalid/missing/throwing RNG and nonfinite Kernel outputs never succeed', () => {
  for (const sample of [NaN, Infinity, -0.1, 1, '0.2', undefined]) {
    const previous = stages(), rng = randomStream([sample]);
    assert.throws(() => resolveCombatAttack(previous.admission, previous.target, numerical(), rng.execution), TypeError);
    assert.equal(rng.trace.length, 1); // No retry or rollback.
  }
  const previous = stages();
  assert.throws(() => resolveCombatAttack(previous.admission, previous.target, numerical(),
    createExecutionContext({clock: {now: () => 0}})), TypeError);
  assert.throws(() => resolveCombatAttack(previous.admission, previous.target, numerical(), {}), TypeError);
  const failure = Error('caller RNG failure'); let calls = 0;
  const execution = createExecutionContext({clock: {now: () => 0}, random: {next() {calls++; throw failure;}}});
  assert.throws(() => resolveCombatAttack(previous.admission, previous.target, numerical(), execution), e => e === failure);
  assert.equal(calls, 1);
  const overflow = [
    p => {p.damage.base = Number.MAX_VALUE; p.damage.rank = 3; p.damage.perRank = Number.MAX_VALUE;},
    p => {p.damage.base = Number.MAX_VALUE;}, // Finite B0, nonfinite B1 after critical.
    p => {p.mitigation.sourceLevel = Number.MAX_VALUE; p.mitigation.targetLevel = -Number.MAX_VALUE;},
  ];
  for (const change of overflow) {
    const input = numerical(); change(input);
    assert.throws(() => run(input), TypeError);
  }
});

test('CB20: detached immutable diagnostics, RNG mutation isolation, independent replay and actor parity', () => {
  const previous = stages(), input = numerical();
  input.damage.scaling = [{source: 'strength', value: 0, coefficient: 2}];
  input.damage.bonuses = [bonus('zero', 0)];
  const resources = createEntityResourceState(createEntity({id: 'monster-1', kind: 'monster'}),
    {health: {minimum: 0, maximum: 100, current: 80}});
  const before = JSON.stringify({previous, input, resources});
  const now = Date.now, random = Math.random;
  let first, second;
  try {
    Date.now = Math.random = () => {throw Error('Hidden time/RNG');};
    first = run(input, [0.2], previous); second = run(input, [0.2], stages());
  } finally {Date.now = now; Math.random = random;}
  const scaledOracle = {...oracle, b0: {...oracle.b0, scaling: [{source: 'strength', value: 0}]}};
  assert.deepEqual(first, {result: scaledOracle, trace: [0.2]});
  assert.deepEqual(second, {result: scaledOracle, trace: [0.2]});
  assert.notEqual(first.result, second.result);
  function frozenTree(value) {
    if (value && typeof value === 'object') {assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozenTree);}
  }
  frozenTree(first.result); frozenTree(run({...numerical(), hit: {...numerical().hit, dodgeChance: 0.5}}).result);
  assert.throws(() => {first.result.b0.scaling[0].value = 99;}, TypeError);
  assert.throws(() => {first.result.mitigation.missing.push('fake');}, TypeError);
  assert.throws(() => {first.result.context.target.entityId = 'other';}, TypeError);
  assert.equal(JSON.stringify({previous, input, resources}), before);
  for (const value of [input, input.hit, input.critical, input.damage, input.damage.scaling,
    input.damage.scaling[0], input.damage.bonuses[0], input.damage.flat, input.mitigation.rule]) {
    assert.equal(Object.isFrozen(value), false);
  }
  input.damage.scaling[0].value = 500; input.damage.flat.resolved = 100; input.mitigation.rule.baseK = 999;
  assert.deepEqual(first.result, scaledOracle);
  const mutable = numerical(), mutableStages = {admission: {...previous.admission, context: request()},
    target: {...previous.target, context: request()}};
  const execution = createExecutionContext({clock: {now: () => 0}, random: {next() {
    mutable.damage.base = 999; mutable.critical.bonus = 9;
    mutableStages.admission.context.target.entityId = 'changed'; return 0.2;
  }}});
  assert.deepEqual(resolveCombatAttack(mutableStages.admission, mutableStages.target, mutable, execution), oracle);
  assert.deepEqual(run(numerical(), [0.2], stages(true)), {result: {...oracle, context: request(true)}, trace: [0.2]});
  console.log('COMBAT_ATTACK_SESSIONS_PASS sessions=2 literal_final75; replay_draws1; immutable_diagnostics; HP80_Life_alive_unchanged; player/monster_parity');
});
