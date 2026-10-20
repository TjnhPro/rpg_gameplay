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
    assert.ok(assertions > 0, 'Perception contract requires actual assertions');
  });
}
const fact = (entityId, changes = {}) => ({entityId, relationId: 'enemy', lifeStatus: 'alive',
  visible: true, inRange: true, reachable: true, ...changes});
const policy = changes => ({allowedRelationIds: ['enemy'], allowedLifeStatuses: ['alive'],
  requireVisible: true, requireInRange: true, requireReachable: true, allowSelf: false, ...changes});
function fixture(kind = 'player', controller = 'ai') {
  const actor = g.createEntity({id: 'Actor-Exact ', kind});
  const state = {...g.createActorAIState(actor, {profileId: 'L3-profile'}, {controller, behaviorStateId: 'guarding'}),
    targetEntityId: 'retained-target'};
  const entities = ['C', 'A', 'B', 'D', 'E', 'blocked'].reduce((collection, id) =>
    g.addEntity(collection, {id, kind: 'custom'}), g.addEntity(g.createEntityCollection(), actor));
  const snapshot = candidates => g.createActorAIPerceptionSnapshot(state, {observedAtMs: 1250, candidates});
  return {actor, state, entities, snapshot};
}
function frozen(assert, value) {
  if (value && typeof value === 'object') {
    assert.ok(Object.isFrozen(value));
    Object.values(value).forEach(child => frozen(assert, child));
  }
}

contract('perception: explicit capture, exact facts, actor binding and structural stale references', assert => {
  const f = fixture();
  const empty = f.snapshot([]);
  assert.deepEqual(empty, {actorId: 'Actor-Exact ', observedAtMs: 1250, candidates: []});
  const input = {observedAtMs: 0, candidates: [
    fact('C', {relationId: ' custom-hostile ', lifeStatus: 'dead', visible: false, reachable: false}),
    fact('unknown', {inRange: false}), fact('c')]};
  const snapshot = g.createActorAIPerceptionSnapshot(f.state, input);
  assert.deepEqual(snapshot, {actorId: 'Actor-Exact ', observedAtMs: 0, candidates: [
    {entityId: 'C', relationId: ' custom-hostile ', lifeStatus: 'dead', visible: false, inRange: true, reachable: false},
    {entityId: 'unknown', relationId: 'enemy', lifeStatus: 'alive', visible: true, inRange: false, reachable: true},
    {entityId: 'c', relationId: 'enemy', lifeStatus: 'alive', visible: true, inRange: true, reachable: true}]});
  const validated = g.validateActorAIPerceptionSnapshot(f.state, snapshot);
  assert.deepEqual(validated, snapshot); assert.notEqual(validated, snapshot);
  assert.notEqual(validated.candidates, snapshot.candidates);
  assert.notEqual(validated.candidates[0], snapshot.candidates[0]); frozen(assert, validated);
  input.observedAtMs = 99; input.candidates[0].relationId = 'changed'; input.candidates.reverse();
  assert.equal(snapshot.observedAtMs, 0); assert.equal(snapshot.candidates[0].relationId, ' custom-hostile ');
  assert.equal(Object.isFrozen(input.candidates), false); frozen(assert, snapshot);
  assert.throws(() => g.validateActorAIPerceptionSnapshot(f.state, {...snapshot, actorId: 'actor-exact '}), TypeError);
  assert.throws(() => g.evaluateActorAIPerception(f.state, g.createEntityCollection(), empty, policy()), TypeError);
  assert.throws(() => g.evaluateActorAIPerception(f.state, {entities: [f.actor, f.actor]}, empty, policy()), TypeError);
  for (const observedAtMs of [-1, NaN, Infinity, -Infinity, '1250', null, undefined]) {
    assert.throws(() => g.createActorAIPerceptionSnapshot(f.state, {observedAtMs, candidates: []}), TypeError);
    assert.throws(() => g.validateActorAIPerceptionSnapshot(f.state, {...empty, observedAtMs}), TypeError);
  }
  assert.throws(() => f.snapshot([fact('C'), fact('C')]), TypeError);
  assert.throws(() => g.validateActorAIPerceptionSnapshot(f.state, {...empty, candidates: [fact('C'), fact('C')]}), TypeError);
  assert.equal(f.state.targetEntityId, 'retained-target');
  console.log('ACTOR_AI_PERCEPTION_CAPTURE_PASS');
});

