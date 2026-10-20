import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import * as g from '@rpg/gameplay';

const identity = {instanceId: 'instance-001', skillId: 'fireball', entityId: 'player-1'};
const dispatch = {kind: 'combat', actionId: 'action-001', actionType: 'spell_attack', targetEntityId: 'target-1'};
const expectedRequest = {attemptId: 'attempt-001', instanceId: 'instance-001', skillId: 'fireball',
  actorEntityId: 'player-1', dispatch};
function fixture() {
  const actor = g.createEntity({id: 'player-1', kind: 'player'});
  const definition = g.createSkillDefinition({skillId: 'fireball'});
  const instance = g.createSkillInstance(definition, actor, {instanceId: 'instance-001'});
  const admission = g.evaluateSkillActivationAdmission(definition, instance, actor.id,
    g.addEntity(g.createEntityCollection(), actor), g.createEntityLifeState(actor, {status: 'alive'}),
    {owned: true, eligible: true, rank: {mode: 'not_required'}});
  const calls = {clock: 0, random: 0, ids: 0};
  const clock = {time: 1000, now() {calls.clock++; return this.time;}};
  const input = {instance: {...instance}, admission: {...admission},
    resourceState: {entityId: actor.id, current: {mana: 100}},
    resourceCosts: {costs: [{resourceId: 'mana', amount: 25}],
      bounds: [{resourceId: 'mana', minimum: 0, maximum: 100, currentAboveMaximum: 'reject'}]},
    cooldownState: {...g.createSkillCooldownState(instance)},
    cooldownConfig: {baseDurationMs: 1000, effectiveCdr: .25},
    executionContext: g.createExecutionContext({clock,
      random: {next() {calls.random++; throw Error('unexpected RNG');}},
      ids: {next() {calls.ids++; throw Error('unexpected ID');}}}),
    intent: {attemptId: 'attempt-001', dispatch: {...dispatch}}, executionPreflight: {kind: 'combat', status: 'accepted'}};
  return {input, calls, clock};
}
function frozen(value) {
  if (value && typeof value === 'object') {
    assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen);
  }
}
const rejected = reason => ({status: 'rejected', reason, request: null, resources: null, cooldown: null});
function originalData(input) {
  const {executionContext, ...data} = input;
  return structuredClone(data);
}

test('SK21–SK23: canonical candidates, multiple costs, free caller-only activation', () => {
  const {input, calls} = fixture(), original = originalData(input);
  const result = g.activateSkill(input);
  assert.deepEqual(result, {status: 'accepted', reason: 'none', request: expectedRequest,
    resources: {entityId: 'player-1', current: {mana: 75}},
    cooldown: {...identity, startedAtMs: 1000, readyAtMs: 1750}}); // S01, Combat preflight evidence in handoff fixture
  frozen(result);
  assert.deepEqual(originalData(input), original);
  assert.deepEqual(calls, {clock: 1, random: 0, ids: 0});
  const multi = fixture();
  multi.input.resourceState.current = {mana: 80, stamina: 40};
  multi.input.resourceCosts = {costs: [{resourceId: 'mana', amount: 30}, {resourceId: 'stamina', amount: 20}],
    bounds: ['mana', 'stamina'].map(resourceId => ({resourceId, minimum: 0, maximum: 100, currentAboveMaximum: 'reject'}))};
  const paid = g.activateSkill(multi.input); // S07
  assert.deepEqual(paid.resources, {entityId: 'player-1', current: {mana: 50, stamina: 20}});
  multi.input.resourceState.current.stamina = 10;
  const beforeReads = multi.calls.clock;
  assert.deepEqual(g.activateSkill(multi.input), rejected('resource_cost_rejected')); // S08
  assert.equal(multi.calls.clock, beforeReads);
  assert.deepEqual(multi.input.resourceState.current, {mana: 80, stamina: 10});
  const free = fixture();
  const {modules} = JSON.parse(readFileSync(new URL('./skill-modules.json', import.meta.url), 'utf8'));
  const registry = modules.reduce(g.registerModule, g.createModuleRegistry());
  assert.deepEqual(g.composeModules(registry, g.configureModules(registry,
    {enable: ['entity', 'skill'], disable: ['combat', 'progression']})).moduleIds, ['entity', 'skill']);
  free.input.resourceCosts = {costs: [], bounds: []};
  free.input.cooldownConfig = {baseDurationMs: 0, effectiveCdr: 0};
  free.input.intent.dispatch = {kind: 'caller'};
  free.input.executionPreflight = {kind: 'caller', status: 'accepted'};
  const caller = g.activateSkill(free.input); // S09–S10
  assert.deepEqual(caller, {status: 'accepted', reason: 'none', request: {...expectedRequest, dispatch: {kind: 'caller'}},
    resources: {entityId: 'player-1', current: {mana: 100}}, cooldown: {...identity, startedAtMs: 1000, readyAtMs: 1000}});
  assert.notEqual(caller.resources, free.input.resourceState);
  assert.notEqual(caller.resources.current, free.input.resourceState.current);
  assert.equal(g.reportSkillExecutionOutcome(caller.request, {status: 'completed'}).dispatchKind, 'caller');
  assert.deepEqual(free.calls, {clock: 1, random: 0, ids: 0});
  console.log('SKILL_ACTIVATION_CANDIDATES_PASS S01/S07-S10; mana75_multi50_20; free_zero; entity_skill_only');
});

