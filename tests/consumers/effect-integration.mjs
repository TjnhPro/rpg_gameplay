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
    assert.ok(assertions > 0, 'integration requires actual assertions');
  });
}
const timed = durationMs => ({mode: 'timed', durationMs});
const origin = sourceKey => ({kind: 'entity', sourceId: 'caster', sourceKey});
const dot = () => ({mode: 'periodic', kind: 'dot', intervalMs: 1000, resourceId: 'health'});
const hot = () => ({...dot(), kind: 'hot'});
const modifier = (value, operation) => ({modifierId: 'attack', target: 'attack', value, operation, enabled: true});
function payload({modifiers = [], classification = 'neutral', statusIds = [], restrictionIds = [], periodic = {mode: 'none'}} = {}) {
  return {modifier: {modifiers, classification}, status: {statusIds, restrictionIds}, periodic};
}
function fixture(id = 'target', initial = 100) {
  // Every session constructs its own Entity/configuration/providers/snapshots.
  const target = g.createEntity({id, kind: 'monster'}), caster = g.createEntity({id: 'caster', kind: 'player'});
  const entities = [target, caster].reduce(g.addEntity, g.createEntityCollection());
  const clock = {time: 1000, now() {return this.time;}}, context = g.createExecutionContext({clock});
  const lifecycle = g.createEffectLifecycleState(g.createEffectState(target), context);
  return {target, caster, entities, clock, context, base: g.createEntityAttributeState(target, {}),
    bounds: {resourceId: 'health', minimum: 0, maximum: 100},
    current: Object.freeze({lifecycle, modifiers: g.createEffectModifierState(lifecycle),
      statuses: g.createEffectStatusState(lifecycle), periodic: g.createEffectPeriodicState(lifecycle),
      resources: g.createEntityResourceState(target, {health: {minimum: 0, maximum: 100, current: initial}}),
      life: g.createEntityLifeState(target, {status: 'alive'})}), events: []};
}
function aligned(current) {
  const {lifecycle, modifiers, statuses, periodic} = current;
  const ids = lifecycle.effectState.instances.map(i => i.effectInstanceId);
  assert.deepEqual(modifiers.lifecycle, lifecycle);
  for (const companion of [statuses, periodic]) {
    assert.equal(companion.entityId, lifecycle.effectState.entityId);
    assert.equal(companion.observedAtMs, lifecycle.observedAtMs);
  }
  assert.deepEqual(modifiers.snapshots.map(s => s.effectInstanceId), ids);
  assert.deepEqual(statuses.snapshots.map(s => s.effectInstanceId), ids);
  assert.deepEqual(periodic.entries.map(s => s.effectInstanceId), ids);
  g.listActiveEffectModifiers(modifiers); g.listActiveEffectStatuses(lifecycle, statuses);
}
function stage(f, transition, capture) {
  const baseline = f.current;
  const periodic = g.applyEffectPeriodicTransition(baseline.periodic, baseline.lifecycle, transition, capture?.periodic);
  if (periodic.status !== 'applied') return {baseline, reason: periodic.reason, next: null};
  const modifiers = g.applyEffectModifierTransition(baseline.modifiers, transition, capture?.modifier);
  const statuses = g.applyEffectStatusTransition(baseline.statuses, baseline.lifecycle, transition, capture?.status);
  if (modifiers.status !== 'applied' || statuses.status !== 'applied') return {baseline, reason: 'companion_rejected', next: null};
  const next = Object.freeze({...baseline, lifecycle: transition.state, modifiers: modifiers.state,
    statuses: statuses.state, periodic: periodic.state});
  aligned(next);
  return {baseline, next, events: transition.events};
}
function publish(f, candidate) {
  // Local L4 baseline identity guard; no persistence/concurrency engine or stale merge.
  if (!candidate.next || candidate.baseline !== f.current) return false;
  aligned(candidate.next); f.current = candidate.next; f.events.push(...candidate.events); return true;
}
function commit(f, transition, capture) {assert.equal(publish(f, stage(f, transition, capture)), true);}
function application(f, id, effectId = 'poison', source = origin('skill/poison'), eligible = true) {
  const definition = g.createEffectDefinition({effectId});
  const instance = g.createEffectInstance(definition, f.target, {effectInstanceId: id, source});
  return g.applyEffect(definition, {instance}, f.current.lifecycle.effectState, f.entities, f.current.life,
    {sourceEligible: true, targetEligible: eligible, allowedTargetLifeStatuses: ['alive']});
}
function add(f, id, capture = payload(), duration = timed(5000), effectId, source, policy, start = false) {
  const applied = application(f, id, effectId, source), before = f.current.lifecycle;
  const transition = start ? g.startEffectLifetime(before, applied, duration, f.context)
    : g.applyEffectStack(before, applied, duration, policy ?? {mode: 'stack', maxStacks: 3}, f.context);
  if (transition.status === 'rejected') return transition;
  commit(f, transition, capture); return transition;
}
function plan(f) {return g.getNextDueEffectTick(f.current.lifecycle, f.current.periodic, f.current.life, f.context);}
function tick(f, amount = 10) {
  const baseline = f.current, assessment = plan(f); assert.equal(assessment.status, 'due');
  const intent = assessment.intent;
  const resource = g.transitionEntityResource(baseline.resources, intent.resourceId,
    {maximum: f.bounds.maximum, amount, operation: intent.kind === 'dot' ? 'decrease' : 'increase',
      rule: {minimum: f.bounds.minimum, currentAboveMaximum: 'allow', allowIncreaseFromMinimum: false}});
  const life = g.resolveEntityDefeat(baseline.life, resource.state, f.bounds);
  const completion = g.completeEffectPeriodicTick(baseline.lifecycle, baseline.periodic, intent, baseline.life, f.context);
  assert.equal(completion.status, 'applied');
  const next = Object.freeze({...baseline, resources: resource.state, life: life.state, periodic: completion.state});
  assert.equal(publish(f, {baseline, next, events: completion.events}), true);
  return [intent.dueAtMs, intent.effectInstanceId, resource.transition.before, resource.transition.after,
    resource.transition.applied, life.after];
}
function drain(f, amount = 10) {const rows = []; while (plan(f).status === 'due') rows.push(tick(f, amount)); return rows;}
function advance(f, time) {f.clock.time = time; drain(f); commit(f, g.advanceEffectLifecycle(f.current.lifecycle, f.context));}
function remove(f, id, reason = 'explicit') {commit(f, g.removeEffectLifetime(f.current.lifecycle, id, reason));}
function stats(f) {
  return g.calculateEntityStats(f.base, {attributeOrder: [], statOrder: ['attack'], attributeRules: {}, attributeBaselines: {},
    baseStats: {attack: 100}, flatContributions: {},
    rules: {attack: {default: 0, bounds: {}, enabled: true, precision: {decimalPlaces: 8}, scaling: [], training: 0}},
    modifiers: g.listActiveEffectModifiers(f.current.modifiers)}).stats.attack;
}
function gate(f, blockedByRestrictionIds) {
  const result = g.evaluateEffectRestrictionGate(f.current.lifecycle, f.current.statuses, {blockedByRestrictionIds});
  assert.equal(result.entityId, f.target.id); return result;
}
function skill(f, options = {}) {
  return g.evaluateSkillActivationAdmission({skillId: 'magic'}, {instanceId: 'magic-1', skillId: 'magic', entityId: f.target.id},
    f.target.id, f.entities, options.life ?? f.current.life, {owned: options.owned ?? true,
      rank: options.rank ?? {mode: 'not_required'}, eligible: gate(f, ['disable-all-actions', 'disable-magic-skill']).status === 'allowed'});
}
function combat(f, life = f.current.life) {
  const action = g.createCombatActionContext({actionId: 'action-1', actionType: 'attack', sourceEntityId: f.target.id,
    target: {kind: 'entity', entityId: f.caster.id}});
  return g.evaluateCombatActionAdmission(action, f.entities, life,
    {eligible: gate(f, ['disable-all-actions']).status === 'allowed'});
}
function frozen(value) {if (value && typeof value === 'object') {assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen);}}

