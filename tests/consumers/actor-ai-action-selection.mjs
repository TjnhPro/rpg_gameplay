import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import * as g from '@rpg/gameplay';

function contract(name, run) {
  test(name, () => {
    let assertions = 0;
    const checked = new Proxy(assert, {get(target, key) {
      return (...args) => {assertions++; return Reflect.get(target, key)(...args);};
    }});
    run(checked);
    assert.ok(assertions > 0, 'Action contract requires actual assertions');
  });
}
const rule = (ruleId, actionKind = 'basic_attack', targetMode = 'current_target', behaviorStateId = 'engaged', actionKey = ruleId) =>
  ({ruleId, behaviorStateId, actionKey, actionKind, targetMode});
const policy = (rules = [], profileId = 'P') => ({profileId, rules});
const available = actionKey => ({actionKey, status: 'available', reasonId: null});
const unavailable = (actionKey, reasonId = 'cooldown_active') => ({actionKey, status: 'unavailable', reasonId});
const reject = (ruleId, reason, actionKey = ruleId) => ({ruleId, actionKey, reason});
function fixture({kind = 'monster', controller = 'ai', behaviorStateId = 'engaged', targetEntityId = 'Target', actorId = 'Actor'} = {}) {
  const actor = g.createEntity({id: actorId, kind});
  const entities = g.addEntity(g.addEntity(g.createEntityCollection(), actor), {id: 'Target', kind: 'player'});
  const state = {...g.createActorAIState(actor, {profileId: 'P'}, {controller, behaviorStateId}), targetEntityId};
  const context = {...g.createActorAIDecisionContext(state, 'decision-001')};
  const run = (rules = [], facts = [], current = state) => g.evaluateActorAIActionSelection(current, entities, context,
    policy(rules), g.createActorAIActionObservation(context, facts));
  return {actor, entities, state, context, run};
}
function selected(f, ruleId, actionKind, targetEntityId, rejected = [], actionKey = ruleId) {
  return {status: 'selected', reason: 'rule_selected', selectedRuleId: ruleId, actionKind,
    decision: {status: 'proposed', reason: 'none', intent: {...f.context, actionKey, targetEntityId}}, rejected};
}
const noAction = (reason = 'no_candidate', rejected = []) => ({status: 'no_action', reason, selectedRuleId: null, actionKind: null,
  decision: {status: 'no_action', reason, intent: null}, rejected});
function frozen(assert, value) {
  if (value && typeof value === 'object') {assert.ok(Object.isFrozen(value)); Object.values(value).forEach(x => frozen(assert, x));}
}

contract('action: detached generic policy and correlated observation capture exact opaque IDs', assert => {
  const f = fixture(), input = policy([rule(' custom ', 'skill', 'self', ' custom-state ', '__proto__'),
    rule('other', 'skill', 'self', 'Other', '__proto__')], ' P ');
  const captured = g.createActorAIActionSelectionPolicy(input);
  assert.deepEqual(captured, input); assert.notEqual(captured.rules[0], input.rules[0]); frozen(assert, captured);
  input.rules.reverse(); input.rules[0].actionKey = 'changed'; assert.equal(captured.rules[0].ruleId, ' custom ');
  const facts = [available('__proto__'), unavailable(' Custom ', ' opaque diagnostic ')];
  const observed = g.createActorAIActionObservation(f.context, facts);
  assert.deepEqual(observed, {...f.context, availability: facts}); frozen(assert, observed); assert.notEqual(observed.availability[0], facts[0]);
  facts[0].actionKey = 'changed'; facts.reverse(); assert.equal(observed.availability[0].actionKey, '__proto__');
  assert.deepEqual(g.createActorAIActionSelectionPolicy(policy()), {profileId: 'P', rules: []});
  assert.deepEqual(g.createActorAIActionObservation(f.context, []), {...f.context, availability: []});
  assert.equal(Object.isFrozen(input.rules), false); assert.equal(Object.isFrozen(facts), false);
  console.log('ACTOR_AI_ACTION_CAPTURE_PASS');
});

