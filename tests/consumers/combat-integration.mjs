import assert from 'node:assert/strict';
import test from 'node:test';
import * as g from '@rpg/gameplay';

// External caller fixture only. Each invocation owns all state and providers.
function fixture({reverse = false, current = 100, sourceStatus = 'alive', targetStatus = 'alive',
  missingSource = false, missingTarget = false, samples = [0.2, 0.2]} = {}) {
  const player = g.createEntity({id: 'player-1', kind: 'player'});
  const monster = g.createEntity({id: 'monster-1', kind: 'monster'});
  const source = reverse ? monster : player, target = reverse ? player : monster;
  let entities = g.createEntityCollection();
  if (!missingSource) entities = g.addEntity(entities, source);
  if (!missingTarget) entities = g.addEntity(entities, target);
  const sourceLife = g.createEntityLifeState(source, {status: sourceStatus});
  const life = g.createEntityLifeState(target, {status: targetStatus});
  const resources = g.createEntityResourceState(target, {
    health: {minimum: 0, maximum: 200, current}, mana: {minimum: 0, maximum: 50}});
  const progression = g.createProgressionState(source, {level: 1, experience: 0});
  const points = {unspentPoints: 3, spentPoints: 0, rewardedThroughLevel: 1};
  const isolated = {source, sourceLife, entities, progression,
    resources: g.createEntityResourceState(source, {health: {minimum: 0, maximum: 100}}),
    attributes: g.createEntityAttributeState(source, {strength: 20}),
    ap: g.createAttributePointState(progression, points), sp: g.createSkillPointState(progression, points),
    ranks: g.createSkillRankState(source, {sword: 1})};
  const calls = {clock: 0, ids: 0, random: []};
  const execution = g.createExecutionContext({clock: {now() {calls.clock++; throw Error('Unexpected clock');}},
    ids: {next() {calls.ids++; throw Error('Unexpected ID');}},
    random: {next() {
      const value = samples[calls.random.length]; calls.random.push(value); return value;
    }}});
  const numerical = {hit: {dodgeChance: 0, eligible: true, rule: {enabled: true, bounds: {min: 0, max: 1}}},
    critical: {chance: 0.5, bonus: 0.5, eligible: true, rule: {enabled: true, bounds: {min: 0, max: 1}}},
    damage: {base: 100, rank: 1, perRank: 0, scaling: [], flat: {definition: 0, additional: 0, resolved: 0}, bonuses: []},
    mitigation: {ruleKey: 'armor', rating: 100, rule: {enabled: true, bounds: {min: 0, max: 1},
      baseK: 100, levelPenalty: 0, levelScalingEnabled: false}}};
  return {source, target, entities, sourceLife, life, resources, isolated, execution, calls, numerical,
    policy: {resourceId: 'health', minimum: 0, maximum: 100, currentAboveMaximum: 'allow'},
    targetPolicy: {relation: 'enemy', allowedRelations: ['enemy'], allowedLifeStatuses: ['alive']}};
}

// Explicit sequencing is caller policy. Trace observes which public stages ran;
// it does not replace calculations, transitions or admission/target validation.
function attempt(f, actionId = 'attack-001', eligible = true) {
  const stages = [];
  const context = g.createCombatActionContext({actionId, actionType: 'basic_attack', sourceEntityId: f.source.id,
    target: {kind: 'entity', entityId: f.target.id}});
  stages.push('admission');
  const admission = g.evaluateCombatActionAdmission(context, f.entities, f.sourceLife, {eligible});
  if (admission.status === 'rejected') return {context, admission, stages};
  stages.push('target');
  const target = g.evaluateCombatTargetValidation(admission, f.entities, f.life, f.targetPolicy);
  if (target.status === 'rejected') return {context, admission, target, stages};
  stages.push('attack');
  const attack = g.resolveCombatAttack(admission, target, f.numerical, f.execution);
  stages.push('application');
  const application = g.applyCombatAttackDamage(attack, f.resources, f.life, f.policy);
  return {context, admission, target, attack, application, stages};
}
function frozenTree(value) {
  if (value !== null && typeof value === 'object') {
    assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozenTree);
  }
}
function implicitProvidersForbidden(run) {
  const now = Date.now, random = Math.random;
  try {Date.now = Math.random = () => {throw Error('Hidden time/RNG');}; return run();}
  finally {Date.now = now; Math.random = random;}
}
const expectedTrace = [
  ['attack-001', 'admitted', 'accepted', 'landed', true, false, 0, null, true, 0.2, 0.5, 1.5,
    100, 0.5, 150, 0.5, 75, 75, 75, 100, 25, 'alive', 'alive', 'unchanged'],
  ['attack-002', 'admitted', 'accepted', 'landed', true, false, 0, null, true, 0.2, 0.5, 1.5,
    100, 0.5, 150, 0.5, 75, 75, 25, 25, 0, 'alive', 'dead', 'defeated'],
];
function traceRow(result) {
  const {attack: a, application: p} = result;
  return [a.context.actionId, result.admission.status, result.target.status, a.outcome,
    a.hit.hit, a.hit.dodged, a.hit.chance, a.hit.roll, a.critical.isCritical, a.critical.roll,
    a.critical.bonus, a.critical.multiplier, a.b0.raw, a.b1.criticalBonus, a.b1.beforeDefense,
    a.mitigation.reduction, a.mitigation.preventedDamage, a.finalDamage, p.appliedDamage,
    p.resourceResult.transition.before, p.resourceResult.transition.after,
    p.lifeResult.before, p.lifeResult.after, p.lifeResult.outcome];
}

