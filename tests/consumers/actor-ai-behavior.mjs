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
    assert.ok(assertions > 0, 'Behavior contract requires actual assertions');
  });
}
const rule = (ruleId, fromStateId, triggerId, toStateId, targetRequirement = 'any') =>
  ({ruleId, fromStateId, triggerId, toStateId, targetRequirement});
const policy = (rules = [], profileId = 'P', stateIds = ['idle', 'engaged', 'returning', 'guarding']) => ({profileId, stateIds, rules});
function fixture(behaviorStateId = 'idle', targetEntityId = 'Target', controller = 'ai', kind = 'player', profileId = 'P') {
  const actor = g.createEntity({id: 'Actor', kind});
  const state = {...g.createActorAIState(actor, {profileId}, {controller, behaviorStateId}), targetEntityId};
  const entities = g.addEntity(g.addEntity(g.createEntityCollection(), actor), {id: 'Target', kind: 'custom'});
  const evaluate = (triggers, rules = policy(), current = state) => g.evaluateActorAIBehaviorTransition(current, entities,
    g.createActorAIBehaviorObservation(current, triggers), rules);
  return {actor, state, entities, evaluate};
}
function outcome(state, nextBehaviorStateId, status, reason, ruleId = null, triggerId = null) {
  return {status, reason, ruleId, triggerId, previousBehaviorStateId: state.behaviorStateId,
    nextBehaviorStateId, state: {...state, behaviorStateId: nextBehaviorStateId}};
}
function frozen(assert, value) {
  if (value && typeof value === 'object') {assert.ok(Object.isFrozen(value)); Object.values(value).forEach(x => frozen(assert, x));}
}

contract('behavior: generic policy and observation capture preserve exact identities and ordered data', assert => {
  const input = policy([rule(' custom-rule ', 'idle', ' custom-trigger ', 'following-owner')],
    ' custom-profile ', ['idle', 'Idle', 'following-owner', '__proto__']);
  const captured = g.createActorAIBehaviorPolicy(input);
  assert.deepEqual(captured, input); assert.notEqual(captured, input); assert.notEqual(captured.rules[0], input.rules[0]); frozen(assert, captured);
  input.stateIds.reverse(); input.rules[0].toStateId = 'Idle';
  assert.equal(captured.rules[0].toStateId, 'following-owner'); assert.deepEqual(captured.stateIds, ['idle', 'Idle', 'following-owner', '__proto__']);
  const f = fixture('following-owner', null, 'ai', 'custom', ' custom-profile ');
  const triggers = ['custom', 'Custom', ' custom ', '__proto__'];
  const observed = g.createActorAIBehaviorObservation(f.state, triggers);
  assert.deepEqual(observed, {actorId: 'Actor', triggerIds: ['custom', 'Custom', ' custom ', '__proto__']});
  frozen(assert, observed); triggers.reverse(); assert.equal(observed.triggerIds[0], 'custom');
  assert.deepEqual(f.evaluate([], captured), outcome(f.state, 'following-owner', 'unchanged', 'no_trigger'));
  assert.deepEqual(g.createActorAIBehaviorPolicy(policy([], 'empty', [])), {profileId: 'empty', stateIds: [], rules: []});
  assert.equal(Object.isFrozen(input.rules), false); assert.equal(Object.isFrozen(triggers), false);
  console.log('ACTOR_AI_BEHAVIOR_CAPTURE_PASS');
});

