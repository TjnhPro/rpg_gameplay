import assert from 'node:assert/strict';
import test from 'node:test';
import * as g from '@rpg/gameplay';

function contract(name, run) {
  test(name, () => {
    let assertions = 0;
    const checked = new Proxy(assert, {get(target, key) {
      const method = Reflect.get(target, key);
      return (...args) => {assertions++; return method(...args);};
    }});
    run(checked);
    assert.ok(assertions > 0, 'contract must execute real assertions');
  });
}
const target = {id: 'target', kind: 'npc'}, source = {id: 'source', kind: 'player'};
const origin = {kind: 'system', sourceId: 'environment', sourceKey: 'zone'};
const entities = g.addEntity(g.addEntity(g.createEntityCollection(), target), source);
const timed = durationMs => ({mode: 'timed', durationMs});
const periodic = (kind = 'dot', intervalMs = 1000, resourceId = 'vital') => ({mode: 'periodic', kind, intervalMs, resourceId});
const lifePolicy = {resourceId: 'vital', minimum: 0, maximum: 100};
function fixture(initial = 100, at = 1000) {
  const clock = {time: at, now() {return this.time;}}, context = g.createExecutionContext({clock});
  const lifecycle = g.createEffectLifecycleState(g.createEffectState(target), context);
  return {clock, context, lifecycle, state: g.createEffectPeriodicState(lifecycle),
    modifiers: g.createEffectModifierState(lifecycle), statuses: g.createEffectStatusState(lifecycle),
    resources: g.createEntityResourceState(target, {vital: {minimum: 0, maximum: 100, current: initial}}),
    life: g.createEntityLifeState(target, {status: 'alive'})};
}
function addition(f, id, duration = timed(5000), effectId = 'poison', sourceRef = origin) {
  const instance = g.createEffectInstance({effectId}, target, {effectInstanceId: id, source: sourceRef});
  const application = g.applyEffect({effectId}, {instance}, f.lifecycle.effectState, entities, f.life,
    {sourceEligible: true, targetEligible: true, allowedTargetLifeStatuses: ['alive']});
  return g.applyEffectStack(f.lifecycle, application, duration, {mode: 'stack', maxStacks: 8}, f.context);
}
function commit(f, transition, capture) {
  const next = g.applyEffectPeriodicTransition(f.state, f.lifecycle, transition, capture);
  assert.equal(next.status, 'applied');
  const modifiers = g.applyEffectModifierTransition(f.modifiers, transition,
    capture === undefined ? undefined : {classification: 'neutral', modifiers: []});
  const statuses = g.applyEffectStatusTransition(f.statuses, f.lifecycle, transition,
    capture === undefined ? undefined : {statusIds: ['custom'], restrictionIds: ['custom-block']});
  assert.equal(modifiers.status, 'applied'); assert.equal(statuses.status, 'applied');
  // Commit only after every companion accepted the exact same lifecycle candidate.
  f.lifecycle = transition.state; f.state = next.state; f.modifiers = modifiers.state; f.statuses = statuses.state;
  return next;
}
function add(f, id, capture = periodic(), duration, effectId, sourceRef) {
  return commit(f, addition(f, id, duration, effectId, sourceRef), capture);
}
function advance(f, at) {f.clock.time = at; return commit(f, g.advanceEffectLifecycle(f.lifecycle, f.context));}
function plan(f, life = f.life) {return g.getNextDueEffectTick(f.lifecycle, f.state, life, f.context);}
function execute(f, amount = 10) {
  const assessment = plan(f); assert.equal(assessment.status, 'due');
  const intent = assessment.intent, beforeLife = f.life;
  // Real Entity -> Core. No resource arithmetic or substitute calculator here.
  const resource = g.transitionEntityResource(f.resources, intent.resourceId,
    {maximum: 100, amount, operation: intent.kind === 'dot' ? 'decrease' : 'increase',
      rule: {minimum: 0, currentAboveMaximum: 'allow', allowIncreaseFromMinimum: false}});
  const life = intent.resourceId === lifePolicy.resourceId
    ? g.resolveEntityDefeat(beforeLife, resource.state, lifePolicy) : null;
  const completion = g.completeEffectPeriodicTick(f.lifecycle, f.state, intent, beforeLife, f.context);
  assert.equal(completion.status, 'applied');
  f.resources = resource.state; f.life = life?.state ?? beforeLife; f.state = completion.state;
  return {intent, resource: resource.transition, life: life?.after ?? beforeLife.status, event: completion.events[0]};
}
function drain(f, amount = 10) {
  const results = [];
  while (plan(f).status === 'due') results.push(execute(f, amount));
  return results;
}
function frozen(value) {if (value && typeof value === 'object') {assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen);}}

