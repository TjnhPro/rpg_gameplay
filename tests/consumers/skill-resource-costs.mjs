import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluateSkillResourceCosts as evaluate, applySkillResourceCosts as apply,
  createEntity, createEntityResourceState, createEntityLifeState, transitionEntityResource,
  createSkillDefinition, createSkillInstance, evaluateSkillActivationAdmission,
  createEntityCollection, addEntity} from '@rpg/gameplay';

const actor = createEntity({id: 'player-1', kind: 'player'});
const definition = createSkillDefinition({skillId: 'fireball'});
const admission = evaluateSkillActivationAdmission(definition,
  createSkillInstance(definition, actor, {instanceId: 'instance-001'}), actor.id,
  addEntity(createEntityCollection(), actor), createEntityLifeState(actor, {status: 'alive'}),
  {owned: true, eligible: true, rank: {mode: 'not_required'}});
const state = current => ({entityId: actor.id, current});
const request = (...entries) => ({costs: entries.map(([resourceId, amount]) => ({resourceId, amount})),
  bounds: entries.map(([resourceId, , minimum = 0, maximum = 100, currentAboveMaximum = 'reject']) =>
    ({resourceId, minimum, maximum, currentAboveMaximum}))});
const assessment = (reason = 'none', rejectedResourceId = null) => ({instanceId: 'instance-001',
  skillId: 'fireball', entityId: actor.id, status: reason === 'none' ? 'payable' : 'rejected', reason, rejectedResourceId});
const diagnostic = (resource, before, after, applied, reachedMinimum = false) => ({resource, before, after, applied, reachedMinimum});
function rejected(resources, req, reason, resourceId) {
  assert.deepEqual(evaluate(admission, resources, req), assessment(reason, resourceId));
  assert.deepEqual(apply(admission, resources, req), {status: 'rejected', reason,
    assessment: assessment(reason, resourceId), state: null, transitions: []});
}

test('SK11–SK13: literal single resource oracles preserve actual Entity/Core diagnostics', () => {
  const canonical = createEntityResourceState(actor, {mana: {minimum: 0, maximum: 100, current: 100}});
  for (const [resources, req, after, transition] of [
    [canonical, request(['mana', 25]), {mana: 75}, diagnostic('mana', 100, 75, 25)], // S01
    [state({mana: 25}), request(['mana', 25]), {mana: 0}, diagnostic('mana', 25, 0, 25, true)], // S02
    [state({mana: 1.5}), request(['mana', .25]), {mana: 1.25}, diagnostic('mana', 1.5, 1.25, .25)],
    [state({mana: 140}), request(['mana', 20, 0, 100, 'allow']), {mana: 100}, diagnostic('mana', 140, 100, 20)], // S11/S16
    [state({health: 25}), request(['health', 25]), {health: 0}, diagnostic('health', 25, 0, 25, true)], // S19
  ]) {
    const before = structuredClone(resources);
    assert.deepEqual(evaluate(admission, resources, req), assessment());
    const result = apply(admission, resources, req);
    assert.deepEqual(result, {status: 'applied', reason: 'none', assessment: assessment(),
      state: state(after), transitions: [transition]});
    assert.equal(Object.hasOwn(result.transitions[0], 'state'), false);
    assert.deepEqual(resources, before);
  }
  const life = createEntityLifeState(actor, {status: 'alive'});
  apply(admission, state({health: 25}), request(['health', 25]));
  assert.deepEqual(life, {entityId: actor.id, status: 'alive'});
  const above = state({mana: 140}), req = request(['mana', 20]);
  for (const operation of [evaluate, apply]) assert.throws(() => operation(admission, above, req),
    error => error.message === 'Current resource exceeds maximum');
  // Public canonical operation independently proves applied is20 despite observed delta40.
  assert.deepEqual(transitionEntityResource(above, 'mana', {maximum: 100, amount: 20, operation: 'decrease',
    rule: {minimum: 0, currentAboveMaximum: 'allow', allowIncreaseFromMinimum: false}}).transition,
  diagnostic('mana', 140, 100, 20));
  assert.deepEqual(above, state({mana: 140}));
  console.log('SKILL_COST_NUMERICAL_PASS S01-S04/S11/S16/S19; literal_oracle; actual_Entity_Core; applied20_delta40');
});

