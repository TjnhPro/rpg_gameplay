import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createEntity, createSkillDefinition, createSkillInstance, createExecutionContext,
  createModuleRegistry, registerModule, configureModules, composeModules,
  createSkillCooldownState as create, evaluateSkillCooldownReady as evaluate,
  startSkillCooldown as start} from '@rpg/gameplay';

const instance = {instanceId: 'cast-1', skillId: 'fireball', entityId: 'player-1'};
const initial = () => ({...instance, startedAtMs: null, readyAtMs: null});
const active = () => ({...instance, startedAtMs: 1000, readyAtMs: 1750});
const config = {baseDurationMs: 1000, effectiveCdr: .25};
function clock(time = 1000) {
  const provider = {time, calls: 0, now() {this.calls++; return this.time;}};
  return {provider, context: createExecutionContext({clock: provider})};
}
const assessment = (observedAtMs, readyAtMs = null, remainingMs = 0, status = 'ready') =>
  ({...instance, observedAtMs, readyAtMs, remainingMs, status, reason: status === 'ready' ? 'none' : 'cooldown_active'});
function frozen(value) {
  assert.equal(Object.isFrozen(value), true);
  for (const field of Object.values(value)) if (field && typeof field === 'object') frozen(field);
}

test('SK16–SK17: initial state and literal actual-Kernel duration oracles', () => {
  const {provider, context} = clock();
  const state = create(instance);
  assert.deepEqual(state, initial()); // S01
  frozen(state);
  assert.notEqual(state, instance);
  assert.equal(provider.calls, 0);
  assert.deepEqual(evaluate(instance, state, context), assessment(1000)); // S02
  // Expected constants are independent of the implementation and Core formula.
  for (const [baseDurationMs, effectiveCdr, durationMs, readyAtMs] of [
    [1000, .25, 750, 1750], [1000, 0, 1000, 2000], [1000, 1, 0, 1000],
    [1001, .5, 500.5, 1500.5], [0, .25, 0, 1000],
  ]) { // S03–S06, zero base
    const result = start(instance, state, context, {baseDurationMs, effectiveCdr});
    assert.deepEqual(result, {status: 'started', reason: 'none', assessment: assessment(1000),
      durationMs, state: {...instance, startedAtMs: 1000, readyAtMs}});
    frozen(result);
    if (durationMs === 0) {
      assert.deepEqual(evaluate(instance, result.state, context), assessment(1000, 1000));
      assert.equal(start(instance, result.state, context, {baseDurationMs, effectiveCdr}).status, 'started');
    }
  }
  assert.deepEqual(state, initial());
  console.log('SKILL_COOLDOWN_DURATION_PASS S01-S06; literal_oracle; actual_Kernel; fractional_zero');
});

test('SK18–SK19: boundaries, reuse and exactly one clock observation', () => {
  const {provider, context} = clock();
  const state = active();
  for (const [now, remaining, status] of [[1250, 500, 'active'], [1749, 1, 'active'],
    [1750, 0, 'ready'], [2500, 0, 'ready']]) { // S07–S10
    provider.time = now;
    const before = provider.calls;
    assert.deepEqual(evaluate(instance, state, context), assessment(now, 1750, remaining, status));
    assert.equal(provider.calls, before + 1);
    assert.deepEqual(state, active());
  }
  provider.time = 1250;
  for (const changed of [config, {baseDurationMs: 0, effectiveCdr: 1},
    {baseDurationMs: Number.MAX_VALUE, effectiveCdr: 0}]) { // no refresh or duration calculation/overflow
    const before = provider.calls;
    const result = start(instance, state, context, changed);
    assert.deepEqual(result, {status: 'rejected', reason: 'cooldown_active',
      assessment: assessment(1250, 1750, 500, 'active'), durationMs: null, state: null}); // S11
    assert.equal(provider.calls, before + 1);
    frozen(result);
  }
  provider.time = 2000;
  const before = provider.calls;
  assert.deepEqual(start(instance, state, context, {baseDurationMs: 500, effectiveCdr: 0}),
    {status: 'started', reason: 'none', assessment: assessment(2000, 1750), durationMs: 500,
      state: {...instance, startedAtMs: 2000, readyAtMs: 2500}}); // S12/S19
  assert.equal(provider.calls, before + 1);
  assert.deepEqual(state, active());
  // Exact boundary start observes once too.
  provider.time = 1750;
  const boundaryReads = provider.calls;
  assert.equal(start(instance, state, context, config).state.readyAtMs, 2500);
  assert.equal(provider.calls, boundaryReads + 1);
  console.log('SKILL_COOLDOWN_BOUNDARY_PASS S07-S12/S19; exact_boundary; one_read; no_refresh');
});

