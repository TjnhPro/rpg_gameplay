import assert from 'node:assert/strict';
import test from 'node:test';
import * as g from '@rpg/gameplay';

function contract(name, run) {
  test(name, () => {
    let assertions = 0;
    const checked = new Proxy(assert, {get(target, key) {
      return (...args) => {assertions++; return Reflect.get(target, key)(...args);};
    }});
    run(checked);
    assert.ok(assertions > 0, 'Target selection contract requires actual assertions');
  });
}
const fact = (entityId, changes = {}) => ({entityId, relationId: 'enemy', lifeStatus: 'alive',
  visible: true, inRange: true, reachable: true, ...changes});
const rules = (preferredTargetIds = [], retention = 'prefer_priority') => ({retention, preferredTargetIds});
function fixture(targetEntityId = null, controller = 'ai', kind = 'player') {
  const actor = g.createEntity({id: 'Actor', kind});
  const state = {...g.createActorAIState(actor, {profileId: ' profile '}, {controller, behaviorStateId: ' custom-state '}), targetEntityId};
  const entities = ['A', 'B', 'C', 'blocked', 'a', ' A ', 'é', 'Z', '__proto__'].reduce((list, id) =>
    g.addEntity(list, {id, kind: 'custom'}), g.addEntity(g.createEntityCollection(), actor));
  const perception = (candidates, policy = {}) => g.evaluateActorAIPerception(state, entities,
    g.createActorAIPerceptionSnapshot(state, {observedAtMs: 1200, candidates}),
    {allowedRelationIds: ['enemy'], allowedLifeStatuses: ['alive'], requireVisible: true, requireInRange: true,
      requireReachable: true, allowSelf: false, ...policy});
  const select = (assessment, policy = rules()) => g.evaluateActorAITargetSelection(state, entities, assessment, policy);
  return {actor, state, entities, perception, select};
}
function expected(state, selectedTargetEntityId, reason, lossReason = null) {
  return {status: selectedTargetEntityId === null ? 'no_target' : 'selected', reason,
    previousTargetEntityId: state.targetEntityId, selectedTargetEntityId, lossReason,
    state: {...state, targetEntityId: selectedTargetEntityId}};
}
function frozen(assert, input) {
  if (input && typeof input === 'object') {assert.ok(Object.isFrozen(input)); Object.values(input).forEach(value => frozen(assert, value));}
}

contract('target selection: acquisition, explicit priority and locale-independent lexical fallback', assert => {
  const f = fixture(), perception = f.perception([fact('C'), fact('A'), fact('B'), fact('blocked', {visible: false})]);
  assert.deepEqual(f.select(f.perception([fact('B')])), expected(f.state, 'B', 'acquired'));
  assert.deepEqual(f.select(perception, rules(['C', 'A', 'B'])), expected(f.state, 'C', 'acquired'));
  assert.deepEqual(f.select(perception, rules(['absent', 'blocked', 'B', 'A'])), expected(f.state, 'B', 'acquired'));
  assert.deepEqual(f.select(perception, rules(['absent', 'blocked'])), expected(f.state, 'A', 'acquired'));
  assert.deepEqual(f.select(perception, rules()), expected(f.state, 'A', 'acquired'));
  assert.deepEqual(f.select(f.perception([])), expected(f.state, null, 'no_candidates'));
  assert.deepEqual(f.select(f.perception([fact('blocked', {visible: false})]), rules(['blocked'])), expected(f.state, null, 'no_candidates'));
  // Independent literal oracle also distinguishes lexical comparison from localeCompare.
  assert.equal(f.select(f.perception([fact('é'), fact('a'), fact('Z')])).selectedTargetEntityId, 'Z');
  assert.equal(f.select(f.perception([fact('A'), fact(' A ')])).selectedTargetEntityId, ' A ');
  assert.equal(f.select(perception, rules(['a', 'B'])).selectedTargetEntityId, 'B');
  assert.equal(f.select(f.perception([fact('__proto__')]), rules(['__proto__'])).selectedTargetEntityId, '__proto__');
  assert.deepEqual(perception.eligible.map(x => x.entityId), ['C', 'A', 'B']);
  console.log('ACTOR_AI_TARGET_PRIORITY_PASS');
});