contract('perception: closed records, dense own-data arrays, policy and zero getter execution', assert => {
  const f = fixture(), snapshot = f.snapshot([fact('C')]); let getters = 0;
  const evaluate = (value, rules = policy()) => g.evaluateActorAIPerception(f.state, f.entities, value, rules);
  const cases = [
    [{observedAtMs: 1250, candidates: []}, x => g.createActorAIPerceptionSnapshot(f.state, x)],
    [snapshot, x => g.validateActorAIPerceptionSnapshot(f.state, x)],
    [snapshot, x => evaluate(x)],
    [fact('C'), x => f.snapshot([x])],
    [fact('C'), x => evaluate({...snapshot, candidates: [x]})],
    [policy(), x => g.evaluateActorAIPerception(f.state, f.entities, snapshot, x)],
    [f.state, x => g.createActorAIPerceptionSnapshot(x, {observedAtMs: 0, candidates: []})],
    [f.state, x => g.validateActorAIPerceptionSnapshot(x, snapshot)],
    [f.state, x => g.evaluateActorAIPerception(x, f.entities, snapshot, policy())],
  ];
  for (const [valid, run] of cases) {
    for (const bad of [null, undefined, [], 1, {...valid, extra: 1}, {...valid, [Symbol('extra')]: 1}]) {
      assert.throws(() => run(bad), TypeError);
    }
    for (const key of Object.keys(valid)) {
      const missing = {...valid}; delete missing[key];
      const getter = {...valid};
      Object.defineProperty(getter, key, {get() {getters++; return valid[key];}});
      assert.throws(() => run(missing), TypeError);
      assert.throws(() => run(Object.assign(Object.create({[key]: valid[key]}), missing)), TypeError);
      assert.throws(() => run(getter), TypeError);
    }
    run(Object.assign(Object.create(null), valid));
  }
  for (const field of ['entityId', 'relationId']) {
    for (const value of ['', '  ', null, 1]) assert.throws(() => f.snapshot([fact('C', {[field]: value})]), TypeError);
  }
  for (const value of ['unknown', '', null, true]) assert.throws(() => f.snapshot([fact('C', {lifeStatus: value})]), TypeError);
  for (const field of ['visible', 'inRange', 'reachable']) {
    for (const value of [0, 1, 'true', null, undefined]) assert.throws(() => f.snapshot([fact('C', {[field]: value})]), TypeError);
  }
  for (const field of ['requireVisible', 'requireInRange', 'requireReachable', 'allowSelf']) {
    for (const value of [0, 1, null, 'false']) assert.throws(() => evaluate(snapshot, policy({[field]: value})), TypeError);
  }
  const arrayCases = [
    [[fact('C')], x => f.snapshot(x)],
    [[fact('C')], x => g.validateActorAIPerceptionSnapshot(f.state, {...snapshot, candidates: x})],
    [[fact('C')], x => evaluate({...snapshot, candidates: x})],
    [['enemy'], x => evaluate(snapshot, policy({allowedRelationIds: x}))],
    [['alive'], x => evaluate(snapshot, policy({allowedLifeStatuses: x}))],
  ];
  for (const [valid, run] of arrayCases) {
    const accessor = [...valid]; Object.defineProperty(accessor, '0', {get() {getters++; return valid[0];}});
    const inherited = new Array(1); Object.setPrototypeOf(inherited, {'0': valid[0]});
    for (const bad of [null, {}, new Array(1), accessor, inherited,
      Object.assign([...valid], {extra: 1}), Object.assign([...valid], {[Symbol('extra')]: 1})]) {
      assert.throws(() => run(bad), TypeError);
    }
  }
  assert.throws(() => evaluate(snapshot, policy({allowedRelationIds: ['']})), TypeError);
  assert.throws(() => evaluate(snapshot, policy({allowedLifeStatuses: ['ghost']})), TypeError);
  assert.equal(getters, 0);
  console.log('ACTOR_AI_PERCEPTION_VALIDATION_PASS');
});