contract('behavior: ordered first match, all target guards, no trigger, no match and same-state outcomes', assert => {
  const f = fixture(), acquire = rule('acquire', 'idle', 'target_acquired', 'engaged', 'present');
  assert.deepEqual(f.evaluate(['target_acquired'], policy([acquire])), outcome(f.state, 'engaged', 'transitioned', 'rule_matched', 'acquire', 'target_acquired'));
  assert.deepEqual(f.evaluate([], policy([acquire])), outcome(f.state, 'idle', 'unchanged', 'no_trigger'));
  assert.deepEqual(f.evaluate(['unknown'], policy([acquire])), outcome(f.state, 'idle', 'unchanged', 'no_matching_rule'));
  const noTarget = fixture('idle', null);
  assert.deepEqual(noTarget.evaluate(['target_acquired'], policy([acquire])), outcome(noTarget.state, 'idle', 'unchanged', 'no_matching_rule'));
  const absent = rule('absent', 'idle', 'target_acquired', 'returning', 'absent');
  assert.deepEqual(noTarget.evaluate(['target_acquired'], policy([acquire, absent])), outcome(noTarget.state, 'returning', 'transitioned', 'rule_matched', 'absent', 'target_acquired'));
  assert.deepEqual(f.evaluate(['target_acquired'], policy([absent])), outcome(f.state, 'idle', 'unchanged', 'no_matching_rule'));
  // Target guard is presence only, never a second perception/existence check.
  const stale = fixture('idle', 'stale');
  assert.equal(stale.evaluate(['target_acquired'], policy([acquire])).status, 'transitioned');
  const engaged = fixture('engaged'), leash = rule('leash', 'engaged', 'leash_exceeded', 'returning');
  const lost = rule('lost', 'engaged', 'target_lost', 'idle');
  for (const triggers of [['target_lost', 'leash_exceeded'], ['leash_exceeded', 'target_lost']]) {
    assert.deepEqual(engaged.evaluate(triggers, policy([leash, lost])), outcome(engaged.state, 'returning', 'transitioned', 'rule_matched', 'leash', 'leash_exceeded'));
    assert.deepEqual(engaged.evaluate(triggers, policy([lost, leash])), outcome(engaged.state, 'idle', 'transitioned', 'rule_matched', 'lost', 'target_lost'));
  }
  // A high-priority self-transition wins; do not continue to a changing rule.
  const self = rule('self', 'idle', 'tick', 'idle');
  assert.deepEqual(f.evaluate(['tick'], policy([self, rule('later', 'idle', 'tick', 'engaged')])),
    outcome(f.state, 'idle', 'unchanged', 'same_state', 'self', 'tick'));
  assert.equal(f.evaluate(['target_acquired'], policy([rule('wrong-source', 'engaged', 'target_acquired', 'returning'), acquire])).ruleId, 'acquire');
  console.log('ACTOR_AI_BEHAVIOR_RULES_PASS');
});

contract('behavior: passive, aggressive and defensive profiles are L3 data on the same evaluator', assert => {
  const aggressive = policy([rule('aggro', 'idle', 'target_acquired', 'engaged', 'present')], 'aggressive');
  const defensive = policy([rule('defend', 'idle', 'provoked', 'engaged', 'present')], 'defensive');
  const passive = policy([], 'passive');
  for (const kind of ['player', 'monster', 'npc', 'pet', 'summon', 'companion', 'custom']) {
    const a = fixture('idle', 'Target', 'ai', kind, 'aggressive');
    const d = fixture('idle', 'Target', 'ai', kind, 'defensive');
    const p = fixture('idle', 'Target', 'ai', kind, 'passive');
    assert.deepEqual(a.evaluate(['target_acquired'], aggressive), outcome(a.state, 'engaged', 'transitioned', 'rule_matched', 'aggro', 'target_acquired'));
    assert.deepEqual(d.evaluate(['target_acquired'], defensive), outcome(d.state, 'idle', 'unchanged', 'no_matching_rule'));
    assert.deepEqual(d.evaluate(['provoked'], defensive), outcome(d.state, 'engaged', 'transitioned', 'rule_matched', 'defend', 'provoked'));
    assert.deepEqual(p.evaluate(['target_acquired', 'provoked'], passive), outcome(p.state, 'idle', 'unchanged', 'no_matching_rule'));
  }
  console.log('ACTOR_AI_BEHAVIOR_PROFILES_PASS');
});