test('SK16–SK19: fail-closed records, provider failures, rewind and representability', () => {
  const {provider, context} = clock(1250);
  let getterCalls = 0;
  const accessor = (record, key) => Object.defineProperty({...record}, key,
    {get() {getterCalls++; throw Error('must not invoke accessor');}, enumerable: true});
  const malformed = record => [null, [], 1, {...record, extra: true}, {...record, [Symbol('extra')]: true},
    Object.create(record), ...Object.keys(record).flatMap(key => {
      const missing = {...record}; delete missing[key];
      return [missing, accessor(record, key), Object.assign(Object.create({[key]: record[key]}), missing)];
    })];
  for (const invalid of [...malformed(instance), ...Object.keys(instance).flatMap(key =>
    ['', ' ', 1, null, undefined].map(value => ({...instance, [key]: value})))]) {
    assert.throws(() => create(invalid), TypeError);
    assert.throws(() => evaluate(invalid, initial(), context), TypeError);
    assert.throws(() => start(invalid, initial(), context, config), TypeError);
  }
  for (const invalid of [...malformed(initial()),
    ...['instanceId', 'skillId', 'entityId'].map(key => ({...initial(), [key]: 'mismatch'})), // S15
    {...initial(), startedAtMs: 1000}, {...initial(), readyAtMs: 1750},
    {...active(), readyAtMs: 999},
    ...['startedAtMs', 'readyAtMs'].flatMap(key => [NaN, Infinity, -1, '1000', undefined]
      .map(value => ({...active(), [key]: value})))]) {
    assert.throws(() => evaluate(instance, invalid, context), TypeError);
    assert.throws(() => start(instance, invalid, context, config), TypeError);
  }
  for (const invalid of [...malformed(config),
    ...[NaN, Infinity, -1, '1000', null, undefined].map(baseDurationMs => ({...config, baseDurationMs})),
    ...[NaN, Infinity, -1, 1.01, '.25', null, undefined].map(effectiveCdr => ({...config, effectiveCdr}))]) {
    for (const state of [initial(), active()]) assert.throws(() => start(instance, state, context, invalid), TypeError); // S16
  }
  assert.equal(provider.calls, 0, 'malformed data must fail before provider access');
  assert.equal(getterCalls, 0);
  for (const time of [NaN, Infinity, -1, '1000', undefined]) { // S17
    provider.time = time;
    assert.throws(() => evaluate(instance, initial(), context), TypeError);
    assert.throws(() => start(instance, initial(), context, config), TypeError);
  }
  const failure = new Error('provider failed');
  const throwing = createExecutionContext({clock: {now() {throw failure;}}});
  for (const operation of [() => evaluate(instance, initial(), throwing),
    () => start(instance, initial(), throwing, config)]) assert.throws(operation, error => error === failure);
  assert.throws(() => evaluate(instance, initial(), {}), TypeError);
  assert.throws(() => start(instance, initial(), {}, config), TypeError);
  provider.time = 900; // S18
  assert.throws(() => evaluate(instance, active(), context), TypeError);
  assert.throws(() => start(instance, active(), context, config), TypeError);
  for (const [time, baseDurationMs] of [[Number.MAX_VALUE, Number.MAX_VALUE], [2 ** 53, .25]]) { // S21
    provider.time = time;
    assert.throws(() => start(instance, initial(), context, {baseDurationMs, effectiveCdr: 0}), TypeError);
  }
  provider.time = Number.MAX_VALUE;
  assert.equal(start(instance, initial(), context, {baseDurationMs: 0, effectiveCdr: 0}).state.readyAtMs,
    Number.MAX_VALUE, 'zero duration does not require a later representable timestamp');
  console.log('SKILL_COOLDOWN_VALIDATION_PASS S15-S18/S21; closed_data; zero_invalid_reads; errors_propagate');
});