contract('action: existing intents cover attack, current/self skill, approach, return-home and explicit wait', assert => {
  const f = fixture();
  for (const [kind, mode, behavior, target] of [
    ['basic_attack', 'current_target', 'engaged', 'Target'], ['skill', 'current_target', 'engaged', 'Target'],
    ['skill', 'self', 'engaged', 'Actor'], ['approach_target', 'current_target', 'engaged', 'Target'],
    ['return_home', 'none', 'returning', null], ['wait', 'none', 'idle', null],
  ]) {
    const current = {...f.state, behaviorStateId: behavior};
    const result = f.run([rule('opaque-key', kind, mode, behavior)], [available('opaque-key')], current);
    assert.deepEqual(result, selected(f, 'opaque-key', kind, target));
    assert.deepEqual(g.validateActorAIDecisionResult(current, f.context, result.decision), result.decision);
    assert.deepEqual(Object.keys(result.decision.intent).sort(), ['actionKey', 'actorId', 'decisionId', 'targetEntityId']);
    frozen(assert, result);
  }
  // Presence is structural; selection never redoes canonical target eligibility.
  assert.equal(f.run([rule('attack')], [available('attack')], {...f.state, targetEntityId: 'stale'}).decision.intent.targetEntityId, 'stale');
  assert.equal(f.run([rule('self', 'skill', 'self')], [available('self')], {...f.state, targetEntityId: null}).decision.intent.targetEntityId, 'Actor');
  console.log('ACTOR_AI_ACTION_INTENTS_PASS');
});

contract('action: ordered priority, opaque unavailable reasons and availability-order independent fallback', assert => {
  const f = fixture(), skill = rule('skill', 'skill'), attack = rule('attack'), approach = rule('approach', 'approach_target');
  const all = [available('attack'), available('skill'), available('approach')];
  for (const facts of [all, [...all].reverse()]) {
    assert.deepEqual(f.run([skill, attack, approach], facts), selected(f, 'skill', 'skill', 'Target'));
    assert.deepEqual(f.run([attack, skill, approach], facts), selected(f, 'attack', 'basic_attack', 'Target'));
  }
  for (const reason of ['cooldown_active', 'insufficient_resource', 'restricted', 'skill_not_owned', 'actor_ineligible', 'target_ineligible', 'custom']) {
    assert.deepEqual(f.run([skill, attack], [unavailable('skill', reason), available('attack')]),
      selected(f, 'attack', 'basic_attack', 'Target', [reject('skill', 'action_unavailable')]));
  }
  assert.deepEqual(f.run([skill, attack, approach], [unavailable('skill'), unavailable('attack', 'out_of_range'), available('approach')]),
    selected(f, 'approach', 'approach_target', 'Target', [reject('skill', 'action_unavailable'), reject('attack', 'action_unavailable')]));
  // Valid later rules are not evaluated after selection or appended to diagnostics.
  assert.deepEqual(f.run([attack, skill], [available('attack')]), selected(f, 'attack', 'basic_attack', 'Target'));
  console.log('ACTOR_AI_ACTION_PRIORITY_PASS');
});

contract('action: exact rejection precedence, missing availability, no candidate and no implicit wait', assert => {
  const f = fixture(), a = rule('a'), b = rule('b', 'skill'), c = rule('c', 'approach_target');
  assert.deepEqual(f.run(), noAction());
  assert.deepEqual(f.run([rule('wait', 'wait', 'none', 'idle')], [available('wait')]), noAction());
  assert.deepEqual(f.run([a]), noAction('no_candidate', [reject('a', 'availability_missing')]));
  assert.deepEqual(f.run([a], [unavailable('a')]), noAction('no_candidate', [reject('a', 'action_unavailable')]));
  assert.deepEqual(f.run([a, b, c], [unavailable('a'), unavailable('b'), unavailable('c')]),
    noAction('no_candidate', ['a', 'b', 'c'].map(x => reject(x, 'action_unavailable'))));
  const nullTarget = {...f.state, targetEntityId: null};
  assert.deepEqual(f.run([a, b, c], [available('a'), unavailable('b')], nullTarget),
    noAction('no_candidate', ['a', 'b', 'c'].map(x => reject(x, 'target_missing'))));
  const wait = rule('wait', 'wait', 'none');
  assert.deepEqual(f.run([a, wait], [available('wait')], nullTarget),
    selected(f, 'wait', 'wait', null, [reject('a', 'target_missing')]));
  assert.deepEqual(f.run([wait]), noAction('no_candidate', [reject('wait', 'availability_missing')]));
  assert.deepEqual(f.run([wait], [unavailable('wait')]), noAction('no_candidate', [reject('wait', 'action_unavailable')]));
  const result = f.run([a]); frozen(assert, result);
  assert.deepEqual(g.validateActorAIDecisionResult(f.state, f.context, result.decision), result.decision);
  console.log('ACTOR_AI_ACTION_DIAGNOSTICS_PASS');
});