contract('behavior: explicit target-selection composition, disengage and complete idle/guard return timelines', assert => {
  for (const initial of ['idle', 'guarding']) {
    const f = fixture(initial, null), trigger = initial === 'idle' ? 'target_acquired' : 'provoked';
    const rules = policy([rule('enter', initial, trigger, 'engaged', 'present'),
      rule('lost', 'engaged', 'target_lost', 'returning', 'absent'),
      rule('disengage', 'engaged', 'disengage_requested', 'returning'),
      rule('leash', 'engaged', 'leash_exceeded', 'returning'),
      rule('home', 'returning', 'return_completed', initial)]);
    assert.deepEqual(f.evaluate([], rules), outcome(f.state, initial, 'unchanged', 'no_trigger'));
    const assess = (state, candidates) => g.evaluateActorAIPerception(state, f.entities,
      g.createActorAIPerceptionSnapshot(state, {observedAtMs: 0, candidates}),
      {allowedRelationIds: ['enemy'], allowedLifeStatuses: ['alive'], requireVisible: true, requireInRange: true, requireReachable: true, allowSelf: false});
    const selected = g.evaluateActorAITargetSelection(f.state, f.entities, assess(f.state,
      [{entityId: 'Target', relationId: 'enemy', lifeStatus: 'alive', visible: true, inRange: true, reachable: true}]),
      {retention: 'prefer_priority', preferredTargetIds: []});
    assert.equal(selected.reason, 'acquired'); assert.equal(selected.state.behaviorStateId, initial);
    // No trigger is invented merely because a target is present.
    assert.deepEqual(f.evaluate([], rules, selected.state), outcome(selected.state, initial, 'unchanged', 'no_trigger'));
    const engaged = f.evaluate([trigger], rules, selected.state);
    assert.deepEqual(engaged, outcome(selected.state, 'engaged', 'transitioned', 'rule_matched', 'enter', trigger));
    for (const event of ['disengage_requested', 'leash_exceeded']) {
      const returning = f.evaluate([event], rules, engaged.state);
      assert.deepEqual(returning, outcome(engaged.state, 'returning', 'transitioned', 'rule_matched', event === 'leash_exceeded' ? 'leash' : 'disengage', event));
      assert.equal(returning.state.targetEntityId, 'Target');
    }
    const cleared = g.evaluateActorAITargetSelection(engaged.state, f.entities, assess(engaged.state, []),
      {retention: 'retain_if_eligible', preferredTargetIds: []});
    assert.equal(cleared.reason, 'target_lost'); assert.equal(cleared.state.behaviorStateId, 'engaged');
    const returning = f.evaluate(['target_lost'], rules, cleared.state);
    assert.deepEqual(returning, outcome(cleared.state, 'returning', 'transitioned', 'rule_matched', 'lost', 'target_lost'));
    assert.deepEqual(f.evaluate(['return_completed'], rules, returning.state), outcome(returning.state, initial, 'transitioned', 'rule_matched', 'home', 'return_completed'));
    assert.equal(f.state.targetEntityId, null); assert.equal(f.state.behaviorStateId, initial);
  }
  console.log('ACTOR_AI_BEHAVIOR_COMPOSITION_PASS');
});

contract('behavior: manual control blocks every valid outcome after complete binding and membership validation', assert => {
  const f = fixture('idle', 'Target', 'manual'), input = policy([rule('enter', 'idle', 'go', 'engaged')]);
  for (const triggers of [[], ['unknown'], ['go']]) {
    assert.deepEqual(f.evaluate(triggers, input), {status: 'blocked', reason: 'manual_control', ruleId: null, triggerId: null,
      previousBehaviorStateId: 'idle', nextBehaviorStateId: null, state: null});
  }
  const observed = g.createActorAIBehaviorObservation(f.state, ['go']);
  const run = (state = f.state, entities = f.entities, observation = observed, rules = input) =>
    g.evaluateActorAIBehaviorTransition(state, entities, observation, rules);
  assert.throws(() => run(undefined, undefined, undefined, {...input, profileId: 'wrong'}), TypeError);
  assert.throws(() => run({...f.state, behaviorStateId: 'unknown'}), TypeError);
  assert.throws(() => run(undefined, undefined, {...observed, actorId: 'other'}), TypeError);
  assert.throws(() => run(undefined, g.createEntityCollection()), TypeError);
  assert.throws(() => run(undefined, undefined, undefined, {...input, rules: [...input.rules, rule('unused-invalid', 'idle', 'unused', 'unknown')]}), TypeError);
  assert.equal(f.state.behaviorStateId, 'idle');
  console.log('ACTOR_AI_BEHAVIOR_MANUAL_PASS');
});