test('SK22: ordered gates never expose partial state or observe downstream providers', () => {
  for (const [stage, reason, clockReads] of [
    [0, 'skill_admission_rejected', 0], [1, 'execution_preflight_rejected', 0],
    [2, 'resource_cost_rejected', 0], [3, 'cooldown_active', 1],
  ]) {
    const {input, calls, clock} = fixture();
    if (stage === 0) input.admission = {...input.admission, status: 'rejected', reason: 'actor_dead'};
    if (stage <= 1) input.executionPreflight.status = 'rejected';
    if (stage <= 2) input.resourceState.current.mana = 10;
    input.cooldownState = {...identity, startedAtMs: 1000, readyAtMs: 1750};
    clock.time = 1250;
    const before = originalData(input);
    const result = g.activateSkill(input); // S02/S04–S06/S17
    assert.deepEqual(result, rejected(reason)); frozen(result);
    assert.deepEqual(Reflect.ownKeys(result).sort(), ['cooldown', 'reason', 'request', 'resources', 'status']);
    assert.deepEqual(calls, {clock: clockReads, random: 0, ids: 0});
    assert.deepEqual(originalData(input), before);
  }
  // Canonical above-max transition would throw. Earlier gates must not execute it.
  for (const stage of ['admission', 'preflight']) {
    const {input, calls} = fixture(); input.resourceState.current.mana = 140;
    if (stage === 'admission') input.admission = {...input.admission, status: 'rejected', reason: 'actor_dead'};
    else input.executionPreflight.status = 'rejected';
    assert.deepEqual(g.activateSkill(input), rejected(stage === 'admission' ? 'skill_admission_rejected' : 'execution_preflight_rejected'));
    assert.equal(calls.clock, 0);
    input.admission = {...input.admission, status: 'admitted', reason: 'none'};
    input.executionPreflight.status = 'accepted';
    assert.throws(() => g.activateSkill(input), error => error.message === 'Current resource exceeds maximum');
  }
  const {input, clock, calls} = fixture();
  clock.time = NaN;
  assert.throws(() => g.activateSkill(input), TypeError);
  assert.equal(calls.clock, 1);
  clock.time = 900; input.cooldownState = {...identity, startedAtMs: 1000, readyAtMs: 1750};
  assert.throws(() => g.activateSkill(input), TypeError);
  const error = new Error('explicit clock failed');
  input.executionContext = g.createExecutionContext({clock: {now() {throw error;}}});
  assert.throws(() => g.activateSkill(input), caught => caught === error);
  console.log('SKILL_ACTIVATION_GATES_PASS S02/S04-S06/S17; priority; no_partial_candidates; no_downstream_reads');
});