contract('EF36: complete application/lifecycle/companions through actual Resource and stat owners', assert => {
  const poison = fixture(); add(poison, 'A', payload({periodic: dot()}), timed(5000), 'poison', origin('skill/poison'), undefined, true);
  poison.clock.time = 6000; const rows = drain(poison);
  assert.deepEqual(rows, [[2000,'A',100,90,10,'alive'],[3000,'A',90,80,10,'alive'],[4000,'A',80,70,10,'alive'],[5000,'A',70,60,10,'alive'],[6000,'A',60,50,10,'alive']]);
  commit(poison, g.advanceEffectLifecycle(poison.current.lifecycle, poison.context));
  assert.deepEqual(poison.events.map(e => [e.type,e.atMs]), [['started',1000],['tick-completed',2000],['tick-completed',3000],['tick-completed',4000],['tick-completed',5000],['tick-completed',6000],['expired',6000]]);
  assert.deepEqual(poison.current.periodic.entries, []); assert.equal(plan(poison).status, 'idle');
  const regen = fixture('healed', 70); add(regen, 'R', payload({periodic: hot()}), timed(4000), 'regen'); regen.clock.time = 5000;
  assert.deepEqual(drain(regen).map(r => [r[3],r[4]]), [[80,10],[90,10],[100,10],[100,0]]);
  commit(regen, g.advanceEffectLifecycle(regen.current.lifecycle, regen.context)); aligned(regen.current);
  const numerical = fixture(); const base = numerical.base;
  add(numerical, 'buff', payload({classification: 'buff', modifiers: [modifier(.2,'add_percent')]}), timed(5000), 'focus');
  add(numerical, 'debuff', payload({classification: 'debuff', modifiers: [modifier(-10,'add_flat')]}), timed(5000), 'weakness');
  assert.equal(stats(numerical),108); remove(numerical,'debuff'); assert.equal(stats(numerical),120);
  advance(numerical,6000); assert.equal(stats(numerical),100); assert.equal(numerical.base,base); assert.deepEqual(base.baseAttributes,{});
  for(const f of [poison,regen,numerical]) {aligned(f.current); frozen(f.current);}
  console.log('EFFECT_INTEGRATION_E2E_PASS');
});