test('SK12–SK14: all-or-nothing candidates, caller order, missing and stale resources', () => {
  rejected(state({mana: 10}), request(['mana', 25]), 'insufficient_resource', 'mana'); // S03
  rejected(state({mana: 30}), request(['mana', 25, 10]), 'insufficient_resource', 'mana'); // S04
  rejected(state({}), request(['mana', 1]), 'resource_not_found', 'mana'); // S07
  rejected(state({}), request(['mana', 0]), 'resource_not_found', 'mana');
  const req = request(['mana', 30], ['stamina', 20]);
  const result = apply(admission, state({mana: 80, stamina: 40, other: 7}), req);
  assert.deepEqual(result, {status: 'applied', reason: 'none', assessment: assessment(),
    state: state({mana: 50, stamina: 20, other: 7}),
    transitions: [diagnostic('mana', 80, 50, 30), diagnostic('stamina', 40, 20, 20)]}); // S08
  const original = state({mana: 80, stamina: 10});
  rejected(original, req, 'insufficient_resource', 'stamina'); // S09
  assert.deepEqual(original, state({mana: 80, stamina: 10}));
  rejected(original, request(['mana', 30], ['stamina', 20], ['energy', 1]), 'insufficient_resource', 'stamina'); // S10
  rejected(original, request(['energy', 1], ['stamina', 20], ['mana', 30]), 'resource_not_found', 'energy');
  const current = state({mana: 50}), cost = request(['mana', 40]);
  assert.deepEqual(evaluate(admission, current, cost), assessment()); // S18: no reservation
  current.current.mana = 20;
  rejected(current, cost, 'insufficient_resource', 'mana');
  // Exact opaque identity, including prototype-looking names and case/whitespace.
  const exact = state(Object.fromEntries([[' Mana ', 2], ['__proto__', 3], ['constructor', 4]]));
  assert.deepEqual(apply(admission, exact, request([' Mana ', .5], ['__proto__', 1], ['constructor', 2])).state,
    state(Object.fromEntries([[' Mana ', 1.5], ['__proto__', 2], ['constructor', 2]])));
  rejected(exact, request(['mana', 1]), 'resource_not_found', 'mana');
  console.log('SKILL_COST_ATOMICITY_PASS S03-S04/S07-S10/S18; no_partial_state_or_receipts; caller_order; stale_reassessment');
});

test('SK11–SK15: zero/free requests preserve resources without numerical normalization', () => {
  for (const [resources, req] of [
    [state({mana: 50, other: 7}), request(['mana', 0])], // S05
    [state({mana: 140}), request(['mana', 0])], // reject policy must not normalize or throw
    [state({mana: -5}), request(['mana', 0])],
    [state({mana: 140, other: -5}), request()], [state({}), request()], // S06
  ]) {
    const result = apply(admission, resources, req);
    assert.deepEqual(result, {status: 'applied', reason: 'none', assessment: assessment(), state: resources, transitions: []});
    assert.notEqual(result.state, resources);
    assert.notEqual(result.state.current, resources.current);
    assert.deepEqual(evaluate(admission, resources, req), assessment());
  }
  const hidden = state(Object.defineProperty({other: 9}, 'mana', {value: 50}));
  assert.deepEqual(apply(admission, hidden, request()).state, state({other: 9, mana: 50}));
  console.log('SKILL_COST_NOOP_PASS S05-S06; zero_and_empty; no_transition_or_normalization; detached_state');
});