contract('target selection: retention versus switching, reordered inputs and fresh policy without cached ranking', assert => {
  const f = fixture('B'), first = f.perception([fact('C'), fact('B'), fact('A')]);
  for (const ids of [[], ['A', 'B'], ['missing', 'C']]) {
    assert.deepEqual(f.select(first, rules(ids, 'retain_if_eligible')), expected(f.state, 'B', 'retained'));
  }
  assert.deepEqual(f.select(first, rules(['A', 'B'])), expected(f.state, 'A', 'switched'));
  assert.deepEqual(f.select(first, rules(['B', 'A'])), expected(f.state, 'B', 'retained'));
  assert.deepEqual(f.select(first, rules()), expected(f.state, 'A', 'switched'));
  for (const facts of [[fact('A'), fact('C'), fact('B')], [fact('B'), fact('A'), fact('C')]]) {
    assert.deepEqual(f.select(f.perception(facts), rules(['C'])), expected(f.state, 'C', 'switched'));
    assert.deepEqual(f.select(f.perception(facts)), expected(f.state, 'A', 'switched'));
  }
  const mutable = rules(['C']);
  assert.equal(f.select(first, mutable).selectedTargetEntityId, 'C');
  mutable.preferredTargetIds.splice(0, 1, 'A');
  assert.equal(f.select(first, mutable).selectedTargetEntityId, 'A');
  const allowed = f.perception([fact('B', {visible: false, inRange: false, reachable: false, lifeStatus: 'dead', relationId: 'custom'})],
    {requireVisible: false, requireInRange: false, requireReachable: false, allowedLifeStatuses: ['dead'], allowedRelationIds: ['custom']});
  assert.deepEqual(f.select(allowed, rules([], 'retain_if_eligible')), expected(f.state, 'B', 'retained'));
  assert.equal(f.state.targetEntityId, 'B');
  console.log('ACTOR_AI_TARGET_RETENTION_PASS');
});

contract('target selection: all canonical loss reasons, replacement and clearing only the candidate', assert => {
  const cases = [
    ['missing', fact('missing'), 'entity_not_found'], ['Actor', fact('Actor'), 'self_not_allowed'],
    ['B', fact('B', {lifeStatus: 'dead'}), 'target_life_not_allowed'],
    ['B', fact('B', {relationId: 'neutral'}), 'relation_not_allowed'],
    ['B', fact('B', {visible: false}), 'target_not_visible'],
    ['B', fact('B', {inRange: false}), 'target_out_of_range'],
    ['B', fact('B', {reachable: false}), 'target_not_reachable'],
  ];
  for (const [previous, excluded, reason] of cases) {
    const f = fixture(previous), before = structuredClone(f.state);
    for (const retention of ['retain_if_eligible', 'prefer_priority']) {
      assert.deepEqual(f.select(f.perception([excluded]), rules([previous], retention)), expected(f.state, null, 'target_lost', reason));
      assert.deepEqual(f.select(f.perception([excluded, fact('C')]), rules([previous], retention)), expected(f.state, 'C', 'switched', reason));
    }
    assert.deepEqual(f.state, before);
  }
  const absent = fixture('not-observed');
  assert.deepEqual(absent.select(absent.perception([])), expected(absent.state, null, 'target_lost', 'not_perceived'));
  assert.deepEqual(absent.select(absent.perception([fact('A')])), expected(absent.state, 'A', 'switched', 'not_perceived'));
  console.log('ACTOR_AI_TARGET_LOSS_PASS');
});

contract('target selection: manual controller never gets a candidate and malformed inputs still reject', assert => {
  for (const previous of [null, 'A', 'stale']) {
    const f = fixture(previous, 'manual'), before = structuredClone(f.state);
    for (const candidates of [[], [fact('C')], [fact('A', {visible: false})]]) {
      const assessment = f.perception(candidates);
      const result = f.select(assessment, rules(['C']));
      assert.deepEqual(result, {status: 'blocked', reason: 'manual_control', previousTargetEntityId: previous,
        selectedTargetEntityId: null, lossReason: null, state: null});
      frozen(assert, result); assert.deepEqual(f.state, before);
      assert.throws(() => f.select({...assessment, actorId: 'wrong'}), TypeError);
      assert.throws(() => f.select(assessment, {...rules(), retention: 'default'}), TypeError);
    }
  }
  console.log('ACTOR_AI_TARGET_MANUAL_PASS');
});