contract('EF31: explicit none/periodic capture, immutable payload, initialization and first tick', assert => {
  const f = fixture(), old = f.state;
  assert.deepEqual(old, {entityId: 'target', observedAtMs: 1000, entries: []});
  const transition = addition(f, 'A');
  assert.deepEqual(g.applyEffectPeriodicTransition(old, f.lifecycle, transition),
    {status: 'rejected', reason: 'capture_required', state: null});
  const input = periodic(); commit(f, transition, input); input.intervalMs = 1; input.kind = 'hot';
  assert.equal(Object.isFrozen(input), false);
  assert.deepEqual(f.state.entries, [{effectInstanceId: 'A', mode: 'periodic', kind: 'dot', intervalMs: 1000, resourceId: 'vital', nextTickAtMs: 2000}]);
  add(f, 'N', {mode: 'none'}, undefined, 'metadata');
  assert.equal(plan(f).status, 'idle'); f.clock.time = 1999; assert.equal(plan(f).status, 'idle');
  f.clock.time = 2000; const saved = JSON.stringify(f); const due = plan(f);
  assert.deepEqual(due, {status: 'due', reason: 'none', intent: {effectInstanceId: 'A', effectId: 'poison', targetEntityId: 'target', kind: 'dot', resourceId: 'vital', dueAtMs: 2000}});
  assert.equal(JSON.stringify(f), saved); assert.equal(old.entries.length, 0);
  assert.throws(() => g.createEffectPeriodicState(f.lifecycle), TypeError);
  frozen(due); frozen(f.state); console.log('EFFECT_PERIODIC_CAPTURE_PASS');
});

contract('EF32: catch-up tick-before-expire, lexical global order, fractions and persistent', assert => {
  const f = fixture(); add(f, 'A'); f.clock.time = 6000;
  const candidate = g.advanceEffectLifecycle(f.lifecycle, f.context);
  assert.deepEqual(g.applyEffectPeriodicTransition(f.state, f.lifecycle, candidate), {status: 'rejected', reason: 'pending_ticks', state: null});
  const outputs = drain(f);
  assert.deepEqual(outputs.map(o => o.intent.dueAtMs), [2000, 3000, 4000, 5000, 6000]);
  assert.deepEqual(outputs.map(o => o.resource.after), [90, 80, 70, 60, 50]);
  assert.deepEqual(outputs.map(o => o.event.atMs), [2000, 3000, 4000, 5000, 6000]);
  assert.equal(plan(f).status, 'idle'); assert.equal(f.lifecycle.effectState.instances.length, 1);
  commit(f, candidate); assert.deepEqual(f.state.entries, []); assert.equal(candidate.events[0].atMs, 6000);
  assert.deepEqual(f.statuses.snapshots, []); assert.deepEqual(f.modifiers.snapshots, []);
  for (const kind of ['dot', 'hot']) {const short = fixture(); add(short, 'short', periodic(kind), timed(500)); short.clock.time = 6000; assert.equal(plan(short).status, 'idle'); advance(short, 6000);}
  const same = fixture(); add(same, 'C', periodic('hot'), {mode: 'persistent'}); add(same, 'B', periodic(), {mode: 'persistent'}); add(same, 'A', periodic(), {mode: 'persistent'});
  same.clock.time = 3000;
  assert.deepEqual(drain(same, 0).map(o => [o.intent.dueAtMs, o.intent.effectInstanceId]), [[2000,'A'],[2000,'B'],[2000,'C'],[3000,'A'],[3000,'B'],[3000,'C']]);
  advance(same, 3000); assert.equal(same.state.entries.length, 3);
  const mixed = fixture(); add(mixed, 'A', periodic('dot', 1000)); add(mixed, 'B', periodic('hot', 1500)); mixed.clock.time = 4000;
  assert.deepEqual(drain(mixed, 0).map(o => [o.intent.dueAtMs, o.intent.effectInstanceId]), [[2000,'A'],[2500,'B'],[3000,'A'],[4000,'A'],[4000,'B']]);
  const fractional = fixture(100, 0); add(fractional, 'F', periodic('hot', 0.25), timed(0.75)); fractional.clock.time = 1;
  assert.deepEqual(drain(fractional, 0).map(o => o.intent.dueAtMs), [0.25, 0.5, 0.75]);
  console.log('EFFECT_PERIODIC_TIMELINE_PASS');
});