contract('EF36/37: restrictions compose with actual independent Skill/Combat and Effect admissions', assert => {
  const f=fixture();
  add(f,'silence',payload({statusIds:['silenced'],restrictionIds:['disable-magic-skill']}),timed(5000),'silence');
  add(f,'stun',payload({statusIds:['stunned'],restrictionIds:['disable-all-actions']}),timed(5000),'stun');
  assert.equal(skill(f).reason,'actor_ineligible'); assert.equal(combat(f).reason,'source_ineligible');
  assert.deepEqual(gate(f,['disable-all-actions','disable-magic-skill']).matches.map(m=>m.effectInstanceId),['silence','stun']);
  remove(f,'stun'); assert.equal(combat(f).status,'admitted'); assert.equal(skill(f).reason,'actor_ineligible');
  advance(f,6000); assert.equal(skill(f).status,'admitted');
  assert.equal(skill(f,{owned:false}).reason,'skill_not_owned');
  assert.equal(skill(f,{rank:{mode:'required',currentRank:0,minimumRank:1}}).reason,'skill_rank_too_low');
  assert.equal(skill(f,{life:{...f.current.life,status:'dead'}}).reason,'actor_dead');
  assert.equal(combat(f,{...f.current.life,status:'dead'}).reason,'source_dead');
  add(f,'immune',payload({statusIds:['poison-immunity'],restrictionIds:['immune-poison']}),{mode:'persistent'},'ward');
  const blocked=gate(f,['immune-poison']); assert.equal(blocked.status,'blocked');
  const before=f.current;
  assert.equal(application(f,'P','poison',origin('spell'),blocked.status==='allowed').reason,'target_ineligible');
  const burning=gate(f,['immune-burning']); assert.equal(burning.status,'allowed');
  const admitted=application(f,'F','burning',origin('spell'),burning.status==='allowed'); assert.equal(admitted.status,'applied');
  commit(f,g.startEffectLifetime(f.current.lifecycle,admitted,timed(1000),f.context),payload());
  assert.equal(before.lifecycle.effectState.instances.length,1); aligned(f.current);
  console.log('EFFECT_INTEGRATION_ADMISSION_PASS');
});