contract('action: manual gate and actor/decision/profile correlation fail closed before any outcome', assert => {
  const f = fixture({controller: 'manual'}), input = policy([rule('attack')]);
  const observed = g.createActorAIActionObservation(f.context, [available('attack')]);
  const run = (state = f.state, entities = f.entities, context = f.context, rules = input, observation = observed) =>
    g.evaluateActorAIActionSelection(state, entities, context, rules, observation);
  assert.deepEqual(run(), noAction('manual_control')); frozen(assert, run());
  assert.deepEqual(f.run(), noAction('manual_control'));
  for (const controller of ['manual', 'ai']) {
    const state = {...f.state, controller};
    assert.throws(() => run(state, undefined, {...f.context, actorId: 'wrong'}), TypeError);
    assert.throws(() => run(state, undefined, undefined, undefined, {...observed, actorId: 'wrong'}), TypeError);
    assert.throws(() => run(state, undefined, undefined, undefined, {...observed, decisionId: 'wrong'}), TypeError);
    assert.throws(() => run(state, undefined, undefined, {...input, profileId: 'wrong'}), TypeError);
    assert.throws(() => run(state, g.createEntityCollection()), TypeError);
    assert.throws(() => run({...state, actorId: 'unknown'}), TypeError);
    assert.throws(() => run(state, undefined, undefined, {...input, rules: [...input.rules, {...rule('unused'), targetMode: 'none'}]}), TypeError);
    assert.throws(() => run(state, undefined, undefined, undefined, {...observed, availability: [...observed.availability, {actionKey: 'unused', status: 'available', reasonId: 'invalid'}]}), TypeError);
  }
  console.log('ACTOR_AI_ACTION_MANUAL_PASS');
});