test('SK21–SK23: complete malformed input fails before rejection without invoking getters', () => {
  let getterCalls = 0;
  const badRecords = record => [null, [], 1, {...record, extra: 1}, {...record, [Symbol('extra')]: 1}, Object.create(record),
    ...Object.keys(record).flatMap(key => {
      const missing = {...record}; delete missing[key];
      return [missing, Object.assign(Object.create({[key]: record[key]}), missing),
        Object.defineProperty({...record}, key, {enumerable: true, get() {getterCalls++; throw Error('getter');}})];
    })];
  const {input, calls} = fixture();
  const cases = [...badRecords(input)];
  for (const key of ['instance', 'admission', 'resourceState', 'resourceCosts', 'cooldownState', 'cooldownConfig', 'intent', 'executionPreflight']) {
    for (const bad of badRecords(input[key])) cases.push({...input, [key]: bad});
  }
  for (const [parent, key] of [['intent', 'dispatch']]) {
    for (const bad of badRecords(input[parent][key])) cases.push({...input, [parent]: {...input[parent], [key]: bad}});
  }
  for (const bad of [null, [], 1, {mana: NaN}, {mana: Infinity}, {mana: '100'},
    {mana: 100, [Symbol()]: 1}, Object.create({mana: 100}),
    {get mana() {getterCalls++; throw Error('getter');}}]) {
    cases.push({...input, resourceState: {...input.resourceState, current: bad}});
  }
  for (const key of ['costs', 'bounds']) {
    const record = input.resourceCosts[key][0];
    for (const bad of badRecords(record)) cases.push({...input, resourceCosts: {...input.resourceCosts, [key]: [bad]}});
    for (const bad of [null, {}, [,], Object.assign([], {extra: true}),
      Object.defineProperty([record], '0', {get() {getterCalls++; throw Error('getter');}})]) {
      cases.push({...input, resourceCosts: {...input.resourceCosts, [key]: bad}});
    }
  }
  for (const record of ['instance', 'admission', 'cooldownState']) {
    for (const key of ['instanceId', 'skillId', record === 'admission' ? 'actorEntityId' : 'entityId']) {
      for (const value of ['different', '', ' ', 7, null]) cases.push({...input, [record]: {...input[record], [key]: value}});
    }
  }
  cases.push({...input, resourceState: {...input.resourceState, entityId: 'different'}});
  for (const admission of [{...input.admission, reason: 'actor_dead'}, {...input.admission, status: 'rejected'},
    {...input.admission, status: 'rejected', reason: 'invented'}, {...input.admission, status: 'accepted'}]) cases.push({...input, admission});
  for (const attemptId of ['', ' ', 1, null]) cases.push({...input, intent: {...input.intent, attemptId}});
  for (const bad of [{kind: 'caller', actionId: 'extra'}, {kind: 'unknown'},
    ...['actionId', 'actionType', 'targetEntityId'].map(key => ({...dispatch, [key]: ''}))]) cases.push({...input, intent: {...input.intent, dispatch: bad}});
  for (const bad of [{kind: 'caller', status: 'accepted'}, {kind: 'combat', status: 'admitted'}, {kind: 'unknown', status: 'rejected'}]) {
    cases.push({...input, executionPreflight: bad});
  }
  for (const bad of [{...input.cooldownState, startedAtMs: 1}, {...input.cooldownState, readyAtMs: 1},
    {...identity, startedAtMs: 1000, readyAtMs: 999}]) cases.push({...input, cooldownState: bad});
  for (const [key, values] of [['baseDurationMs', [NaN, Infinity, -1, '1000']], ['effectiveCdr', [NaN, Infinity, -1, 1.01, '.25']]]) {
    for (const value of values) cases.push({...input, cooldownConfig: {...input.cooldownConfig, [key]: value}});
  }
  cases.push({...input, resourceState: {entityId: 'player-1', current: {mana: NaN}}},
    {...input, resourceCosts: {costs: [{resourceId: 'mana', amount: -1}], bounds: input.resourceCosts.bounds}},
    {...input, resourceCosts: {costs: input.resourceCosts.costs, bounds: []}});
  for (const executionContext of [null, [], 1, undefined]) cases.push({...input, executionContext});
  for (const [caseIndex, bad] of cases.entries()) {
    assert.throws(() => g.activateSkill(bad), TypeError); // S11/S18
    if (bad && typeof bad === 'object' && !Array.isArray(bad)
      && Reflect.ownKeys(bad).every(key => 'value' in Object.getOwnPropertyDescriptor(bad, key))) {
      // Only replace valid own data; leave outer malformed descriptors intact.
      const descriptor = Object.getOwnPropertyDescriptor(bad, 'admission');
      if (descriptor && 'value' in descriptor && descriptor.value === input.admission) {
        assert.throws(() => g.activateSkill({...bad, admission: {...input.admission, status: 'rejected', reason: 'actor_dead'}}), TypeError);
        if (Object.getOwnPropertyDescriptor(bad, 'executionPreflight')?.value === input.executionPreflight) {
          assert.throws(() => g.activateSkill({...bad, executionPreflight: {kind: 'combat', status: 'rejected'}}), TypeError, 'case ' + caseIndex);
        }
      }
    }
  }
  // Forged opaque capability is rejected canonically when cooldown is reached, without reading its accessors.
  assert.throws(() => g.activateSkill({...input, executionContext: {get clock() {getterCalls++; throw Error('getter');}}}), TypeError);
  assert.deepEqual(calls, {clock: 0, random: 0, ids: 0});
  assert.equal(getterCalls, 0);
  console.log('SKILL_ACTIVATION_VALIDATION_PASS S11/S18; complete_input_before_rejection; canonical_Entity; getters0');
});