contract('perception: explicit L3 gates, exact relation/life membership and manual advisory use', assert => {
  const f = fixture('player', 'manual');
  const assess = (candidate, changes) => g.evaluateActorAIPerception(f.state, f.entities, f.snapshot([candidate]), policy(changes));
  for (const [candidate, reason] of [
    [fact('C', {relationId: 'neutral'}), 'relation_not_allowed'],
    [fact('C', {lifeStatus: 'dead'}), 'target_life_not_allowed'],
    [fact('C', {visible: false}), 'target_not_visible'],
    [fact('C', {inRange: false}), 'target_out_of_range'],
    [fact('C', {reachable: false}), 'target_not_reachable'],
    [fact('Actor-Exact '), 'self_not_allowed'],
    [fact('c'), 'entity_not_found'],
    [fact('C', {relationId: 'Enemy'}), 'relation_not_allowed'],
    [fact('unknown'), 'entity_not_found'],
  ]) {
    assert.deepEqual(assess(candidate).excluded, [{entityId: candidate.entityId, reason}]);
    assert.deepEqual(assess(candidate).eligible, []);
  }
  for (const [candidate, changes] of [
    [fact('C', {visible: false}), {requireVisible: false}],
    [fact('C', {inRange: false}), {requireInRange: false}],
    [fact('C', {reachable: false}), {requireReachable: false}],
    [fact('Actor-Exact '), {allowSelf: true}],
    [fact('C', {lifeStatus: 'dead'}), {allowedLifeStatuses: ['dead']}],
    [fact('C', {relationId: ' custom ' }), {allowedRelationIds: [' custom ']}],
  ]) {
    const result = assess(candidate, changes);
    assert.deepEqual(result, {actorId: 'Actor-Exact ', observedAtMs: 1250, status: 'candidates_available',
      reason: 'none', eligible: [candidate], excluded: []});
    frozen(assert, result);
  }
  for (const changes of [{allowedRelationIds: []}, {allowedLifeStatuses: []}]) {
    const result = assess(fact('C'), changes);
    assert.equal(result.status, 'no_candidates'); assert.deepEqual(result.eligible, []);
  }
  assert.equal(assess(fact('Actor-Exact ', {lifeStatus: 'dead'}), {allowSelf: true}).excluded[0].reason, 'target_life_not_allowed');
  assert.equal(f.state.controller, 'manual'); assert.equal(f.state.targetEntityId, 'retained-target');
  const context = g.createActorAIDecisionContext(f.state, 'D');
  assert.throws(() => g.validateActorAIDecisionResult(f.state, context, {status: 'proposed', reason: 'none',
    intent: g.createActorAIActionIntent(context, {actionKey: 'attack', targetEntityId: 'C'})}), TypeError);
  console.log('ACTOR_AI_PERCEPTION_POLICY_PASS');
});

contract('perception: complete rejection precedence independent of caller field order', assert => {
  const f = fixture();
  const blocked = {relationId: 'neutral', lifeStatus: 'dead', visible: false, inRange: false, reachable: false};
  const cases = [
    [fact('missing', blocked), 'entity_not_found'],
    [fact('Actor-Exact ', blocked), 'self_not_allowed'],
    [fact('blocked', blocked), 'target_life_not_allowed'],
    [fact('blocked', {...blocked, lifeStatus: 'alive'}), 'relation_not_allowed'],
    [fact('blocked', {...blocked, lifeStatus: 'alive', relationId: 'enemy'}), 'target_not_visible'],
    [fact('blocked', {visible: true, inRange: false, reachable: false}), 'target_out_of_range'],
    [fact('blocked', {reachable: false}), 'target_not_reachable'],
  ];
  for (const [candidate, reason] of cases) {
    const reordered = Object.fromEntries(Object.entries(candidate).reverse());
    assert.deepEqual(g.evaluateActorAIPerception(f.state, f.entities, f.snapshot([reordered]), policy()),
      {actorId: 'Actor-Exact ', observedAtMs: 1250, status: 'no_candidates', reason: 'no_eligible_candidates',
        eligible: [], excluded: [{entityId: candidate.entityId, reason}]});
  }
  console.log('ACTOR_AI_PERCEPTION_PRECEDENCE_PASS');
});