test('CB26/CB27: two attacks, independent literal replay, role parity and mode-neutral callers', () => implicitProvidersForbidden(() => {
  const registry = [
    {id: 'entity', optional: true, dependencies: []},
    {id: 'progression', optional: true, dependencies: ['entity']},
    {id: 'combat', optional: true, dependencies: ['entity']},
  ].reduce(g.registerModule, g.createModuleRegistry());
  const combatOnly = g.configureModules(registry, {enable: ['combat']});
  assert.throws(() => g.composeModules(registry, combatOnly), TypeError);
  assert.deepEqual(combatOnly.enabledModuleIds, ['combat']);
  const composition = g.composeModules(registry, g.configureModules(registry, {enable: ['entity', 'combat']}));
  assert.deepEqual(composition.moduleIds, ['entity', 'combat']);
  function session(reverse = false) {
    const f = fixture({reverse}), original = structuredClone({resources: f.resources, life: f.life, isolated: f.isolated});
    const messaging = g.createGameplayMessaging(composition), events = [];
    for (const type of ['combat-attack-resolved', 'combat-damage-applied', 'entity-defeated']) {
      g.subscribeEvent(messaging, {moduleId: 'combat', eventType: type, handler(event) {events.push(event);}});
    }
    const first = attempt(f);
    assert.deepEqual(first.context, {actionId: 'attack-001', actionType: 'basic_attack', sourceEntityId: f.source.id,
      target: {kind: 'entity', entityId: f.target.id}});
    const next = {...f, resources: first.application.resourceResult.state, life: first.application.lifeResult.state};
    assert.equal(f.resources.current.health, 100); assert.equal(next.resources.current.health, 25);
    const second = attempt(next, 'attack-002');
    const trace = [traceRow(first), traceRow(second)];
    assert.deepEqual(trace, expectedTrace); // Each independent session must match the literal task oracle.
    assert.deepEqual(f.calls, {clock: 0, ids: 0, random: [0.2, 0.2]});
    assert.deepEqual(second.application.resourceResult.state, {entityId: f.target.id, current: {health: 0, mana: 50}});
    assert.deepEqual(second.application.lifeResult.state, {entityId: f.target.id, status: 'dead'});
    assert.equal(next.resources.current.health, 25); assert.equal(next.life.status, 'alive');
    assert.deepEqual({resources: f.resources, life: f.life, isolated: f.isolated}, original);
    for (const r of [first, second]) {
      for (const key of ['context', 'admission', 'target', 'attack', 'application']) frozenTree(r[key]);
      assert.deepEqual(r.stages, ['admission', 'target', 'attack', 'application']);
      assert.equal(r.application.appliedDamage, r.application.resourceResult.transition.applied);
    }
    frozenTree(f.entities); frozenTree(f.resources); frozenTree(f.life);
    assert.deepEqual(events, []); assert.equal(g.unsubscribeModuleEvents(messaging, 'combat'), 3);
    // No persistent ledger: intentionally reusing old snapshots branches identically.
    assert.deepEqual(g.applyCombatAttackDamage(first.attack, f.resources, f.life, f.policy), first.application);
    assert.deepEqual(f.calls.random, [0.2, 0.2]);
    return {trace, first, second};
  }
  const a = session(), b = session();
  assert.deepEqual(a.trace, b.trace); assert.notEqual(a.first.context, b.first.context);
  assert.notEqual(a.second.application.resourceResult.state, b.second.application.resourceResult.state);
  assert.deepEqual(session(true).trace, expectedTrace);
  // Labels belong to callers; no timing/coordinate/render parameters enter APIs.
  for (const mode of ['Text', 'Realtime', 'TurnBased']) assert.deepEqual(session().trace, expectedTrace, mode);
  console.log('COMBAT_INTEGRATION_TRACE_PASS ' + JSON.stringify(a.trace));
  console.log('COMBAT_INTEGRATION_REPLAY_PASS sessions2; HP100->25->0; applied75/25; RNG2critical/0dodge; parity; mode_neutral_API_only');
}));

