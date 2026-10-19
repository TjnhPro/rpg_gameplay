import assert from 'node:assert/strict';
import test from 'node:test';
import * as g from '@rpg/gameplay';

// Consumer fixture only: explicit public operations, not a production facade.
function session() {
  const trace = [], rejected = [], hooks = [], events = [];
  const registry = [
    {id: 'progression', optional: true, dependencies: ['entity']},
    {id: 'entity', optional: true, dependencies: []},
  ].reduce(g.registerModule, g.createModuleRegistry());
  assert.deepEqual(g.composeModules(registry, g.configureModules(registry)).moduleIds, []);
  const alone = g.configureModules(registry, {enable: ['progression']});
  assert.throws(() => g.composeModules(registry, alone), TypeError);
  assert.deepEqual(alone.enabledModuleIds, ['progression']);
  const composition = g.composeModules(registry, g.configureModules(registry, {enable: ['progression', 'entity']}));
  trace.push(['modules', ...composition.moduleIds]);
  const messaging = g.createGameplayMessaging(composition);
  const eventNames = ['character-leveled', 'attribute-points-awarded', 'attribute-points-allocated', 'skill-rank-upgraded'];
  const subscriptions = [];
  for (const type of eventNames) for (const label of ['first', 'second']) {
    subscriptions.push(g.subscribeEvent(messaging, {moduleId: 'progression', eventType: type,
      handler(event) { events.push([label, event.type, event.payload.entityId]); }}));
  }
  const calls = {clock: 0, random: 0, ids: 0};
  g.createExecutionContext({clock: {now() { calls.clock++; throw Error('implicit clock'); }},
    random: {next() { calls.random++; throw Error('implicit RNG'); }},
    ids: {next() { calls.ids++; throw Error('implicit ID'); }}});
  let runtime = g.createGameplayRuntime(composition, Object.fromEntries(composition.moduleIds.map(id => [id, {
    initialize() { hooks.push(['initialize', id]); }, start() { hooks.push(['start', id]); },
    stop() { hooks.push(['stop', id, g.unsubscribeModuleEvents(messaging, id)]); },
    dispose() { hooks.push(['dispose', id]); },
  }])));
  const inspection = g.inspectGameplayRuntime(runtime);
  function lifecycle(operation) {
    const result = operation(runtime); assert.equal(result.ok, true); runtime = result.runtime;
  }
  const player = g.createEntity({id: 'player-1', kind: 'player'});
  const monster = g.createEntity({id: 'monster-1', kind: 'monster'});
  const empty = g.createEntityCollection();
  const collection = g.addEntity(g.addEntity(empty, player), monster);
  assert.deepEqual(g.listEntities(collection), [player, monster]);
  assert.deepEqual(g.getEntity(collection, player.id), player);
  assert.throws(() => g.addEntity(collection, player), TypeError);
  const replaced = g.replaceEntity(collection, {id: player.id, kind: 'custom'});
  assert.deepEqual(g.listEntities(g.removeEntity(replaced, player.id)), [monster]);
  const base = g.createProgressionState(player, {level: 1, experience: 0});
  const attributes = g.createEntityAttributeState(player, {strength: 20});
  const initial = {unspentPoints: 0, spentPoints: 0, rewardedThroughLevel: 1};
  const ap = g.createAttributePointState(base, initial), sp = g.createSkillPointState(base, initial);
  const ranks = g.createSkillRankState(player, {sword_basic: 2, sword_mastery: 0});
  assert.equal(g.getSkillRank(ranks, 'sword_mastery'), 0);
  assert.equal(g.getSkillRank(ranks, 'unknown'), undefined);
  const resources = g.createEntityResourceState(player, {health: {minimum: 0, maximum: 100, current: 30}});
  const life = g.createEntityLifeState(player, {status: 'alive'});
  const mp = g.createProgressionState(monster, {level: 5, experience: 50});
  const other = {monster, progression: mp, attributes: g.createEntityAttributeState(monster, {strength: 4}),
    ap: g.createAttributePointState(mp, {...initial, rewardedThroughLevel: 5}),
    sp: g.createSkillPointState(mp, {...initial, rewardedThroughLevel: 5}),
    ranks: g.createSkillRankState(monster, {sword_basic: 1, sword_mastery: 0}),
    resources: g.createEntityResourceState(monster, {health: {minimum: 0, maximum: 10, current: 7}}),
    life: g.createEntityLifeState(monster, {status: 'alive'})};
  const originals = {player, empty, collection, base, attributes, ap, sp, ranks, resources, life, other};
  const saved = structuredClone(originals);
  lifecycle(g.initializeGameplayRuntime); lifecycle(g.startGameplayRuntime);
  assert.deepEqual(originals, saved, 'start does not advance or reward');
  trace.push(['entity-created', player.id], ['progression-created', base.level, base.experience]);

  let current = base;
  g.registerCommandHandler(messaging, {moduleId: 'progression', commandType: 'gain-exp', handler(command) {
    const next = g.gainExperience(current, command.payload);
    current = next.state; return {status: 'success', value: next.transition};
  }});
  const gained = g.dispatchCommand(messaging, {type: 'gain-exp', payload: 260});
  assert.deepEqual(gained, {status: 'success', commandType: 'gain-exp', moduleId: 'progression', value: {
    entityId: 'player-1', before: 0, after: 260, requestedDelta: 260, appliedDelta: 260, limited: false}});
  trace.push(['experience-gained', gained.value.before, gained.value.after, gained.value.appliedDelta],
    ['level-after-exp-gain', current.level]);
  const adjusted = g.adjustExperience(current, {delta: -10});
  assert.deepEqual(adjusted.state, {entityId: 'player-1', level: 1, experience: 250});
  assert.equal(adjusted.transition.appliedDelta, -10);
  assert.equal(g.adjustExperience(current, {delta: -999}).transition.appliedDelta, -260);
  assert.equal(g.gainExperience(current, 50, {maximumExperience: 300}).transition.appliedDelta, 40);
  assert.equal(g.gainExperience(current, 0.5).state.experience, 260.5);
  const policy = {experienceMode: 'cumulative', maxLevel: 100, targetLevel: 4,
    requirements: [100, 250, 500].map((requiredExperience, i) => ({toLevel: i + 2, requiredExperience, eligible: true}))};
  const localPolicy = {...policy, experienceMode: 'level-local', requirements:
    [100, 150, 200].map((requiredExperience, i) => ({toLevel: i + 2, requiredExperience, eligible: true}))};
  const rewards = {pointsByLevel: {2: 5, 3: 5}}, skillRewards = {pointsByLevel: {2: 1, 3: 2}};
  const request = {skillId: 'sword_mastery', expectedRank: 0, maxRank: 5, requiredCharacterLevel: 3,
    pointCost: 2, prerequisites: [{skillId: 'sword_basic', minimumRank: 2}], eligible: true};
  const policies = {policy, localPolicy, rewards, skillRewards, request};
  const savedPolicies = structuredClone(policies);
  const level = g.advanceProgressionLevel(current, policy);
  const levelOracle = {entityId: 'player-1', beforeLevel: 1, projectedLevel: 3, targetLevel: 4,
    beforeExperience: 260, projectedExperience: 260, levelsGained: 2, experienceConsumed: 0,
    advancedLevels: [2, 3], blockedAtLevel: 4, reason: 'insufficient_experience'};
  assert.deepEqual(level.transition, levelOracle);
  assert.deepEqual(g.evaluateLevelAdvancement(current, policy), levelOracle);
  const local = g.advanceProgressionLevel(current, localPolicy);
  assert.deepEqual(local, {state: {entityId: 'player-1', level: 3, experience: 10},
    transition: {...levelOracle, projectedExperience: 10, experienceConsumed: 250}});
  assert.deepEqual(g.evaluateLevelAdvancement(current, localPolicy), local.transition);
  trace.push(['advancement', level.state.level, level.state.experience, level.transition.advancedLevels,
    level.transition.blockedAtLevel, level.transition.reason], ['local', local.state.level, local.state.experience, local.transition.experienceConsumed]);
  assert.deepEqual(ap, saved.ap); assert.deepEqual(sp, saved.sp);
  const awarded = g.grantAttributePointRewards(ap, level, rewards);
  assert.deepEqual(awarded.transition, {entityId: 'player-1', rewardedLevels: [2, 3], pointsGranted: 10, beforeUnspent: 0, afterUnspent: 10});
  assert.deepEqual(sp, saved.sp, 'attribute reward does not update skill cursor');
  trace.push(['attribute-rewards', awarded.transition.pointsGranted, awarded.state.rewardedThroughLevel]);
  let calculations = 0;
  const config = {attributeOrder: ['strength'], statOrder: ['power'],
    attributeRules: {strength: {default: 0, enabled: true, bounds: {}}}, attributeBaselines: {strength: 0},
    baseStats: {power: 5}, rules: {power: {default: 5, enabled: true, bounds: {}, training: 0,
      scaling: [{attribute: 'strength', coefficient: 2, enabled: true}]}}, flatContributions: {}, modifiers: [],
    transforms: {power(value) { calculations++; return value; }}};
  const beforeStats = g.calculateEntityStats(attributes, config);
  assert.equal(beforeStats.stats.power, 45);
  const allocation = g.allocateAttributePoints(awarded.state, attributes, {attributeId: 'strength', pointCost: 3, newBaseValue: 23});
  assert.equal(calculations, 1, 'allocation must not recalculate');
  assert.deepEqual(allocation.attributes, g.setEntityBaseAttribute(attributes, 'strength', 23));
  const stats = g.calculateEntityStats(allocation.attributes, config);
  assert.equal(calculations, 2); assert.equal(beforeStats.stats.power, 45);
  trace.push(['attribute-allocation', allocation.transition.beforeUnspent, allocation.transition.afterUnspent,
    allocation.transition.beforeValue, allocation.transition.afterValue], ['stats-recalculation', beforeStats.stats.power, stats.stats.power]);
  const skillAward = g.grantSkillPointRewards(sp, level, skillRewards);
  assert.deepEqual(skillAward.transition, {entityId: 'player-1', rewardedLevels: [2, 3], pointsGranted: 3, beforeUnspent: 0, afterUnspent: 3});
  trace.push(['skill-rewards', skillAward.transition.pointsGranted, skillAward.state.rewardedThroughLevel]);
  const assessment = g.evaluateSkillUpgrade(level.state, ranks, skillAward.state, request);
  assert.deepEqual(assessment, {entityId: 'player-1', skillId: 'sword_mastery', beforeRank: 0, projectedRank: 1,
    beforeUnspent: 3, projectedUnspent: 1, pointsSpent: 2, outcome: 'upgraded', reason: 'none'});
  const upgrade = g.upgradeSkillRank(level.state, ranks, skillAward.state, request);
  assert.deepEqual(upgrade.transition, assessment);
  trace.push(['skill-upgrade', upgrade.transition.beforeRank, upgrade.transition.projectedRank,
    upgrade.transition.beforeUnspent, upgrade.transition.projectedUnspent]);
  const final = {entity: player, progression: level.state, attributePoints: allocation.points,
    attributes: allocation.attributes, stats, skillPoints: upgrade.points, ranks: upgrade.ranks};
  assert.deepEqual(final, finalOracle);
  trace.push(['final', final]);

  // Cross-domain failures use actual results above; no fabricated success receipts.
  function rejects(label, operation) { assert.throws(operation, TypeError); rejected.push(label); }
  rejects('invalid-progression', () => g.gainExperience({...base, level: 0}, 1));
  rejects('invalid-adjustment', () => g.adjustExperience(current, {delta: NaN}));
  rejects('invalid-later-level', () => g.advanceProgressionLevel(current, {...policy,
    requirements: [...policy.requirements.slice(0, 2), {...policy.requirements[2], eligible: 'yes'}]}));
  rejects('attribute-replay', () => g.grantAttributePointRewards(allocation.points, level, rewards));
  rejects('skill-replay', () => g.grantSkillPointRewards(upgrade.points, level, skillRewards));
  rejects('missing-reward', () => g.grantAttributePointRewards(ap, level, {pointsByLevel: {2: 5}}));
  rejects('missing-skill-reward', () => g.grantSkillPointRewards(sp, level, {pointsByLevel: {2: 1}}));
  rejects('attribute-insufficient', () => g.allocateAttributePoints(allocation.points, allocation.attributes,
    {attributeId: 'strength', pointCost: 8, newBaseValue: 99}));
  rejects('unknown-attribute', () => g.allocateAttributePoints(allocation.points, allocation.attributes,
    {attributeId: 'unknown', pointCost: 1, newBaseValue: 99}));
  rejects('upgrade-replay', () => g.upgradeSkillRank(level.state, upgrade.ranks, upgrade.points, request));
  rejects('identity-mismatch', () => g.upgradeSkillRank(level.state, other.ranks, skillAward.state, request));
  rejects('reward-identity', () => g.grantSkillPointRewards(other.sp, level, skillRewards));
  rejects('unknown-skill', () => g.upgradeSkillRank(level.state, ranks, skillAward.state, {...request, skillId: 'missing'}));
  rejects('invalid-prerequisite', () => g.upgradeSkillRank(level.state, ranks, skillAward.state,
    {...request, prerequisites: [{skillId: 'missing', minimumRank: 1}]}));
  const blockers = [
    [{requiredCharacterLevel: 4}, 'character_level_too_low'],
    [{prerequisites: [{skillId: 'sword_basic', minimumRank: 3}]}, 'prerequisite_not_met'],
    [{skillId: 'sword_basic', expectedRank: 2, maxRank: 2, prerequisites: []}, 'max_rank'],
    [{pointCost: 4}, 'insufficient_points'], [{eligible: false}, 'condition_not_met'],
  ];
  for (const [override, reason] of blockers) {
    const requirement = {...request, ...override};
    const blocked = g.upgradeSkillRank(level.state, ranks, skillAward.state, requirement);
    assert.deepEqual(blocked.ranks, ranks); assert.deepEqual(blocked.points, skillAward.state);
    assert.deepEqual(blocked.transition, {entityId: 'player-1', skillId: requirement.skillId,
      beforeRank: reason === 'max_rank' ? 2 : 0, projectedRank: reason === 'max_rank' ? 2 : 0,
      beforeUnspent: 3, projectedUnspent: 3, pointsSpent: 0, outcome: 'blocked', reason});
    assert.deepEqual(g.evaluateSkillUpgrade(level.state, ranks, skillAward.state, requirement), blocked.transition);
  }
  const failedCommand = g.dispatchCommand(messaging, {type: 'gain-exp', payload: -1});
  assert.equal(failedCommand.status, 'failed'); assert.equal(failedCommand.failure.moduleId, 'progression');
  assert.equal(current.experience, 260);
  const zero = g.grantSkillPointRewards(sp, level, {pointsByLevel: {2: 0, 3: 0}});
  assert.deepEqual(zero.state, {entityId: 'player-1', unspentPoints: 0, spentPoints: 0, rewardedThroughLevel: 3});
  rejects('zero-replay', () => g.grantSkillPointRewards(zero.state, level, {pointsByLevel: {2: 0, 3: 0}}));
  const nextRank = g.upgradeSkillRank(level.state, upgrade.ranks, upgrade.points, {...request, expectedRank: 1, pointCost: 1});
  assert.equal(nextRank.ranks.ranks.sword_mastery, 2); assert.equal(nextRank.points.unspentPoints, 0);
  // Mutable structural inputs are detached, not frozen as a side effect.
  const mutableRanks = structuredClone(ranks), mutablePoints = structuredClone(skillAward.state), mutableRequest = structuredClone(request);
  const detached = g.upgradeSkillRank(level.state, mutableRanks, mutablePoints, mutableRequest);
  assert.deepEqual(detached, upgrade);
  assert.equal(Object.isFrozen(mutableRanks.ranks), false);
  mutableRanks.ranks.sword_basic = 99; mutablePoints.unspentPoints = 99; mutableRequest.prerequisites[0].minimumRank = 99;
  assert.deepEqual(detached, upgrade);

  assert.deepEqual(events, [], 'all operations and command dispatch publish nothing');
  for (const [i, payload] of [level.transition, awarded.transition, allocation.transition, upgrade.transition].entries()) {
    assert.deepEqual(g.publishEvent(messaging, {type: eventNames[i], payload}),
      {ok: true, eventType: eventNames[i], completedDeliveries: 2});
  }
  assert.equal(g.unsubscribeEvent(messaging, subscriptions[0]), true);
  assert.equal(g.unsubscribeEvent(messaging, subscriptions[0]), false);
  let attempts = 0;
  for (const fails of [false, true, false]) g.subscribeEvent(messaging, {moduleId: 'progression', eventType: 'caller-failure',
    handler() { attempts++; if (fails) throw Error('listener failed'); }});
  const failure = g.publishEvent(messaging, {type: 'caller-failure', payload: upgrade});
  assert.equal(failure.ok, false); assert.equal(failure.completedDeliveries, 1);
  assert.equal(failure.failure.moduleId, 'progression'); assert.equal(failure.failure.message, 'listener failed');
  assert.equal(attempts, 2, 'fail-fast, no retry');
  assert.deepEqual(final, finalOracle, 'listener failure does not roll back explicit snapshots');
  trace.push(['rejections', rejected], ['blockers', blockers.map(([, reason]) => reason)],
    ['events', events], ['listener-failure', failure.completedDeliveries, attempts, failure.failure.moduleId, failure.failure.message]);
  lifecycle(g.stopGameplayRuntime); lifecycle(g.disposeGameplayRuntime);
  assert.deepEqual(hooks, [['initialize', 'entity'], ['initialize', 'progression'], ['start', 'entity'], ['start', 'progression'],
    ['stop', 'progression', 10], ['stop', 'entity', 0], ['dispose', 'progression'], ['dispose', 'entity']]);
  assert.equal(g.publishEvent(messaging, {type: 'skill-rank-upgraded', payload: upgrade.transition}).completedDeliveries, 0);
  assert.equal(g.inspectGameplayRuntime(runtime).status, 'disposed'); assert.equal(inspection.status, 'created');
  assert.deepEqual(calls, {clock: 0, random: 0, ids: 0});
  assert.deepEqual(originals, saved); assert.deepEqual(policies, savedPolicies);
  assert.deepEqual(g.listEntities(empty), []); assert.equal(g.getEntity(collection, player.id).kind, 'player');
  assert.equal(beforeStats.stats.power, 45); assert.equal(calculations, 2);
  // Recursively prove every result data layer is frozen; policies remain caller-owned.
  function immutable(value) {
    if (!value || typeof value !== 'object') return;
    assert.ok(Object.isFrozen(value)); assert.equal(Reflect.set(value, 'consumerMutation', 1), false);
    for (const child of Object.values(value)) immutable(child);
  }
  for (const value of [originals, ...Object.values(final), level, local, awarded, allocation, skillAward, upgrade, assessment, detached]) {
    if (value === originals) for (const snapshot of Object.values(originals)) {
      if (snapshot === other) for (const state of Object.values(other)) immutable(state); else immutable(snapshot);
    } else immutable(value);
  }
  trace.push(['cleanup', 'disposed', 'created', 0]);
  return trace;
}