contract('EF36: independent stack contributions, overflow/consume/group cleanup and refresh capture retention', assert => {
  const f=fixture(), capture=payload({periodic:dot(),modifiers:[modifier(1,'add_flat')],statusIds:['poisoned'],restrictionIds:['custom']});
  for(const id of ['C','A','B']) add(f,id,capture);
  assert.equal(add(f,'overflow',capture).reason,'max_stacks_reached'); assert.equal(stats(f),103);
  const group={targetEntityId:f.target.id,effectId:'poison',sourceKey:'skill/poison'};
  assert.equal(g.inspectEffectStackGroups(f.current.lifecycle)[0].stackCount,3);
  commit(f,g.consumeEffectStacks(f.current.lifecycle,{group,count:1}));
  assert.deepEqual(f.current.periodic.entries.map(e=>e.effectInstanceId),['C','B']); assert.equal(stats(f),102);
  f.clock.time=4000; drain(f,0); commit(f,g.advanceEffectLifecycle(f.current.lifecycle,f.context));
  const saved=structuredClone([f.current.modifiers.snapshots,f.current.statuses.snapshots,f.current.periodic.entries]);
  commit(f,g.refreshEffectStackLifetime(f.current.lifecycle,'B',timed(5000),f.context));
  assert.equal(f.current.lifecycle.lifetimes.find(e=>e.effectInstanceId==='B').expiresAtMs,9000);
  assert.deepEqual([f.current.modifiers.snapshots,f.current.statuses.snapshots,f.current.periodic.entries],saved);
  assert.equal(f.current.periodic.entries.find(e=>e.effectInstanceId==='B').nextTickAtMs,5000);
  add(f,'equipment',payload({modifiers:[modifier(5,'add_flat')]}),{mode:'persistent'},'armor',origin('equipment/armor-instance-001'));
  commit(f,g.removeEffectStackGroup(f.current.lifecycle,group,'explicit'));
  assert.deepEqual(f.current.periodic.entries,[{effectInstanceId:'equipment',mode:'none'}]); assert.equal(stats(f),105);
  advance(f,10000); assert.equal(stats(f),105); remove(f,'equipment'); assert.equal(stats(f),100); aligned(f.current);
  console.log('EFFECT_INTEGRATION_STACK_PASS');
});

contract('EF37/39: actual Skill handoff, five origins, distinct groups/targets and optional module composition', assert => {
  const f=fixture(), other=fixture('other'), sourceLife=g.createEntityLifeState(f.caster,{status:'alive'});
  const definition=g.createSkillDefinition({skillId:'poison-spell'}), instance=g.createSkillInstance(definition,f.caster,{instanceId:'spell-1'});
  const admission=g.evaluateSkillActivationAdmission(definition,instance,f.caster.id,f.entities,sourceLife,{owned:true,eligible:true,rank:{mode:'not_required'}});
  const activation=g.activateSkill({instance,admission,resourceState:g.createEntityResourceState(f.caster,{mana:{minimum:0,maximum:100,current:100}}),
    resourceCosts:{costs:[{resourceId:'mana',amount:5}],bounds:[{resourceId:'mana',minimum:0,maximum:100,currentAboveMaximum:'reject'}]},
    cooldownState:g.createSkillCooldownState(instance),cooldownConfig:{baseDurationMs:1000,effectiveCdr:0},executionContext:f.context,
    intent:{attemptId:'cast-1',dispatch:{kind:'caller'}},executionPreflight:{kind:'caller',status:'accepted'}});
  assert.equal(activation.status,'accepted'); assert.equal(activation.resources.current.mana,95);
  add(f,'skill',payload({periodic:dot()}),timed(5000),'poison',origin('skill/'+activation.request.instanceId));
  assert.equal(g.reportSkillExecutionOutcome(activation.request,{status:'completed'}).status,'completed');
  for(const [id,source,duration] of [
    ['item',origin('item/potion-1'),timed(5000)], ['equipment',origin('equipment/armor-1'),{mode:'persistent'}],
    ['environment',{kind:'system',sourceId:'area',sourceKey:'environment/zone-1'},timed(5000)],
    ['system',{kind:'system',sourceId:'world',sourceKey:'system/rule-1'},timed(5000)]]) add(f,id,payload(),duration,id,source);
  add(f,'second-source',payload({periodic:dot()}),timed(5000),'poison',{kind:'entity',sourceId:'caster',sourceKey:'skill/other'});
  assert.deepEqual(g.inspectEffectStackGroups(f.current.lifecycle).filter(x=>x.key.effectId==='poison').map(x=>x.key.sourceKey),['skill/spell-1','skill/other']);
  add(other,'skill',payload({periodic:dot(),modifiers:[modifier(2,'add_flat')],restrictionIds:['other-only']}),timed(5000),'poison',origin('skill/spell-1'));
  const isolated=JSON.stringify(other.current);
  f.clock.time=2000; drain(f); assert.equal(g.getEntityResourceCurrent(f.current.resources,'health'),80);
  assert.equal(JSON.stringify(other.current),isolated); assert.equal(stats(f),100); assert.equal(stats(other),102);
  assert.equal(gate(f,['other-only']).status,'allowed'); assert.equal(gate(other,['other-only']).status,'blocked');
  const emptySource=g.createEntityResourceState(f.caster,{health:{minimum:0,maximum:100,current:0}});
  assert.equal(g.resolveEntityDefeat(sourceLife,emptySource,f.bounds).after,'dead');
  f.clock.time=3000; drain(f); assert.equal(g.getEntityResourceCurrent(f.current.resources,'health'),60);
  remove(f,'equipment'); assert.equal(f.current.lifecycle.effectState.instances.some(i=>i.effectInstanceId==='equipment'),false);
  const definitions=JSON.parse(readFileSync(new URL('./effect-modules.json',import.meta.url),'utf8')).modules;
  const registry=definitions.reduce(g.registerModule,g.createModuleRegistry());
  for(const enable of [['entity','effect'],['entity','skill','effect']]) {
    const composition=g.composeModules(registry,g.configureModules(registry,{enable})); assert.deepEqual(composition.moduleIds,enable);
  }
  assert.throws(()=>g.composeModules(registry,g.configureModules(registry,{enable:['effect']})),TypeError);
  aligned(f.current); aligned(other.current);
  console.log('EFFECT_INTEGRATION_SOURCES_PASS');
});