test('CB28: rejection boundaries, dodge, invalid receipts/policies and failed RNG have no downstream writes', () => implicitProvidersForbidden(() => {
  const cases = [
    [{missingSource: true}, true, null, 'source_not_found', ['admission']],
    [{sourceStatus: 'dead'}, true, null, 'source_dead', ['admission']],
    [{}, false, null, 'source_ineligible', ['admission']],
    [{missingTarget: true}, true, null, 'target_not_found', ['admission', 'target']],
    [{}, true, 'ally', 'relation_not_allowed', ['admission', 'target']],
    [{targetStatus: 'dead'}, true, null, 'target_life_not_allowed', ['admission', 'target']],
  ];
  for (const [options, eligible, relation, reason, stages] of cases) {
    const f = fixture(options), before = structuredClone({resources: f.resources, life: f.life, isolated: f.isolated});
    if (relation) f.targetPolicy.relation = relation;
    const result = attempt(f, 'rejected', eligible);
    assert.equal((result.target ?? result.admission).reason, reason);
    assert.deepEqual(result.stages, stages); assert.equal(Object.hasOwn(result, 'attack'), false);
    assert.deepEqual(f.calls, {clock: 0, ids: 0, random: []});
    assert.deepEqual({resources: f.resources, life: f.life, isolated: f.isolated}, before);
    assert.throws(() => g.resolveCombatAttack(result.admission, result.target, null, f.execution), TypeError);
    assert.deepEqual(f.calls.random, []);
  }
  const dodge = fixture(); dodge.numerical.hit.dodgeChance = 0.5;
  // Valid finite inputs whose B0 would overflow if dodge did not short-circuit.
  dodge.numerical.damage.base = Number.MAX_VALUE; dodge.numerical.damage.rank = 2; dodge.numerical.damage.perRank = 1;
  const dodged = attempt(dodge);
  assert.equal(dodged.attack.outcome, 'dodged'); assert.equal(dodged.attack.finalDamage, 0);
  for (const stage of ['critical', 'b0', 'b1', 'mitigation']) assert.equal(Object.hasOwn(dodged.attack, stage), false);
  assert.deepEqual(dodge.calls.random, [0.2]);
  assert.equal(dodged.application.outcome, 'dodged'); assert.equal(dodged.application.resourceResult, null);
  assert.equal(dodged.application.lifeResult, null); assert.equal(dodge.resources.current.health, 100);
  const f = fixture(), valid = attempt(f), old = structuredClone({resources: f.resources, life: f.life});
  for (const invalidTarget of [{...valid.target, context: {...valid.context, actionId: 'other'}},
    {...valid.target, targetEntityId: 'player-1'}]) {
    assert.throws(() => g.resolveCombatAttack(valid.admission, invalidTarget, f.numerical, f.execution), TypeError);
  }
  const invalidInput = structuredClone(f.numerical); invalidInput.damage.rank = 0;
  assert.throws(() => g.resolveCombatAttack(valid.admission, valid.target, invalidInput, f.execution), TypeError);
  assert.deepEqual(f.calls.random, [0.2]);
  for (const sample of [NaN, 1, -0.1]) {
    const invalid = fixture({samples: [sample]}); assert.throws(() => attempt(invalid), TypeError);
    assert.deepEqual(invalid.calls.random, [sample]); assert.equal(invalid.resources.current.health, 100);
    assert.equal(invalid.life.status, 'alive');
  }
  const failure = Error('caller RNG failure'); let draws = 0;
  const throwing = {...f, execution: g.createExecutionContext({clock: {now() {throw Error('clock');}},
    random: {next() {draws++; throw failure;}}})};
  assert.throws(() => attempt(throwing), error => error === failure); assert.equal(draws, 1);
  const missing = {...f, execution: g.createExecutionContext({clock: {now() {throw Error('clock');}}})};
  assert.throws(() => attempt(missing), TypeError);
  for (const invalid of [{...valid.attack, finalDamage: -1}, {...valid.attack, mitigation: {}}]) {
    assert.throws(() => g.applyCombatAttackDamage(invalid, f.resources, f.life, f.policy), TypeError);
  }
  for (const [resources, life] of [[f.isolated.resources, f.life], [f.resources, f.sourceLife]]) {
    assert.throws(() => g.applyCombatAttackDamage(valid.attack, resources, life, f.policy), TypeError);
  }
  assert.deepEqual({resources: f.resources, life: f.life}, old); assert.deepEqual(f.calls.random, [0.2]);
  console.log('COMBAT_INTEGRATION_NEGATIVE_PASS N01-N09/N16-N18; rejected_draws0; dodge_draws1; invalid_RNG_attempt1/no_retry');
}));