contract('action: closed records, dense own-data arrays, compatibility and full-input validation without getters', assert => {
  const f = fixture(), input = policy([rule('attack')]), observed = g.createActorAIActionObservation(f.context, [available('attack')]);
  let getters = 0;
  const run = (p = input, o = observed) => g.evaluateActorAIActionSelection(f.state, f.entities, f.context, p, o);
  for (const [valid, invoke] of [
    [f.state, x => g.evaluateActorAIActionSelection(x, f.entities, f.context, input, observed)],
    [f.context, x => g.createActorAIActionObservation(x, [])],
    [f.context, x => g.evaluateActorAIActionSelection(f.state, f.entities, x, input, observed)],
    [input, x => g.createActorAIActionSelectionPolicy(x)], [input, x => g.evaluateActorAIActionSelection(f.state, f.entities, f.context, x, observed)],
    [input.rules[0], x => run({...input, rules: [x]})], [observed, x => g.evaluateActorAIActionSelection(f.state, f.entities, f.context, input, x)],
    [observed.availability[0], x => run(input, {...observed, availability: [x]})],
  ]) {
    for (const bad of [null, undefined, [], 1, {...valid, extra: 1}, {...valid, [Symbol()]: 1}]) assert.throws(() => invoke(bad), TypeError);
    for (const key of Object.keys(valid)) {
      const missing = {...valid}; delete missing[key]; const accessor = {...valid};
      Object.defineProperty(accessor, key, {get() {getters++; return valid[key];}});
      assert.throws(() => invoke(missing), TypeError);
      assert.throws(() => invoke(Object.assign(Object.create({[key]: valid[key]}), missing)), TypeError);
      assert.throws(() => invoke(accessor), TypeError);
    }
    invoke(Object.assign(Object.create(null), valid));
  }
  for (const [valid, invoke] of [[input.rules, x => run({...input, rules: x})],
    [observed.availability, x => run(input, {...observed, availability: x})],
    [observed.availability, x => g.createActorAIActionObservation(f.context, x)]]) {
    const accessor = [...valid]; Object.defineProperty(accessor, '0', {get() {getters++; return valid[0];}});
    const inherited = new Array(1); Object.setPrototypeOf(inherited, {0: valid[0]});
    for (const bad of [null, {}, new Array(1), accessor, inherited, Object.assign([...valid], {extra: 1}), Object.assign([...valid], {[Symbol()]: 1})]) assert.throws(() => invoke(bad), TypeError);
  }
  for (const bad of ['', ' ', 0, null, undefined]) {
    assert.throws(() => run({...input, profileId: bad}), TypeError);
    for (const key of Object.keys(input.rules[0])) assert.throws(() => run({...input, rules: [{...input.rules[0], [key]: bad}]}), TypeError);
    for (const key of ['actorId', 'decisionId']) assert.throws(() => run(input, {...observed, [key]: bad}), TypeError);
    assert.throws(() => run(input, {...observed, availability: [{...available('x'), actionKey: bad}]}), TypeError);
    assert.throws(() => run(input, {...observed, availability: [{actionKey: 'x', status: 'unavailable', reasonId: bad}]}), TypeError);
  }
  for (const [kind, validModes] of [['basic_attack', ['current_target']], ['skill', ['current_target', 'self']], ['approach_target', ['current_target']], ['return_home', ['none']], ['wait', ['none']]]) {
    for (const mode of ['current_target', 'self', 'none']) {
      const p = policy([rule('r', kind, mode)]);
      if (validModes.includes(mode)) g.createActorAIActionSelectionPolicy(p);
      else assert.throws(() => g.createActorAIActionSelectionPolicy(p), TypeError);
    }
  }
  assert.throws(() => run({...input, rules: [rule('same'), rule('same')]}), TypeError);
  assert.throws(() => run({...input, rules: [rule('a'), rule('b', 'skill', 'current_target', 'idle', 'a')]}), TypeError);
  assert.throws(() => run({...input, rules: [rule('a', 'skill'), rule('b', 'skill', 'self', 'idle', 'a')]}), TypeError);
  assert.throws(() => run(input, {...observed, availability: [available('x'), unavailable('x')]}), TypeError);
  for (const bad of [{actionKey: 'x', status: 'available', reasonId: 'invalid'}, {actionKey: 'x', status: 'unavailable', reasonId: null}, {actionKey: 'x', status: 'unknown', reasonId: null}]) {
    assert.throws(() => run(input, {...observed, availability: [bad]}), TypeError);
  }
  // Invalid trailing data cannot hide behind an otherwise immediately selectable rule.
  assert.throws(() => run({...input, rules: [...input.rules, {...rule('bad'), actionKind: 'unknown'}]}), TypeError);
  assert.equal(getters, 0);
  console.log('ACTOR_AI_ACTION_VALIDATION_PASS');
});

contract('action: installed target/behavior composition and actor-agnostic application scenarios', assert => {
  for (const kind of ['player', 'monster', 'npc', 'pet', 'summon', 'companion', 'custom']) {
    const f = fixture({kind, behaviorStateId: 'idle', targetEntityId: null});
    const snapshot = g.createActorAIPerceptionSnapshot(f.state, {observedAtMs: 0, candidates: [
      {entityId: 'Target', relationId: 'enemy', lifeStatus: 'alive', visible: true, inRange: true, reachable: true}]});
    const assessment = g.evaluateActorAIPerception(f.state, f.entities, snapshot,
      {allowedRelationIds: ['enemy'], allowedLifeStatuses: ['alive'], requireVisible: true, requireInRange: true, requireReachable: true, allowSelf: false});
    const target = g.evaluateActorAITargetSelection(f.state, f.entities, assessment, {retention: 'prefer_priority', preferredTargetIds: []});
    assert.equal(target.reason, 'acquired');
    const behavior = g.evaluateActorAIBehaviorTransition(target.state, f.entities,
      g.createActorAIBehaviorObservation(target.state, ['accepted-target']), {profileId: 'P', stateIds: ['idle', 'engaged'], rules: [
        {ruleId: 'engage', fromStateId: 'idle', triggerId: 'accepted-target', toStateId: 'engaged', targetRequirement: 'present'}]});
    assert.equal(behavior.status, 'transitioned');
    const rules = [rule('primary', 'skill'), rule('attack'), rule('approach', 'approach_target')];
    assert.deepEqual(f.run(rules, [available('primary'), available('attack')], behavior.state), selected(f, 'primary', 'skill', 'Target'));
    assert.deepEqual(f.run(rules, [unavailable('primary'), available('attack')], behavior.state), selected(f, 'attack', 'basic_attack', 'Target', [reject('primary', 'action_unavailable')]));
    assert.deepEqual(f.run(rules, [unavailable('primary'), unavailable('attack', 'out_of_range'), available('approach')], behavior.state),
      selected(f, 'approach', 'approach_target', 'Target', [reject('primary', 'action_unavailable'), reject('attack', 'action_unavailable')]));
    assert.deepEqual(f.run([rule('support', 'skill', 'self')], [available('support')], behavior.state), selected(f, 'support', 'skill', 'Actor'));
    assert.deepEqual(f.run([rule('home', 'return_home', 'none', 'returning')], [available('home')], {...behavior.state, behaviorStateId: 'returning'}), selected(f, 'home', 'return_home', null));
    assert.deepEqual(f.run(rules, [unavailable('primary'), unavailable('attack'), unavailable('approach')], behavior.state),
      noAction('no_candidate', ['primary', 'attack', 'approach'].map(x => reject(x, 'action_unavailable'))));
    assert.deepEqual(f.run(rules, [available('primary')], {...behavior.state, controller: 'manual'}), noAction('manual_control'));
    assert.equal(f.state.behaviorStateId, 'idle'); assert.equal(f.state.targetEntityId, null);
  }
  console.log('ACTOR_AI_ACTION_COMPOSITION_PASS');
});