contract('EF38: failed canonical execution, stale baseline guard, companion rejection and target-death cleanup', assert => {
  const f=fixture(); add(f,'A',payload({periodic:dot()})); f.clock.time=2000;
  const baseline=f.current,intent=plan(f).intent;
  assert.throws(()=>tick(f,NaN),TypeError); assert.equal(f.current,baseline); assert.deepEqual(plan(f).intent,intent);
  assert.equal(stage(f,g.advanceEffectLifecycle(f.current.lifecycle,f.context)).reason,'pending_ticks'); assert.equal(f.current,baseline);
  tick(f); assert.equal(g.completeEffectPeriodicTick(f.current.lifecycle,f.current.periodic,intent,f.current.life,f.context).reason,'stale_tick');
  const stale=stage(f,g.removeEffectLifetime(f.current.lifecycle,'A','explicit'));
  f.clock.time=1000; add(f,'B'); const authoritative=f.current;
  assert.equal(publish(f,stale),false); assert.equal(f.current,authoritative);
  assert.throws(()=>g.listActiveEffectStatuses(f.current.lifecycle,baseline.statuses),TypeError);
  assert.throws(()=>g.getNextDueEffectTick(f.current.lifecycle,baseline.periodic,f.current.life,f.context),TypeError);
  const dead=fixture('victim',5); add(dead,'B',payload({periodic:hot()})); add(dead,'A',payload({periodic:dot()})); dead.clock.time=2000;
  assert.deepEqual(tick(dead),[2000,'A',5,0,5,'dead']);
  assert.deepEqual(plan(dead),{status:'blocked',reason:'target_dead',intent:null});
  const blocked=dead.current; assert.equal(dead.current.periodic.entries.find(e=>e.effectInstanceId==='B').nextTickAtMs,2000);
  commit(dead,g.cleanupDefeatedTargetEffects(dead.current.lifecycle,dead.current.periodic,dead.current.life,{defeatedAtMs:2000},dead.context));
  assert.deepEqual(dead.current.periodic.entries,[]); assert.equal(dead.current.resources.current.health,0); assert.equal(blocked.life.status,'dead');
  aligned(dead.current); frozen(dead.current);
  console.log('EFFECT_INTEGRATION_SAFETY_PASS');
});