contract('perception: distinct empty/all-excluded outcomes, stable partition order and no selection', assert => {
  const f = fixture(), before = JSON.stringify(f.state);
  const empty = g.evaluateActorAIPerception(f.state, f.entities, f.snapshot([]), policy());
  assert.deepEqual(empty, {actorId: 'Actor-Exact ', observedAtMs: 1250, status: 'no_candidates',
    reason: 'no_perceived_entities', eligible: [], excluded: []});
  const all = f.snapshot([fact('C', {lifeStatus: 'dead'}), fact('missing'), fact('B', {relationId: 'neutral'})]);
  assert.deepEqual(g.evaluateActorAIPerception(f.state, f.entities, all, policy()),
    {actorId: 'Actor-Exact ', observedAtMs: 1250, status: 'no_candidates', reason: 'no_eligible_candidates',
      eligible: [], excluded: [{entityId: 'C', reason: 'target_life_not_allowed'}, {entityId: 'missing', reason: 'entity_not_found'},
        {entityId: 'B', reason: 'relation_not_allowed'}]});
  const ordered = g.evaluateActorAIPerception(f.state, f.entities, f.snapshot([fact('C'), fact('A'), fact('B')]), policy());
  assert.deepEqual(ordered.eligible.map(x => x.entityId), ['C', 'A', 'B']);
  assert.deepEqual(ordered.excluded, []);
  const mixed = g.evaluateActorAIPerception(f.state, f.entities,
    f.snapshot([fact('C'), fact('E', {relationId: 'neutral'}), fact('A'), fact('D', {lifeStatus: 'dead'}), fact('B')]), policy());
  assert.deepEqual(mixed, {actorId: 'Actor-Exact ', observedAtMs: 1250, status: 'candidates_available', reason: 'none',
    eligible: [fact('C'), fact('A'), fact('B')],
    excluded: [{entityId: 'E', reason: 'relation_not_allowed'}, {entityId: 'D', reason: 'target_life_not_allowed'}]});
  assert.deepEqual(Object.keys(mixed).sort(), ['actorId', 'observedAtMs', 'status', 'reason', 'eligible', 'excluded'].sort());
  assert.equal(JSON.stringify(f.state), before); frozen(assert, mixed); frozen(assert, empty);
  console.log('ACTOR_AI_PERCEPTION_ORDER_PASS');
});

contract('perception: actor-agnostic detached replay and canonical owner preservation without implicit providers', assert => {
  function session(kind) {
    const f = fixture(kind), source = [fact('C'), fact('B', {visible: false})], rules = policy();
    const resources = g.createEntityResourceState(f.actor, {health: {minimum: 0, maximum: 100, current: 5}});
    const life = g.createEntityLifeState(f.actor, {status: 'alive'});
    const owners = {state: f.state, entities: f.entities, resources, life}, before = JSON.stringify(owners);
    const input = {observedAtMs: 1250, candidates: source}, captured = g.createActorAIPerceptionSnapshot(f.state, input);
    const mutableSnapshot = {actorId: captured.actorId, observedAtMs: captured.observedAtMs, candidates: source};
    const validated = g.validateActorAIPerceptionSnapshot(f.state, mutableSnapshot);
    const result = g.evaluateActorAIPerception(f.state, f.entities, mutableSnapshot, rules);
    assert.deepEqual(result, {actorId: 'Actor-Exact ', observedAtMs: 1250, status: 'candidates_available', reason: 'none',
      eligible: [fact('C')], excluded: [{entityId: 'B', reason: 'target_not_visible'}]});
    assert.equal(JSON.stringify(owners), before);
    source[0].entityId = 'changed'; source[1].visible = true; source.push(fact('new'));
    input.observedAtMs = mutableSnapshot.observedAtMs = 999;
    rules.allowedRelationIds[0] = 'neutral'; rules.allowedLifeStatuses.length = 0; rules.allowSelf = true;
    assert.equal(captured.candidates[0].entityId, 'C'); assert.equal(validated.candidates[1].visible, false);
    assert.equal(result.eligible[0].entityId, 'C'); assert.equal(result.excluded[0].reason, 'target_not_visible');
    assert.equal(result.observedAtMs, 1250); assert.equal(validated.candidates.length, 2);
    assert.equal(Object.isFrozen(source), false); assert.equal(Object.isFrozen(rules.allowedRelationIds), false);
    for (const value of [captured, validated, result]) frozen(assert, value);
    return {captured, validated, result};
  }
  const old = [Date.now, Math.random, globalThis.setTimeout, globalThis.setInterval];
  try {
    Date.now = Math.random = globalThis.setTimeout = globalThis.setInterval = () => {throw Error('implicit provider');};
    for (const kind of ['player', 'monster', 'npc', 'pet', 'summon', 'companion', 'custom']) {
      const a = session(kind), b = session(kind); assert.deepEqual(a, b);
      for (const key of Object.keys(a)) assert.notEqual(a[key], b[key]);
      assert.notEqual(a.result.eligible[0], b.result.eligible[0]);
      assert.notEqual(a.result.excluded[0], b.result.excluded[0]);
    }
  } finally {[Date.now, Math.random, globalThis.setTimeout, globalThis.setInterval] = old;}
  console.log('ACTOR_AI_PERCEPTION_REPLAY_PASS');
});