contract('behavior: closed own-data records, dense arrays and fail-closed profile/state/rule/trigger validation', assert => {
  const f = fixture(), input = policy([rule('enter', 'idle', 'go', 'engaged')]);
  const observed = g.createActorAIBehaviorObservation(f.state, ['go']); let getters = 0;
  const cases = [
    [f.state, x => g.createActorAIBehaviorObservation(x, ['go'])],
    [f.state, x => g.evaluateActorAIBehaviorTransition(x, f.entities, observed, input)],
    [input, x => g.createActorAIBehaviorPolicy(x)],
    [input, x => g.evaluateActorAIBehaviorTransition(f.state, f.entities, observed, x)],
    [input.rules[0], x => g.createActorAIBehaviorPolicy({...input, rules: [x]})],
    [observed, x => g.evaluateActorAIBehaviorTransition(f.state, f.entities, x, input)],
  ];
  for (const [valid, invoke] of cases) {
    for (const bad of [null, undefined, [], 3, {...valid, extra: 1}, {...valid, [Symbol('extra')]: 1}]) assert.throws(() => invoke(bad), TypeError);
    for (const key of Object.keys(valid)) {
      const missing = {...valid}; delete missing[key];
      const accessor = {...valid}; Object.defineProperty(accessor, key, {get() {getters++; return valid[key];}});
      assert.throws(() => invoke(missing), TypeError);
      assert.throws(() => invoke(Object.assign(Object.create({[key]: valid[key]}), missing)), TypeError);
      assert.throws(() => invoke(accessor), TypeError);
    }
    invoke(Object.assign(Object.create(null), valid));
  }
  for (const [valid, invoke] of [
    [input.stateIds, x => g.createActorAIBehaviorPolicy({...input, stateIds: x})],
    [input.rules, x => g.createActorAIBehaviorPolicy({...input, rules: x})],
    [observed.triggerIds, x => g.createActorAIBehaviorObservation(f.state, x)],
    [observed.triggerIds, x => g.evaluateActorAIBehaviorTransition(f.state, f.entities, {...observed, triggerIds: x}, input)],
  ]) {
    const accessor = [...valid]; Object.defineProperty(accessor, '0', {get() {getters++; return valid[0];}});
    const inherited = new Array(1); Object.setPrototypeOf(inherited, {0: valid[0]});
    for (const bad of [null, {}, new Array(1), accessor, inherited, Object.assign([...valid], {extra: 1}), Object.assign([...valid], {[Symbol()]: 1})]) {
      assert.throws(() => invoke(bad), TypeError);
    }
  }
  for (const bad of ['', ' ', 1, null, undefined]) {
    assert.throws(() => g.createActorAIBehaviorPolicy({...input, profileId: bad}), TypeError);
    assert.throws(() => g.createActorAIBehaviorPolicy({...input, stateIds: [bad]}), TypeError);
    assert.throws(() => g.createActorAIBehaviorObservation(f.state, [bad]), TypeError);
    assert.throws(() => g.evaluateActorAIBehaviorTransition(f.state, f.entities, {...observed, actorId: bad}, input), TypeError);
    for (const key of Object.keys(input.rules[0])) assert.throws(() => g.createActorAIBehaviorPolicy({...input, rules: [{...input.rules[0], [key]: bad}]}), TypeError);
  }
  for (const bad of [policy([], 'wrong'), policy([], 'P', ['Idle']), {...input, rules: [rule('x', 'unknown', 'go', 'engaged')]},
    {...input, rules: [rule('x', 'idle', 'go', 'unknown')]}, {...input, rules: [rule('x', 'idle', 'go', 'engaged', 'alive')]},
    {...input, stateIds: ['idle', 'idle']}, {...input, rules: [input.rules[0], input.rules[0]]}]) {
    assert.throws(() => g.evaluateActorAIBehaviorTransition(f.state, f.entities, observed, bad), TypeError);
  }
  assert.throws(() => g.createActorAIBehaviorObservation(f.state, ['go', 'go']), TypeError);
  assert.throws(() => g.evaluateActorAIBehaviorTransition(f.state, f.entities, {...observed, triggerIds: ['go', 'go']}, input), TypeError);
  assert.throws(() => g.evaluateActorAIBehaviorTransition(f.state, {entities: [f.actor, f.actor]}, observed, input), TypeError);
  assert.throws(() => g.evaluateActorAIBehaviorTransition({...f.state, actorId: 'unknown'}, f.entities, observed, input), TypeError);
  assert.equal(getters, 0);
  console.log('ACTOR_AI_BEHAVIOR_VALIDATION_PASS');
});