contract('EF32/35: independent stack cursors, refresh preservation, consume and group removal', assert => {
  const f = fixture(); add(f, 'A'); advance(f, 1500); add(f, 'B');
  assert.deepEqual(f.state.entries.map(e => e.nextTickAtMs), [2000, 2500]);
  f.clock.time = 3500; drain(f, 0); advance(f, 3500);
  assert.deepEqual(f.state.entries.map(e => e.nextTickAtMs), [4000, 4500]);
  for (const duration of [5000, 6000]) {
    const previous = structuredClone(f.state.entries);
    const refresh = g.refreshEffectStackLifetime(f.lifecycle, 'A', timed(duration), f.context);
    assert.throws(() => g.applyEffectPeriodicTransition(f.state, f.lifecycle, refresh, periodic('hot')), TypeError);
    commit(f, refresh); assert.deepEqual(f.state.entries, previous);
  }
  const group = {targetEntityId: 'target', effectId: 'poison', sourceKey: 'zone'};
  commit(f, g.consumeEffectStacks(f.lifecycle, {group, count: 1}));
  assert.deepEqual(f.state.entries.map(e => [e.effectInstanceId, e.nextTickAtMs]), [['A',4000]]);
  add(f, 'U', periodic('hot'), {mode: 'persistent'}, 'other');
  commit(f, g.removeEffectStackGroup(f.lifecycle, group, 'explicit'));
  assert.deepEqual(f.state.entries.map(e => e.effectInstanceId), ['U']);
  commit(f, g.removeEffectLifetime(f.lifecycle, 'U', 'explicit')); assert.deepEqual(f.state.entries, []);
  const extension = fixture(); add(extension, 'X', periodic(), timed(500)); advance(extension, 1200);
  commit(extension, g.refreshEffectStackLifetime(extension.lifecycle, 'X', timed(2000), extension.context));
  const incoming = g.createEffectInstance({effectId:'poison'}, target, {effectInstanceId:'incoming',source:origin});
  const accepted = g.applyEffect({effectId:'poison'},{instance:incoming},extension.lifecycle.effectState,entities,extension.life,
    {sourceEligible:true,targetEligible:true,allowedTargetLifeStatuses:['alive']});
  commit(extension,g.applyEffectStack(extension.lifecycle,accepted,timed(3000),{mode:'refresh',maxStacks:1},extension.context));
  assert.equal(extension.state.entries[0].nextTickAtMs, 2000); extension.clock.time = 2000; assert.equal(plan(extension).status, 'due');
  console.log('EFFECT_PERIODIC_STACK_PASS');
});

contract('EF33/34: actual Entity/Core decrease/increase bounds, applied magnitude and no-op success', assert => {
  const f = fixture(50); add(f, 'H', periodic('hot')); f.clock.time = 2000;
  assert.deepEqual(execute(f).resource, {resource: 'vital', before: 50, after: 60, applied: 10, reachedMinimum: false});
  const cap = fixture(95); add(cap, 'H', periodic('hot')); cap.clock.time = 2000;
  assert.deepEqual(execute(cap).resource, {resource: 'vital', before: 95, after: 100, applied: 5, reachedMinimum: false});
  cap.clock.time = 3000; assert.equal(execute(cap).resource.applied, 0); assert.equal(cap.state.entries[0].nextTickAtMs, 4000);
  cap.clock.time = 4000; assert.equal(execute(cap, 0).resource.applied, 0); assert.equal(cap.state.entries[0].nextTickAtMs, 5000);
  const above = fixture(); above.resources = {entityId: 'target', current: {vital: 120}}; add(above, 'D'); above.clock.time = 2000;
  assert.deepEqual(execute(above).resource, {resource: 'vital', before: 120, after: 100, applied: 10, reachedMinimum: false});
  const custom = fixture(); custom.resources = g.createEntityResourceState(target, {'custom-energy': {minimum: 0, maximum: 100, current: 80}});
  add(custom, 'E', periodic('dot', 1000, 'custom-energy')); custom.clock.time = 2000;
  assert.equal(execute(custom).resource.after, 70); assert.equal(custom.life.status, 'alive');
  console.log('EFFECT_PERIODIC_RESOURCE_PASS');
});