contract('target selection: assessment integrity, closed records, complete policy and zero getter execution', assert => {
  const f = fixture(), assessment = f.perception([fact('A'), fact('blocked', {visible: false})]); let getters = 0;
  const run = (state, entities, perception, policy) => g.evaluateActorAITargetSelection(state, entities, perception, policy);
  const cases = [
    [f.state, x => run(x, f.entities, assessment, rules())],
    [assessment, x => run(f.state, f.entities, x, rules())],
    [assessment.eligible[0], x => f.select({...assessment, eligible: [x]})],
    [assessment.excluded[0], x => f.select({...assessment, excluded: [x]})],
    [rules(['A']), x => run(f.state, f.entities, assessment, x)],
  ];
  for (const [valid, invoke] of cases) {
    for (const bad of [null, undefined, [], 'bad', {...valid, extra: 1}, {...valid, [Symbol('extra')]: 1}]) assert.throws(() => invoke(bad), TypeError);
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
    [[fact('A')], x => f.select({...assessment, eligible: x})],
    [[{entityId: 'blocked', reason: 'target_not_visible'}], x => f.select({...assessment, excluded: x})],
    [['A'], x => f.select(assessment, rules(x))],
  ]) {
    const accessor = [...valid]; Object.defineProperty(accessor, '0', {get() {getters++; return valid[0];}});
    const inherited = new Array(1); Object.setPrototypeOf(inherited, {0: valid[0]});
    for (const bad of [null, {}, new Array(1), accessor, inherited, Object.assign([...valid], {extra: 1}),
      Object.assign([...valid], {[Symbol('extra')]: 1})]) assert.throws(() => invoke(bad), TypeError);
  }
  for (const value of ['', ' ', null, 3]) {
    assert.throws(() => f.select(assessment, rules([value])), TypeError);
    assert.throws(() => f.select({...assessment, actorId: value}), TypeError);
    assert.throws(() => f.select({...assessment, excluded: [{entityId: value, reason: 'target_not_visible'}]}), TypeError);
  }
  assert.throws(() => f.select(assessment, rules(['A', 'A'])), TypeError);
  assert.throws(() => f.select({...assessment, actorId: 'other'}), TypeError);
  assert.throws(() => run({...f.state, actorId: 'unknown'}, f.entities, assessment, rules()), TypeError);
  assert.throws(() => run(f.state, g.createEntityCollection(), assessment, rules()), TypeError);
  assert.throws(() => run(f.state, {entities: [f.actor, f.actor]}, assessment, rules()), TypeError);
  for (const time of [-1, Infinity, NaN, null, '1200']) assert.throws(() => f.select({...assessment, observedAtMs: time}), TypeError);
  for (const reason of ['not_perceived', 'dead', null, 1]) assert.throws(() => f.select({...assessment, excluded: [{entityId: 'blocked', reason}]}), TypeError);
  for (const changes of [{entityId: ''}, {relationId: ''}, {lifeStatus: 'ghost'}, {visible: 1}, {inRange: null}, {reachable: 'true'}]) {
    assert.throws(() => f.select({...assessment, eligible: [fact('A', changes)]}), TypeError);
  }
  for (const changes of [
    {eligible: [fact('A'), fact('A')]},
    {excluded: [assessment.excluded[0], assessment.excluded[0]]},
    {excluded: [{entityId: 'A', reason: 'target_not_visible'}]},
  ]) assert.throws(() => f.select({...assessment, ...changes}), TypeError);
  for (const base of [assessment, f.perception([]), f.perception([fact('blocked', {visible: false})])]) {
    for (const status of ['candidates_available', 'no_candidates', 'unknown']) {
      for (const reason of ['none', 'no_perceived_entities', 'no_eligible_candidates', 'unknown']) {
        if (status === base.status && reason === base.reason) continue;
        assert.throws(() => f.select({...base, status, reason}), TypeError);
      }
    }
  }
  assert.equal(getters, 0);
  console.log('ACTOR_AI_TARGET_VALIDATION_PASS');
});

contract('target selection: actor-agnostic replay, detached immutable state and canonical owner preservation', assert => {
  function session(kind) {
    const f = fixture('B', 'ai', kind), policy = rules(['C']);
    const source = JSON.parse(JSON.stringify(f.perception([fact('C'), fact('B'), fact('blocked', {visible: false})])));
    const owners = {state: f.state, entities: f.entities,
      resources: g.createEntityResourceState(f.actor, {health: {minimum: 0, maximum: 100, current: 5}}),
      life: g.createEntityLifeState(f.actor, {status: 'alive'})};
    const before = structuredClone(owners), originalAssessment = structuredClone(source), originalPolicy = structuredClone(policy);
    const result = f.select(source, policy);
    assert.deepEqual(result, expected(before.state, 'C', 'switched'));
    assert.deepEqual(owners, before); assert.deepEqual(source, originalAssessment); assert.deepEqual(policy, originalPolicy);
    assert.notEqual(result.state, f.state); frozen(assert, result);
    source.eligible.reverse(); source.eligible[0].entityId = 'mutated'; source.excluded.length = 0;
    policy.preferredTargetIds.splice(0, 1, 'A'); f.state.targetEntityId = 'changed-after-return';
    assert.deepEqual(result, expected(before.state, 'C', 'switched'));
    assert.equal(Object.isFrozen(source.eligible), false); assert.equal(Object.isFrozen(policy.preferredTargetIds), false);
    return result;
  }
  const old = [Date.now, Math.random, globalThis.setTimeout, globalThis.setInterval, String.prototype.localeCompare];
  try {
    Date.now = Math.random = globalThis.setTimeout = globalThis.setInterval = String.prototype.localeCompare = () => {throw Error('implicit provider or locale ordering');};
    for (const kind of ['player', 'monster', 'npc', 'pet', 'summon', 'companion', 'custom']) {
      const a = session(kind), b = session(kind); assert.deepEqual(a, b); assert.notEqual(a, b); assert.notEqual(a.state, b.state);
    }
  } finally {[Date.now, Math.random, globalThis.setTimeout, globalThis.setInterval, String.prototype.localeCompare] = old;}
  console.log('ACTOR_AI_TARGET_REPLAY_PASS');
});