contract('EF38/40: complete independent literal timeline, event ordering and historical snapshot isolation', assert => {
  function session() {
    const f=fixture('replay',70),trace=[],history=[],saved=[],observations=[];
    const remember=()=>{history.push(f.current);saved.push(JSON.stringify(f.current));};
    const step=time=>{f.clock.time=time;trace.push(...drain(f));commit(f,g.advanceEffectLifecycle(f.current.lifecycle,f.context));};
    remember();
    add(f,'A',payload({periodic:dot()})); add(f,'R',payload({periodic:hot()}),timed(5000),'regen');
    add(f,'buff',payload({modifiers:[modifier(.2,'add_percent')],classification:'buff'}),timed(5000),'focus');
    add(f,'silence',payload({restrictionIds:['disable-magic-skill']}),timed(5000),'silence');
    add(f,'equipment',payload({modifiers:[modifier(5,'add_flat')]}),{mode:'persistent'},'armor',origin('equipment/armor-1')); remember();
    step(1500); add(f,'B',payload({periodic:dot()}),timed(2500)); remember();
    step(2000); remember(); step(2500); commit(f,g.refreshEffectStackLifetime(f.current.lifecycle,'B',timed(4000),f.context)); remember();
    step(3000); observations.push([3000,skill(f).reason,combat(f).status,stats(f)]);
    step(4000); commit(f,g.consumeEffectStacks(f.current.lifecycle,{group:{targetEntityId:'replay',effectId:'poison',sourceKey:'skill/poison'},count:1}));
    remove(f,'silence'); observations.push([4000,skill(f).status,g.inspectEffectStackGroups(f.current.lifecycle).find(x=>x.key.effectId==='poison').stackCount]); remember();
    step(5000); observations.push([5000,stats(f)]); step(6000); remember();
    observations.push([6000,f.current.lifecycle.effectState.instances.map(i=>i.effectInstanceId),stats(f)]);
    step(7000); observations.push([7000,f.current.lifecycle.effectState.instances.map(i=>i.effectInstanceId),stats(f)]);
    remove(f,'equipment','session_cleanup'); remember();
    assert.deepEqual(trace,[[2000,'A',70,60,10,'alive'],[2000,'R',60,70,10,'alive'],[2500,'B',70,60,10,'alive'],[3000,'A',60,50,10,'alive'],[3000,'R',50,60,10,'alive'],[3500,'B',60,50,10,'alive'],[4000,'A',50,40,10,'alive'],[4000,'R',40,50,10,'alive'],[4500,'B',50,40,10,'alive'],[5000,'R',40,50,10,'alive'],[5500,'B',50,40,10,'alive'],[6000,'R',40,50,10,'alive'],[6500,'B',50,40,10,'alive']]);
    assert.deepEqual(observations,[[3000,'actor_ineligible','admitted',126],[4000,'admitted',1],[5000,126],[6000,['equipment','B'],105],[7000,['equipment'],105]]);
    assert.deepEqual(f.events.map(e=>[e.type,e.effectInstanceId??e.consumedInstanceIds?.[0],e.atMs]),[
      ['started','A',1000],['started','R',1000],['started','buff',1000],['started','silence',1000],['started','equipment',1000],['started','B',1500],
      ['tick-completed','A',2000],['tick-completed','R',2000],['tick-completed','B',2500],['refreshed','B',2500],
      ['tick-completed','A',3000],['tick-completed','R',3000],['tick-completed','B',3500],['tick-completed','A',4000],['tick-completed','R',4000],
      ['stack-consumed','A',4000],['removed','silence',4000],['tick-completed','B',4500],['tick-completed','R',5000],['tick-completed','B',5500],
      ['tick-completed','R',6000],['expired','R',6000],['expired','buff',6000],['tick-completed','B',6500],['expired','B',6500],['removed','equipment',7000]]);
    history.forEach((snapshot,i)=>{assert.equal(JSON.stringify(snapshot),saved[i]);frozen(snapshot);aligned(snapshot);});
    assert.equal(f.current.resources.current.health,40); assert.equal(stats(f),100);
    assert.deepEqual(f.current.lifecycle.effectState.instances,[]); assert.deepEqual(f.current.periodic.entries,[]);
    return {trace,observations,history,events:f.events,final:f.current};
  }
  const old=[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval]; let a,b;
  try {Date.now=Math.random=globalThis.setTimeout=globalThis.setInterval=()=>{throw Error('hidden runtime');};a=session();b=session();}
  finally {[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval]=old;}
  assert.deepEqual(a,b); assert.notEqual(a.final,b.final); assert.notEqual(a.history[1].periodic.entries,b.history[1].periodic.entries);
  assert.notEqual(a.history[1].resources.current,b.history[1].resources.current);
  console.log('EFFECT_INTEGRATION_REPLAY_PASS');
});

// L4 stages numerical/Life/cursor/cleanup outcomes and publishes only the complete candidate.
function defeatCandidate(f, amount = 10) {
  const baseline=f.current, intent=plan(f).intent;
  const resource=g.transitionEntityResource(baseline.resources,intent.resourceId,{maximum:100,amount,operation:'decrease',
    rule:{minimum:0,currentAboveMaximum:'allow',allowIncreaseFromMinimum:false}});
  const life=g.resolveEntityDefeat(baseline.life,resource.state,f.bounds);
  const completed=g.completeEffectPeriodicTick(baseline.lifecycle,baseline.periodic,intent,baseline.life,f.context);
  assert.equal(life.after,'dead'); assert.equal(completed.status,'applied');
  const staged={...f,current:Object.freeze({...baseline,resources:resource.state,life:life.state,periodic:completed.state})};
  assert.deepEqual(plan(staged),{status:'blocked',reason:'target_dead',intent:null});
  const cleanup=g.cleanupDefeatedTargetEffects(staged.current.lifecycle,staged.current.periodic,staged.current.life,
    {defeatedAtMs:intent.dueAtMs},f.context);
  assert.equal(cleanup.status,'applied');
  const companions=stage(staged,cleanup);
  return {baseline,next:companions.next,events:[...completed.events,...cleanup.events],cleanup};
}