contract('EF33/35: canonical defeat stops same-time later ticks, source death independent, explicit cleanup', assert => {
  const f = fixture(5); add(f, 'B', periodic('hot')); add(f, 'A'); f.clock.time = 2000;
  const hit = execute(f);
  assert.deepEqual(hit.resource, {resource: 'vital', before: 5, after: 0, applied: 5, reachedMinimum: true});
  assert.equal(hit.life, 'dead'); assert.equal(f.state.entries.find(e => e.effectInstanceId === 'A').nextTickAtMs, 3000);
  assert.deepEqual(plan(f), {status: 'blocked', reason: 'target_dead', intent: null});
  assert.deepEqual(g.completeEffectPeriodicTick(f.lifecycle, f.state, hit.intent, f.life, f.context),
    {status: 'rejected', reason: 'target_dead', state: null, events: []});
  assert.equal(f.state.entries.find(e => e.effectInstanceId === 'B').nextTickAtMs, 2000);
  // Explicit canonical defeat cleanup at the last lifecycle snapshot cancels future work.
  for (const id of ['A','B']) commit(f, g.removeEffectLifetime(f.lifecycle, id, 'target_defeated'));
  advance(f, 2000); assert.deepEqual(f.state.entries, []); assert.equal(g.getEntityResourceCurrent(f.resources, 'vital'), 0);
  const independent = fixture(); add(independent, 'D', periodic(), timed(5000), 'poison', {kind: 'entity', sourceId: 'source', sourceKey: 'cast'});
  const sourceLife = g.createEntityLifeState(source, {status: 'alive'});
  const sourceResources = g.createEntityResourceState(source, {vital: {minimum: 0, maximum: 100, current: 0}});
  assert.equal(g.resolveEntityDefeat(sourceLife, sourceResources, lifePolicy).after, 'dead');
  independent.clock.time = 2000; assert.equal(execute(independent).resource.after, 90);
  console.log('EFFECT_PERIODIC_DEATH_PASS');
});

contract('EF35: failed execution recovery, stale duplicate/order/horizon rejection, no partial commit', assert => {
  const f = fixture(); add(f, 'A'); f.clock.time = 2000;
  const intent = plan(f).intent, saved = JSON.stringify(f);
  for (const amount of [-1, NaN, Infinity, '10']) assert.throws(() => execute(f, amount), TypeError);
  assert.equal(JSON.stringify(f), saved); assert.deepEqual(plan(f).intent, intent);
  const missing = fixture(); add(missing, 'M', periodic('hot', 1000, 'unknown')); missing.clock.time = 2000;
  assert.throws(() => execute(missing), TypeError); assert.equal(missing.state.entries[0].nextTickAtMs, 2000);
  f.clock.time = 1999; assert.equal(g.completeEffectPeriodicTick(f.lifecycle, f.state, intent, f.life, f.context).reason, 'stale_tick');
  f.clock.time = 999; assert.equal(plan(f).reason, 'time_regressed');
  assert.equal(g.completeEffectPeriodicTick(f.lifecycle, f.state, intent, f.life, f.context).reason, 'time_regressed');
  f.clock.time = 2000;
  for (const patch of [{effectInstanceId: 'other'}, {effectId: 'other'}, {targetEntityId: 'other'}, {resourceId: 'other'}, {kind: 'hot'}, {dueAtMs: 3000}]) {
    assert.equal(g.completeEffectPeriodicTick(f.lifecycle, f.state, {...intent, ...patch}, f.life, f.context).reason, 'stale_tick');
  }
  execute(f);
  assert.deepEqual(g.completeEffectPeriodicTick(f.lifecycle, f.state, intent, f.life, f.context), {status: 'rejected', reason: 'stale_tick', state: null, events: []});
  const before = f.state; f.clock.time = 1000; add(f, 'B'); // same canonical observed timestamp, another due cursor
  const wrong = {...intent, effectInstanceId: 'A', dueAtMs: 3000}; f.clock.time = 4000;
  assert.equal(g.completeEffectPeriodicTick(f.lifecycle, f.state, wrong, f.life, f.context).reason, 'stale_tick');
  const transition = g.advanceEffectLifecycle(f.lifecycle, f.context), unchanged = JSON.stringify(f);
  assert.equal(g.applyEffectPeriodicTransition(f.state, f.lifecycle, transition).reason, 'pending_ticks');
  assert.equal(JSON.stringify(f), unchanged); assert.equal(before.entries[0].nextTickAtMs, 3000);
  console.log('EFFECT_PERIODIC_RECOVERY_PASS');
});