test('CB28/CB29: actual calculated20/above-max accounting, zero/minimum/dead and mutable handoffs', () => implicitProvidersForbidden(() => {
  const f = fixture({current: 140}); f.numerical.damage.base = 20;
  f.numerical.critical.rule.enabled = false; f.numerical.mitigation.rule.enabled = false;
  const result = attempt(f), p = result.application;
  assert.equal(result.attack.finalDamage, 20);
  assert.deepEqual(p.resourceResult.transition, {resource: 'health', before: 140, after: 100, applied: 20, reachedMinimum: false});
  assert.equal(p.appliedDamage, 20); assert.equal(p.resourceResult.transition.before - p.resourceResult.transition.after, 40);
  assert.deepEqual(f.calls.random, []);
  assert.throws(() => g.applyCombatAttackDamage(result.attack, f.resources, f.life, {...f.policy, currentAboveMaximum: 'reject'}),
    /Current resource exceeds maximum/);
  assert.equal(f.resources.current.health, 140);
  for (const current of [0, 140]) {
    const zero = fixture({current}); zero.numerical.damage.base = 0;
    const r = attempt(zero);
    assert.equal(r.attack.outcome, 'landed'); assert.equal(r.attack.finalDamage, 0);
    assert.equal(r.application.outcome, 'zero_damage'); assert.equal(r.application.appliedDamage, 0);
    assert.equal(r.application.resourceResult, null); assert.equal(r.application.lifeResult, null);
    assert.equal(zero.resources.current.health, current); assert.equal(zero.life.status, 'alive');
    assert.deepEqual(zero.calls.random, [0.2]);
  }
  for (const status of ['alive', 'dead']) {
    const minimum = fixture({current: 0, targetStatus: status}); minimum.targetPolicy.allowedLifeStatuses = ['alive', 'dead'];
    const r = attempt(minimum);
    assert.equal(r.application.appliedDamage, 0); assert.equal(r.application.lifeResult.after, 'dead');
    assert.equal(r.application.lifeResult.outcome, status === 'alive' ? 'defeated' : 'unchanged');
    const next = {...minimum, resources: r.application.resourceResult.state, life: r.application.lifeResult.state};
    assert.equal(attempt(next, 'repeat').application.lifeResult.outcome, 'unchanged');
  }
  const inputs = structuredClone({attack: result.attack, resources: f.resources, life: f.life, policy: f.policy});
  const before = structuredClone(inputs);
  const applied = g.applyCombatAttackDamage(inputs.attack, inputs.resources, inputs.life, inputs.policy);
  assert.deepEqual(inputs, before); frozenTree(applied);
  for (const value of [inputs.attack, inputs.attack.context.target, inputs.resources.current, inputs.life, inputs.policy]) {
    assert.equal(Object.isFrozen(value), false);
  }
  inputs.attack.context.target.entityId = 'changed'; inputs.resources.current.health = 999; inputs.life.status = 'dead';
  assert.equal(applied.context.target.entityId, 'monster-1'); assert.equal(applied.resourceResult.state.current.health, 100);
  assert.equal(applied.lifeResult.after, 'alive');
  console.log('COMBAT_INTEGRATION_ACCOUNTING_PASS final20/applied20/delta40; zero_noop; minimum_alive_defeated; dead_unchanged; mutable_detached');
}));