test('SK16–SK20: isolated instances/actors, immutable history and minimal composition', () => {
  const {modules} = JSON.parse(readFileSync(new URL('./skill-modules.json', import.meta.url), 'utf8'));
  const registry = modules.reduce(registerModule, createModuleRegistry());
  assert.deepEqual(composeModules(registry, configureModules(registry,
    {enable: ['entity', 'skill'], disable: ['progression', 'combat']})).moduleIds, ['entity', 'skill']);
  const actor = createEntity({id: 'player-1', kind: 'player'});
  const definition = createSkillDefinition({skillId: 'fireball'});
  const selected = createSkillInstance(definition, actor, {instanceId: 'cast-1'}); // S24
  const {provider, context} = clock();
  const caller = {...selected}, settings = {...config}, a = {...create(caller)};
  assert.deepEqual(evaluate(caller, a, context), assessment(1000));
  const b = start(caller, a, context, settings);
  assert.deepEqual(b.state, active());
  assert.deepEqual(a, initial());
  for (const other of [{...selected, instanceId: 'cast-2'},
    createSkillInstance(definition, createEntity({id: 'player-2', kind: 'player'}), {instanceId: 'cast-1'})]) {
    const independent = create(other); // S13/S14
    assert.equal(evaluate(other, independent, context).status, 'ready');
    const result = start(other, independent, context, {baseDurationMs: 500, effectiveCdr: 0});
    assert.deepEqual(result.state, {...other, startedAtMs: 1000, readyAtMs: 1500});
    assert.equal(b.state.readyAtMs, 1750);
  }
  provider.time = 2000;
  const c = start(caller, b.state, context, settings); // S22
  assert.deepEqual(c.state, {...instance, startedAtMs: 2000, readyAtMs: 2750});
  assert.notEqual(b.state, a);
  assert.notEqual(c.state, b.state);
  assert.notEqual(b.assessment, c.assessment);
  frozen(b); frozen(c);
  assert.throws(() => {b.state.readyAtMs = 1;}, TypeError);
  assert.throws(() => {b.assessment.observedAtMs = 1;}, TypeError);
  for (const input of [caller, settings, a, provider]) assert.equal(Object.isFrozen(input), false);
  caller.instanceId = 'changed'; settings.baseDurationMs = 1; a.readyAtMs = 1;
  assert.deepEqual(b.state, active());
  assert.deepEqual(selected, instance);
  assert.deepEqual(c.state, {...instance, startedAtMs: 2000, readyAtMs: 2750});
  console.log('SKILL_COOLDOWN_ISOLATION_PASS S13-S14/S22/S24; detached_history; entity_skill_only');
});

test('SK18–SK20: two deterministic sessions use literal traces without hidden time', () => {
  const dateNow = Date.now, random = Math.random;
  Date.now = Math.random = () => {throw Error('hidden time/random forbidden');};
  try {
    for (let session = 0; session < 2; session++) { // S20/S23
      const {provider, context} = clock();
      const a = create(instance), b = start(instance, a, context, config);
      assert.deepEqual(b, {status: 'started', reason: 'none', assessment: assessment(1000), durationMs: 750, state: active()});
      provider.time = 1250;
      assert.deepEqual(evaluate(instance, b.state, context), assessment(1250, 1750, 500, 'active'));
      provider.time = 1750;
      assert.deepEqual(evaluate(instance, b.state, context), assessment(1750, 1750));
      provider.time = 2000;
      assert.deepEqual(start(instance, b.state, context, config), {status: 'started', reason: 'none',
        assessment: assessment(2000, 1750), durationMs: 750,
        state: {...instance, startedAtMs: 2000, readyAtMs: 2750}});
      assert.equal(provider.calls, 4);
      assert.deepEqual(a, initial()); assert.deepEqual(b.state, active());
    }
  } finally {Date.now = dateNow; Math.random = random;}
  console.log('SKILL_COOLDOWN_REPLAY_PASS S20/S23; sessions2; literal_oracle; no_hidden_clock');
});