contract('EF31/35: closed records, zero getter invocation, alignment, forged receipts and timestamp overflow', assert => {
  const f = fixture(), transition = addition(f, 'A');
  for (const interval of [0,-1,NaN,Infinity,-Infinity,'1',null]) assert.throws(() => g.applyEffectPeriodicTransition(f.state, f.lifecycle, transition, periodic('dot', interval)), TypeError);
  for (const input of [{}, {mode:'none', extra:1}, {...periodic(), kind:'other'}, {...periodic(), resourceId:' '}, {...periodic(), [Symbol()]:1}]) assert.throws(() => g.applyEffectPeriodicTransition(f.state, f.lifecycle, transition, input), TypeError);
  let getters = 0; const accessor = {get mode() {getters++; return 'none';}};
  assert.throws(() => g.applyEffectPeriodicTransition(f.state, f.lifecycle, transition, accessor), TypeError); assert.equal(getters, 0);
  add(f, 'A');
  for (const state of [{...f.state, entityId:'wrong'}, {...f.state, observedAtMs:999}, {...f.state, entries:[]}, {...f.state, entries:[...f.state.entries,...f.state.entries]}, {...f.state, entries:new Array(1)}, {...f.state, entries:[{...f.state.entries[0], effectInstanceId:'orphan'}]}, {...f.state, entries:[{...f.state.entries[0], nextTickAtMs:1000}]}, {...f.state, entries:[{...f.state.entries[0], nextTickAtMs:Infinity}]}, {...f.state, extra:1}]) assert.throws(() => g.getNextDueEffectTick(f.lifecycle, state, f.life, f.context), TypeError);
  assert.throws(() => plan(f, {...f.life, entityId:'wrong'}), TypeError);
  assert.throws(() => plan(f, Object.create(f.life)), TypeError);
  const nextGetter = {...f.state.entries[0]}; Object.defineProperty(nextGetter,'nextTickAtMs',{get(){getters++;return 2000;}});
  assert.throws(() => g.getNextDueEffectTick(f.lifecycle,{...f.state,entries:[nextGetter]},f.life,f.context),TypeError); assert.equal(getters,0);
  add(f, 'B'); assert.throws(() => g.getNextDueEffectTick(f.lifecycle,{...f.state,entries:[...f.state.entries].reverse()},f.life,f.context),TypeError);
  f.clock.time = 2000; const intent=plan(f).intent;
  assert.throws(() => g.completeEffectPeriodicTick(f.lifecycle,f.state,{...intent,extra:1},f.life,f.context),TypeError);
  const forged={...g.advanceEffectLifecycle(f.lifecycle,f.context),events:[]};
  assert.equal(g.applyEffectPeriodicTransition(f.state,f.lifecycle,forged).reason,'pending_ticks');
  const rejected = g.removeEffectLifetime(f.lifecycle,'absent','explicit');
  assert.equal(g.applyEffectPeriodicTransition(f.state,f.lifecycle,rejected).reason,'transition_rejected');
  const badEntity={...forged,state:{...forged.state,effectState:{...forged.state.effectState,entityId:'wrong',instances:[]},lifetimes:[]}};
  assert.equal(g.applyEffectPeriodicTransition(f.state,f.lifecycle,badEntity).reason,'stale_transition');
  const huge=fixture(100,1e308), hugeAdd=addition(huge,'H',{mode:'persistent'});
  assert.throws(() => g.applyEffectPeriodicTransition(huge.state,huge.lifecycle,hugeAdd,periodic('dot',1)),TypeError);
  assert.throws(() => g.applyEffectPeriodicTransition(huge.state,huge.lifecycle,hugeAdd,periodic('dot',1e308)),TypeError);
  const overflow=fixture(100,0); add(overflow,'O',periodic('dot',1e308),{mode:'persistent'}); overflow.clock.time=1e308;
  const before=JSON.stringify(overflow); assert.throws(() => execute(overflow,0),TypeError); assert.equal(JSON.stringify(overflow),before);
  console.log('EFFECT_PERIODIC_VALIDATION_PASS');
});