// Independent task oracle; never generated from implementation output.
const finalOracle = {
  entity: {id: 'player-1', kind: 'player'}, progression: {entityId: 'player-1', level: 3, experience: 260},
  attributePoints: {entityId: 'player-1', unspentPoints: 7, spentPoints: 3, rewardedThroughLevel: 3},
  attributes: {entityId: 'player-1', baseAttributes: {strength: 23}},
  stats: {entityId: 'player-1', effectiveAttributes: {strength: 23}, stats: {power: 51}},
  skillPoints: {entityId: 'player-1', unspentPoints: 1, spentPoints: 2, rewardedThroughLevel: 3},
  ranks: {entityId: 'player-1', ranks: {sword_basic: 2, sword_mastery: 1}},
};
const expected = [
  ['modules', 'entity', 'progression'], ['entity-created', 'player-1'], ['progression-created', 1, 0],
  ['experience-gained', 0, 260, 260], ['level-after-exp-gain', 1],
  ['advancement', 3, 260, [2, 3], 4, 'insufficient_experience'], ['local', 3, 10, 250],
  ['attribute-rewards', 10, 3], ['attribute-allocation', 10, 7, 20, 23], ['stats-recalculation', 45, 51],
  ['skill-rewards', 3, 3], ['skill-upgrade', 0, 1, 3, 1], ['final', finalOracle],
  ['rejections', ['invalid-progression', 'invalid-adjustment', 'invalid-later-level', 'attribute-replay', 'skill-replay',
    'missing-reward', 'missing-skill-reward', 'attribute-insufficient', 'unknown-attribute', 'upgrade-replay',
    'identity-mismatch', 'reward-identity', 'unknown-skill', 'invalid-prerequisite', 'zero-replay']],
  ['blockers', ['character_level_too_low', 'prerequisite_not_met', 'max_rank', 'insufficient_points', 'condition_not_met']],
  ['events', [['first', 'character-leveled', 'player-1'], ['second', 'character-leveled', 'player-1'],
    ['first', 'attribute-points-awarded', 'player-1'], ['second', 'attribute-points-awarded', 'player-1'],
    ['first', 'attribute-points-allocated', 'player-1'], ['second', 'attribute-points-allocated', 'player-1'],
    ['first', 'skill-rank-upgraded', 'player-1'], ['second', 'skill-rank-upgraded', 'player-1']]],
  ['listener-failure', 1, 2, 'progression', 'listener failed'], ['cleanup', 'disposed', 'created', 0],
];

test('PG19: installed full Progression/Entity/Foundation flow, literal sessions and failure boundaries', () => {
  const now = Date.now, random = Math.random;
  Date.now = Math.random = () => { throw Error('implicit time/RNG'); };
  try {
    const first = session(); assert.deepEqual(first, expected);
    const second = session(); assert.deepEqual(second, expected); assert.deepEqual(first, second);
    console.log('PROGRESSION_INTEGRATION_TRACE_PASS ' + JSON.stringify(first));
    console.log('PROGRESSION_INTEGRATION_SESSIONS_PASS sessions=2 literal_oracle; cumulative3/260 local3/10; AP7/3 SP1/2; strength23 power51 mastery1; failures15 blockers5');
  } finally { Date.now = now; Math.random = random; }
});