contract('action: installed execution boundary, owner preservation, immutable snapshots and independent replay', assert => {
  const source = readFileSync(new URL('./modules/actor-ai/index.js', import.meta.resolve('@rpg/gameplay')), 'utf8');
  assert.deepEqual([...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(m => m[1]), ['../entity/index.js']);
  const action = source.slice(source.indexOf('function actionRule('));
  assert.doesNotMatch(action, /\b(?:activateSkill|startSkillCooldown|resolveCombatAttack|applyCombatAttackDamage|applyEffect|transitionEntityResource|dispatchCommand|evaluateActorAIPerception|evaluateActorAITargetSelection|evaluateActorAIBehaviorTransition)\s*\(/);
  function session() {
    const f = fixture(), p = policy([rule('unavailable', 'skill'), rule('attack')]);
    const o = {...f.context, availability: [unavailable('unavailable'), available('attack')]};
    const owners = {state: f.state, entities: f.entities,
      resources: g.createEntityResourceState(f.actor, {health: {minimum: 0, maximum: 100, current: 5}}),
      life: g.createEntityLifeState(f.actor, {status: 'alive'}), effects: g.createEffectState(f.actor),
      cooldown: g.createSkillCooldownState({instanceId: 'skill-instance', skillId: 'skill', entityId: 'Actor'}),
      world: {position: [10, 20], home: [0, 0]}};
    const before = structuredClone(owners), originalP = structuredClone(p), originalO = structuredClone(o);
    const result = g.evaluateActorAIActionSelection(f.state, f.entities, f.context, p, o);
    assert.deepEqual(result, selected(f, 'attack', 'basic_attack', 'Target', [reject('unavailable', 'action_unavailable')]));
    assert.deepEqual(owners, before); assert.deepEqual(p, originalP); assert.deepEqual(o, originalO); frozen(assert, result);
    p.rules.reverse(); p.rules[0].actionKey = 'changed'; o.availability[0].reasonId = 'changed'; o.availability.length = 0;
    f.state.behaviorStateId = 'changed'; f.context.decisionId = 'changed';
    assert.deepEqual(result.decision.intent, {decisionId: 'decision-001', actorId: 'Actor', actionKey: 'attack', targetEntityId: 'Target'});
    assert.deepEqual(result.rejected, [reject('unavailable', 'action_unavailable')]);
    assert.equal(Object.isFrozen(p.rules), false); assert.equal(Object.isFrozen(o.availability), false);
    return result;
  }
  const old = [Date.now, Math.random, globalThis.setTimeout, globalThis.setInterval]; let a, b;
  try {
    Date.now = Math.random = globalThis.setTimeout = globalThis.setInterval = () => {throw Error('implicit provider');};
    a = session(); b = session();
  } finally {[Date.now, Math.random, globalThis.setTimeout, globalThis.setInterval] = old;}
  assert.deepEqual(a, b); assert.notEqual(a, b); assert.notEqual(a.decision.intent, b.decision.intent); assert.notEqual(a.rejected[0], b.rejected[0]);
  console.log('ACTOR_AI_ACTION_REPLAY_PASS');
});