contract('EF31–35: independent literal replay, shared companions, four origins and no hidden runtime', assert => {
  function session() {
    const f=fixture(50), trace=[]; add(f,'A',periodic(),timed(3000)); add(f,'R',periodic('hot',1500),{mode:'persistent'},'regeneration');
    advance(f,1500); add(f,'B',periodic(),timed(3000));
    const payloads=structuredClone([f.modifiers.snapshots,f.statuses.snapshots]);
    f.clock.time=3000;
    for(const o of drain(f)) trace.push([o.intent.dueAtMs,o.intent.effectInstanceId,o.resource.before,o.resource.after,o.resource.applied,o.life]);
    assert.deepEqual([f.modifiers.snapshots,f.statuses.snapshots],payloads);
    advance(f,3000); commit(f,g.refreshEffectStackLifetime(f.lifecycle,'B',timed(2000),f.context));
    commit(f,g.consumeEffectStacks(f.lifecycle,{group:{targetEntityId:'target',effectId:'poison',sourceKey:'zone'},count:1}));
    f.clock.time=5000;
    for(const o of drain(f)) trace.push([o.intent.dueAtMs,o.intent.effectInstanceId,o.resource.before,o.resource.after,o.resource.applied,o.life]);
    advance(f,5000); commit(f,g.removeEffectLifetime(f.lifecycle,'R','session_cleanup'));
    return {trace,resources:f.resources,life:f.life,lifecycle:f.lifecycle,periodic:f.state,status:f.statuses,modifiers:f.modifiers};
  }
  const original=[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval];
  const forbidden=()=>{throw Error('hidden runtime forbidden');}; let first,second;
  try {Date.now=Math.random=globalThis.setTimeout=globalThis.setInterval=forbidden; first=session(); second=session();}
  finally {[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval]=original;}
  const expected=[[2000,'A',50,40,10,'alive'],[2500,'B',40,30,10,'alive'],[2500,'R',30,40,10,'alive'],[3000,'A',40,30,10,'alive'],[3500,'B',30,20,10,'alive'],[4000,'R',20,30,10,'alive'],[4500,'B',30,20,10,'alive']];
  assert.deepEqual(first.trace,expected); assert.deepEqual(second.trace,expected); assert.deepEqual(first,second);
  assert.notEqual(first.periodic,second.periodic); assert.deepEqual(first.periodic.entries,[]); assert.deepEqual(first.lifecycle.effectState.instances,[]);
  assert.deepEqual(first.resources,{entityId:'target',current:{vital:20}}); assert.equal(first.life.status,'alive');
  for(const [i,name] of ['skill','equipment','environment','system'].entries()) {
    const f=fixture();add(f,'S',periodic(),timed(5000),name,{kind:i<2?'entity':'system',sourceId:i<2?'source':name,sourceKey:name});f.clock.time=2000;assert.equal(execute(f).resource.after,90);
  }
  for (const value of [first.resources, first.life, first.lifecycle, first.periodic, first.status, first.modifiers]) frozen(value);
  console.log('EFFECT_PERIODIC_REPLAY_PASS');
});