contract('FIX01/03/04/06/12/13/14/15: atomic lethal cleanup, exact timeline and independent replay', assert => {
  function session(horizon=6000,duration=timed(5000)) {
    const f=fixture('victim',5), capture=payload({periodic:dot(),modifiers:[modifier(2,'add_flat')],statusIds:['poisoned'],restrictionIds:['stun']});
    add(f,'A',capture,duration); add(f,'B',payload({periodic:hot()}),duration);
    const history=f.current,saved=JSON.stringify(history); f.clock.time=horizon;
    assert.throws(()=>defeatCandidate(f,NaN),TypeError); assert.equal(f.current,history); assert.equal(JSON.stringify(history),saved);
    const candidate=defeatCandidate(f);
    assert.equal(f.current,history); assert.equal(history.resources.current.health,5);
    assert.equal(publish(f,candidate),true); assert.equal(publish(f,candidate),false);
    assert.deepEqual(f.events.map(e=>e.type==='removed'?[e.type,e.effectInstanceId,e.atMs,e.reason]:[e.type,e.effectInstanceId,e.atMs]),[
      ['started','A',1000],['started','B',1000],['tick-completed','A',2000],
      ['removed','A',2000,'target_defeated'],['removed','B',2000,'target_defeated']]);
    assert.equal(f.current.resources.current.health,0); assert.equal(f.current.life.status,'dead');
    assert.equal(f.current.lifecycle.observedAtMs,2000); assert.deepEqual(f.current.lifecycle.effectState.instances,[]);
    assert.deepEqual(f.current.lifecycle.lifetimes,[]); assert.deepEqual(f.current.modifiers.snapshots,[]);
    assert.deepEqual(f.current.statuses.snapshots,[]); assert.deepEqual(f.current.periodic.entries,[]);
    assert.equal(stats(f),100); assert.equal(gate(f,['stun']).status,'allowed');
    assert.equal(plan(f).reason,'target_dead'); assert.equal(JSON.stringify(history),saved);
    aligned(f.current); frozen(f.current); frozen(candidate.cleanup); frozen(history);
    return {events:f.events,state:f.current,history};
  }
  const old=[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval]; let a,b,tie;
  try {Date.now=Math.random=globalThis.setTimeout=globalThis.setInterval=()=>{throw Error('hidden runtime');};
    a=session();b=session();tie=session(2000,timed(1000));}
  finally {[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval]=old;}
  assert.deepEqual(a,b); assert.notEqual(a.state,b.state); assert.notEqual(a.history.periodic,b.history.periodic);
  assert.deepEqual(tie.events,a.events); assert.deepEqual(tie.state,a.state);
  console.log('EFFECT_INTEGRATION_DEFEAT_TIMELINE_PASS');
});