test('SK24: completion/failure are immutable caller assertions without execution or refund', () => {
  const {input, calls} = fixture(), accepted = g.activateSkill(input);
  const snapshot = structuredClone(accepted);
  for (const status of ['completed', 'failed']) {
    const report = {status}, request = structuredClone(accepted.request);
    const outcome = g.reportSkillExecutionOutcome(request, report);
    assert.deepEqual(outcome, {attemptId: 'attempt-001', instanceId: 'instance-001', skillId: 'fireball',
      actorEntityId: 'player-1', dispatchKind: 'combat', status});
    frozen(outcome);
    assert.equal(Object.isFrozen(report), false); assert.equal(Object.isFrozen(request), false);
    request.attemptId = 'mutated'; report.status = 'invalid';
    assert.equal(outcome.attemptId, 'attempt-001'); assert.equal(outcome.status, status);
  }
  // Caller commits candidates, then reports an external dispatch failure. No compensating transition.
  const committedResources = accepted.resources, committedCooldown = accepted.cooldown;
  const failure = new Error('external dispatch failed');
  function externalDispatch() {throw failure;}
  assert.throws(externalDispatch, error => error === failure);
  assert.equal(g.reportSkillExecutionOutcome(accepted.request, {status: 'failed'}).status, 'failed'); // S15
  assert.equal(committedResources.current.mana, 75); assert.equal(committedCooldown.readyAtMs, 1750);
  assert.deepEqual(accepted, snapshot);
  assert.deepEqual(calls, {clock: 1, random: 0, ids: 0});
  let getters = 0;
  for (const key of Reflect.ownKeys(accepted.request)) {
    const missing = {...accepted.request}; delete missing[key];
    assert.throws(() => g.reportSkillExecutionOutcome(missing, {status: 'completed'}), TypeError);
    const accessor = Object.defineProperty({...accepted.request}, key, {get() {getters++; throw Error('getter');}});
    assert.throws(() => g.reportSkillExecutionOutcome(accessor, {status: 'completed'}), TypeError);
  }
  for (const request of [null, [], {...accepted.request, extra: 1}, {...accepted.request, [Symbol()]: 1},
    Object.create(accepted.request), {...accepted.request, attemptId: ''}, {...accepted.request, actorEntityId: 1},
    {...accepted.request, dispatch: {kind: 'caller', actionId: 'extra'}}, {...accepted.request, dispatch: {kind: 'combat'}}]) {
    assert.throws(() => g.reportSkillExecutionOutcome(request, {status: 'completed'}), TypeError);
  }
  for (const report of [null, [], {}, {status: 'accepted'}, {status: 'completed', extra: 1},
    {status: 'completed', [Symbol()]: 1}, Object.create({status: 'completed'}),
    {get status() {getters++; throw Error('getter');}}]) assert.throws(() => g.reportSkillExecutionOutcome(accepted.request, report), TypeError);
  assert.equal(getters, 0);
  console.log('SKILL_EXECUTION_REPORT_PASS S15; caller_assertions_only; no_refund_retry; closed_frozen_outcome');
});

test('SK25: immutable snapshots and independent literal replay without hidden providers or dedup', () => {
  const now = Date.now, random = Math.random;
  Date.now = Math.random = () => {throw Error('implicit provider forbidden');};
  try {
    for (let session = 0; session < 2; session++) {
      const {input, calls} = fixture(), original = originalData(input);
      const a = g.activateSkill(input), b = g.activateSkill(input); // S16/S19/S21, same explicit attempt ID
      const expected = {status: 'accepted', reason: 'none', request: expectedRequest,
        resources: {entityId: 'player-1', current: {mana: 75}},
        cooldown: {...identity, startedAtMs: 1000, readyAtMs: 1750}};
      assert.deepEqual(a, expected); assert.deepEqual(b, expected); // each checked against literals, no A-as-oracle
      assert.notEqual(a.request, b.request); assert.notEqual(a.resources, b.resources);
      assert.notEqual(a.cooldown, b.cooldown); assert.notEqual(a.request.dispatch, input.intent.dispatch);
      assert.deepEqual(originalData(input), original);
      frozen(a); frozen(b);
      assert.throws(() => {a.request.dispatch.targetEntityId = 'changed';}, TypeError);
      for (const value of [input, input.instance, input.resourceState, input.resourceState.current,
        input.cooldownState, input.intent, input.intent.dispatch, input.cooldownConfig]) assert.equal(Object.isFrozen(value), false);
      input.resourceState.current.mana = 0; input.cooldownState.readyAtMs = 1;
      input.intent.attemptId = 'changed'; input.intent.dispatch.actionId = 'changed'; input.instance.skillId = 'changed';
      assert.deepEqual(a, expected); assert.deepEqual(b, expected); // S20
      assert.deepEqual(calls, {clock: 2, random: 0, ids: 0});
    }
  } finally {Date.now = now; Math.random = random;}
  console.log('SKILL_ACTIVATION_REPLAY_PASS S16/S19-S21; sessions2_literal_oracle; duplicate_attempt_allowed; frozen_detached');
});