contract('behavior: installed execution boundary, immutable owner preservation and independent deterministic replay', assert => {
  // Check actual installed executable dependencies, alongside runtime owner preservation.
  const source = readFileSync(new URL('./modules/actor-ai/index.js', import.meta.resolve('@rpg/gameplay')), 'utf8');
  assert.deepEqual([...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(m => m[1]), ['../entity/index.js']);
  const behavior = source.slice(source.indexOf('function behaviorIds('));
  assert.doesNotMatch(behavior, /\b(?:activateSkill|resolveCombatAttack|applyCombatAttackDamage|applyEffect|transitionEntityResource|dispatchCommand|evaluateActorAITargetSelection|evaluateActorAIPerception)\s*\(/);
  function session() {
    const f = fixture(), input = policy([rule('enter', 'idle', 'go', 'engaged')]), triggers = ['go'];
    const captured = g.createActorAIBehaviorPolicy(input), observation = g.createActorAIBehaviorObservation(f.state, triggers);
    const mutableObservation = {actorId: observation.actorId, triggerIds: [...observation.triggerIds]};
    const owners = {entities: f.entities, state: f.state,
      resources: g.createEntityResourceState(f.actor, {health: {minimum: 0, maximum: 100, current: 5}}),
      life: g.createEntityLifeState(f.actor, {status: 'alive'}), effects: g.createEffectState(f.actor),
      world: {position: [12, 4], home: [0, 0]},
      cooldown: g.createSkillCooldownState({instanceId: 'cast', skillId: 'skill', entityId: 'Actor'})};
    const before = structuredClone(owners), originalPolicy = structuredClone(input), originalObservation = structuredClone(mutableObservation);
    const result = g.evaluateActorAIBehaviorTransition(f.state, f.entities, mutableObservation, input);
    assert.deepEqual(result, outcome(before.state, 'engaged', 'transitioned', 'rule_matched', 'enter', 'go'));
    assert.deepEqual(owners, before); assert.deepEqual(input, originalPolicy); assert.deepEqual(mutableObservation, originalObservation);
    frozen(assert, result); frozen(assert, captured); frozen(assert, observation); assert.notEqual(result.state, f.state);
    f.state.profileId = 'changed'; input.rules[0].toStateId = 'returning'; input.stateIds.reverse(); mutableObservation.triggerIds.length = 0; triggers.length = 0;
    assert.equal(captured.rules[0].toStateId, 'engaged'); assert.deepEqual(observation.triggerIds, ['go']);
    assert.deepEqual(result, outcome(before.state, 'engaged', 'transitioned', 'rule_matched', 'enter', 'go'));
    assert.equal(Object.isFrozen(input.rules), false); assert.equal(Object.isFrozen(mutableObservation.triggerIds), false);
    const unchanged = f.evaluate([], policy(), before.state);
    assert.deepEqual(unchanged, outcome(before.state, 'idle', 'unchanged', 'no_trigger')); frozen(assert, unchanged); assert.notEqual(unchanged.state, before.state);
    return {captured, observation, result, unchanged};
  }
  const old = [Date.now, Math.random, globalThis.setTimeout, globalThis.setInterval]; let a, b;
  try {
    Date.now = Math.random = globalThis.setTimeout = globalThis.setInterval = () => {throw Error('implicit execution provider');};
    a = session(); b = session();
  } finally {[Date.now, Math.random, globalThis.setTimeout, globalThis.setInterval] = old;}
  assert.deepEqual(a, b);
  for (const key of Object.keys(a)) assert.notEqual(a[key], b[key]);
  assert.notEqual(a.captured.rules[0], b.captured.rules[0]); assert.notEqual(a.result.state, b.result.state);
  console.log('ACTOR_AI_BEHAVIOR_REPLAY_PASS');
});