test('SK11–SK15: full malformed matrix precedes rejection without invoking getters', () => {
  let getters = 0;
  const getter = () => {getters++; throw Error('Getter invoked');};
  function malformed(record) {
    const values = [null, undefined, [], 1, 'record', Object.create(record),
      {...record, extra: true}, {...record, [Symbol('extra')]: true},
      Object.defineProperty({...record}, 'hidden', {value: 1})];
    for (const key of Object.keys(record)) {
      const missing = {...record}; delete missing[key]; values.push(missing);
      values.push(Object.defineProperty({...record}, key, {get: getter}));
    }
    return values;
  }
  function arrays(entry) {
    return [undefined, null, {}, new Array(1), Object.assign([entry], {extra: 1}),
      Object.assign([entry], {[Symbol('extra')]: 1}),
      Object.defineProperty([entry], '0', {get: getter}),
      Object.setPrototypeOf(new Array(1), Object.assign(Object.create(Array.prototype), {0: entry}))];
  }
  const good = request(['mana', 25]);
  const badRequests = [...malformed(good),
    ...arrays(good.costs[0]).map(costs => ({...good, costs})),
    ...arrays(good.bounds[0]).map(bounds => ({...good, bounds})),
    ...malformed(good.costs[0]).map(cost => ({...good, costs: [cost]})),
    ...malformed(good.bounds[0]).map(bound => ({...good, bounds: [bound]})),
    ...[-1, NaN, Infinity, -Infinity, null, undefined, '1', true].map(amount => ({...good, costs: [{resourceId: 'mana', amount}]})),
    ...['', ' ', null, undefined, 1].flatMap(resourceId => [
      {...good, costs: [{resourceId, amount: 1}]}, {...good, bounds: [{...good.bounds[0], resourceId}]}]),
    ...['minimum', 'maximum'].flatMap(key => [NaN, Infinity, -Infinity, null, undefined, '1', true]
      .map(value => ({...good, bounds: [{...good.bounds[0], [key]: value}]}))),
    ...[undefined, null, 'ALLOW', true].map(currentAboveMaximum => ({...good, bounds: [{...good.bounds[0], currentAboveMaximum}]})),
    {...good, bounds: [{...good.bounds[0], minimum: 101}]},
    {...good, costs: [good.costs[0], good.costs[0]]}, {...good, bounds: [good.bounds[0], good.bounds[0]]},
    {...good, bounds: []}, {...good, bounds: [...good.bounds, {...good.bounds[0], resourceId: 'other'}]},
    {...good, bounds: [{...good.bounds[0], resourceId: 'other'}]},
  ];
  const badAdmissions = [...malformed(admission),
    ...['instanceId', 'skillId', 'actorEntityId'].flatMap(key => ['', ' ', 1, null].map(value => ({...admission, [key]: value}))),
    {...admission, status: 'rejected', reason: 'actor_dead'}, {...admission, status: 'admitted', reason: 'actor_dead'},
    {...admission, status: 'unknown'}, {...admission, actorEntityId: 'other'}]; // S12/S13
  const resources = state({mana: 10});
  const badStates = [...malformed(resources), {...resources, entityId: ''}, {...resources, entityId: 'other'},
    ...[null, [], {mana: NaN}, {mana: Infinity}, {' ': 5}, Object.create({mana: 1}),
      Object.defineProperty({}, 'mana', {get: getter}), {[Symbol('bad')]: 1}].map(current => state(current))];
  for (const operation of [evaluate, apply]) {
    for (const value of badRequests) assert.throws(() => operation(admission, resources, value), TypeError);
    for (const value of badAdmissions) assert.throws(() => operation(value, resources, good), TypeError);
    for (const value of badStates) {
      assert.throws(() => operation(admission, value, good), TypeError);
      assert.throws(() => operation(admission, value, request()), TypeError);
    }
    // Earlier insufficiency/missing ID cannot conceal malformed later entries/bounds.
    for (const first of ['mana', 'missing']) {
      const req = request([first, 25], ['later', 1]);
      for (const bad of [
        {...req, costs: [req.costs[0], {resourceId: 'later', amount: NaN}]},
        {...req, bounds: [req.bounds[0], {...req.bounds[1], minimum: Infinity}]},
      ]) assert.throws(() => operation(admission, resources, bad), TypeError);
    }
    assert.throws(() => operation(admission, state({mana: -1}), good), TypeError); // canonical precondition
  }
  assert.equal(getters, 0);
  assert.deepEqual(resources, state({mana: 10}));
  console.log('SKILL_COST_VALIDATION_PASS S12-S14; TypeError_before_rejection; full_state_and_request; getters0');
});

test('SK15: independent literal replay, immutable detached outputs and caller ownership', () => {
  function session() {
    const receipt = structuredClone(admission), resources = state({mana: 80, stamina: 40});
    const req = request(['mana', 30], ['stamina', 20]);
    const before = structuredClone([receipt, resources, req]);
    const result = apply(receipt, resources, req), assessed = evaluate(receipt, resources, req);
    assert.deepEqual(assessed, assessment());
    assert.deepEqual(result, {status: 'applied', reason: 'none', assessment: assessment(),
      state: state({mana: 50, stamina: 20}),
      transitions: [diagnostic('mana', 80, 50, 30), diagnostic('stamina', 40, 20, 20)]});
    assert.deepEqual([receipt, resources, req], before);
    const denied = apply(receipt, state({mana: 1}), request(['mana', 2]));
    for (const value of [assessed, result, result.assessment, result.state, result.state.current,
      result.transitions, ...result.transitions, denied, denied.assessment, denied.transitions]) {
      assert.equal(Object.isFrozen(value), true);
      assert.throws(() => {value.extra = true;}, TypeError);
    }
    assert.deepEqual(Reflect.ownKeys(result).sort(), ['assessment', 'reason', 'state', 'status', 'transitions']);
    for (const value of [receipt, resources, resources.current, req, req.costs, req.bounds, ...req.costs, ...req.bounds]) {
      assert.equal(Object.isFrozen(value), false);
    }
    receipt.instanceId = 'changed'; resources.current.mana = 0; req.costs[0].amount = 0; req.bounds[0].maximum = 1;
    assert.equal(result.assessment.instanceId, 'instance-001');
    assert.deepEqual(result.state, state({mana: 50, stamina: 20}));
    return [assessed, result, denied];
  }
  const now = Date.now, random = Math.random;
  try {
    Date.now = Math.random = () => {throw Error('Implicit time/RNG');};
    assert.deepEqual(session(), session());
  } finally {Date.now = now; Math.random = random;}
  console.log('SKILL_COST_ISOLATION_PASS S15/S17; sessions2_literal_oracle; frozen_detached; inputs_unfrozen; no_clock_rng');
});