contract('FIX02/05/07/08/09/10/11: defeat validation preserves earlier work and Entity binding', assert => {
  const f=fixture(),dead=g.createEntityLifeState(f.target,{status:'dead'}); add(f,'A',payload({periodic:{...dot(),intervalMs:500}}));
  const before=f.current,saved=JSON.stringify(before); f.clock.time=2000;
  const cleanup=(time,life=dead,periodic=f.current.periodic,context=f.context,request={defeatedAtMs:time})=>
    g.cleanupDefeatedTargetEffects(f.current.lifecycle,periodic,life,request,context);
  for(const [time,life,reason] of [[2000,before.life,'target_alive'],[500,dead,'time_regressed'],[3000,dead,'time_after_horizon'],[2000,dead,'pending_ticks_before_defeat']]) {
    const rejected=cleanup(time,life); assert.deepEqual(rejected,{status:'rejected',reason,state:null,events:[]}); frozen(rejected);
    assert.equal(stage(f,rejected).next,null);
  }
  const sourceDead=g.createEntityLifeState(f.caster,{status:'dead'});
  assert.throws(()=>cleanup(2000,sourceDead),TypeError); assert.equal(plan(f).status,'due');
  for(const time of [-1,NaN,Infinity,'2000']) assert.throws(()=>cleanup(time),TypeError);
  for(const request of [null,{}, {defeatedAtMs:2000,extra:true},{get defeatedAtMs(){throw Error('accessor invoked');}}])
    assert.throws(()=>cleanup(2000,dead,before.periodic,f.context,request),TypeError);
  assert.throws(()=>cleanup(2000,dead,before.periodic,{}),TypeError);
  assert.throws(()=>cleanup(2000,dead,{...before.periodic,observedAtMs:1500}),TypeError);
  assert.throws(()=>cleanup(2000,{...dead,status:'unknown'}),TypeError);
  assert.equal(f.current,before); assert.equal(JSON.stringify(before),saved);
  const emptyState={effectState:{entityId:f.target.id,instances:[]},lifetimes:[],observedAtMs:2000};
  const forged={status:'applied',reason:'none',action:'target_defeated',state:emptyState,
    events:[{type:'removed',effectInstanceId:'A',effectId:'poison',targetEntityId:f.target.id,atMs:2000,reason:'target_defeated'}]};
  assert.equal(g.applyEffectPeriodicTransition(before.periodic,before.lifecycle,forged).reason,'pending_ticks');
  const expiry=fixture(); add(expiry,'earlier',payload(),timed(500)); expiry.clock.time=2000;
  const expiryDead=g.createEntityLifeState(expiry.target,{status:'dead'});
  assert.equal(g.cleanupDefeatedTargetEffects(expiry.current.lifecycle,expiry.current.periodic,expiryDead,{defeatedAtMs:2000},expiry.context).reason,'pending_expiration_before_defeat');
  advance(expiry,1500); expiry.clock.time=2000;
  const empty=g.cleanupDefeatedTargetEffects(expiry.current.lifecycle,expiry.current.periodic,expiryDead,{defeatedAtMs:2000},expiry.context);
  commit(expiry,empty); assert.deepEqual(empty.events,[]); assert.equal(expiry.current.lifecycle.observedAtMs,2000);
  assert.equal(g.cleanupDefeatedTargetEffects(expiry.current.lifecycle,expiry.current.periodic,expiryDead,{defeatedAtMs:1500},expiry.context).reason,'time_regressed');
  assert.deepEqual(expiry.events.map(e=>[e.type,e.atMs]),[['started',1000],['expired',1500]]);
  // Ordinary advancement still cannot discard due ticks.
  assert.equal(stage(f,g.advanceEffectLifecycle(f.current.lifecycle,f.context)).reason,'pending_ticks');
  console.log('EFFECT_INTEGRATION_DEFEAT_VALIDATION_PASS');
});

contract('FIX12/13/16: defeat companion receipts reject malformed or stale candidates without publication', assert => {
  const f=fixture('victim',5); add(f,'B',payload({periodic:hot()})); add(f,'A',payload({periodic:dot()})); f.clock.time=2000;
  const before=f.current,candidate=defeatCandidate(f),receipt=candidate.cleanup;
  assert.deepEqual(receipt.events.map(e=>e.effectInstanceId),['A','B']);
  for(const malformed of [
    {...receipt,events:[receipt.events[0],receipt.events[0]]}, {...receipt,events:[...receipt.events].reverse()},
    {...receipt,events:receipt.events.slice(1)}, {...receipt,events:[...receipt.events,{...receipt.events[0]}]},
    {...receipt,events:receipt.events.map(e=>({...e,atMs:1000}))},
    {...receipt,events:receipt.events.map(e=>({...e,reason:'explicit'}))},
    {...receipt,events:receipt.events.map(e=>({...e,targetEntityId:'other'}))},
    {...receipt,state:before.lifecycle},
  ]) {
    assert.throws(()=>stage(f,malformed),TypeError); assert.equal(f.current,before);
  }
  assert.equal(stage(f,{...receipt,state:{...receipt.state,effectState:{entityId:'other',instances:[]}}}).next,null);
  assert.throws(()=>g.applyEffectModifierTransition(before.modifiers,receipt,payload().modifier),TypeError);
  assert.throws(()=>g.applyEffectStatusTransition(before.statuses,before.lifecycle,receipt,payload().status),TypeError);
  assert.throws(()=>g.applyEffectPeriodicTransition(before.periodic,before.lifecycle,receipt,{mode:'none'}),TypeError);
  assert.equal(publish(f,candidate),true);
  assert.throws(()=>g.listActiveEffectStatuses(f.current.lifecycle,before.statuses),TypeError);
  assert.throws(()=>g.getNextDueEffectTick(f.current.lifecycle,before.periodic,f.current.life,f.context),TypeError);
  assert.throws(()=>g.applyEffectModifierTransition(f.current.modifiers,receipt),TypeError);
  assert.equal(publish(f,candidate),false); aligned(f.current);
  console.log('EFFECT_INTEGRATION_DEFEAT_COMPANIONS_PASS');
});
