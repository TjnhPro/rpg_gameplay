import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import * as g from '@rpg/gameplay';

function contract(name, run) {
  test(name, () => {
    let assertions=0;
    const checked=new Proxy(assert,{get(target,key){return (...args)=>{assertions++;return Reflect.get(target,key)(...args);};}});
    run(checked);
    assert.ok(assertions>0,'Actor AI contract requires actual assertions');
  });
}
const profile=()=>g.createActorAIProfileReference({profileId:' custom-profile '});
const initial=()=>({controller:'ai',behaviorStateId:' custom-patrol-state '});
function fixture(kind='player',actorId='Actor-001') {
  const actor=g.createEntity({id:actorId,kind}),entities=g.addEntity(g.createEntityCollection(),actor);
  const state=g.createActorAIState(actor,profile(),initial());
  const context=g.createActorAIDecisionContext(state,' decision-001 ');
  const intent=g.createActorAIActionIntent(context,{actionKey:' custom-action ',targetEntityId:'absent-target'});
  return {actor,entities,state,context,intent};
}
function frozen(value){if(value&&typeof value==='object'){assert.ok(Object.isFrozen(value));Object.values(value).forEach(frozen);}}

contract('AI foundation: actor-agnostic canonical binding, exact IDs, profile/state isolation and stale targets',assert=>{
  const shared=profile(),states=[];
  for(const kind of ['player','monster','npc','pet','summon','companion','custom-companion']) {
    const actor=g.createEntity({id:kind+'-001',kind});
    const entities=g.addEntity(g.createEntityCollection(),actor);
    const state=g.createActorAIState(actor,shared,initial());states.push(state);
    assert.deepEqual(state,{actorId:kind+'-001',profileId:' custom-profile ',controller:'ai',behaviorStateId:' custom-patrol-state ',targetEntityId:null});
    const validated=g.validateActorAIState(state,entities);assert.deepEqual(validated,state);assert.notEqual(validated,state);frozen(state);
    assert.deepEqual(g.validateActorAIState({...state,targetEntityId:'stale-target'},entities),{...state,targetEntityId:'stale-target'});
    assert.throws(()=>g.validateActorAIState({...state,actorId:'unknown'},entities),TypeError);
    assert.throws(()=>g.validateActorAIState({...state,actorId:state.actorId.toUpperCase()},entities),TypeError);
    assert.throws(()=>g.validateActorAIState(state,{entities:[actor,actor]}),TypeError);
    const manual=g.createActorAIState(actor,shared,{controller:'manual',behaviorStateId:'idle'});
    assert.equal(manual.controller,'manual');assert.equal(manual.targetEntityId,null);assert.notEqual(manual,state);
  }
  assert.equal(new Set(states).size,7);assert.deepEqual(shared,{profileId:' custom-profile '});frozen(shared);
  const f=fixture();
  for(const controller of ['auto','both','none',null,true])assert.throws(()=>g.createActorAIState(f.actor,shared,{...initial(),controller}),TypeError);
  assert.throws(()=>g.createActorAIState({...f.actor,resources:{}},shared,initial()),TypeError);
  console.log('ACTOR_AI_IDENTITY_PASS');
});

contract('AI foundation: correlated structural proposals, manual exclusivity and no optimistic execution',assert=>{
  const f=fixture(),before=JSON.stringify(f);
  assert.deepEqual(f.context,{decisionId:' decision-001 ',actorId:'Actor-001'});
  assert.deepEqual(f.intent,{decisionId:' decision-001 ',actorId:'Actor-001',actionKey:' custom-action ',targetEntityId:'absent-target'});
  const proposal={status:'proposed',reason:'none',intent:f.intent};
  const result=g.validateActorAIDecisionResult(f.state,f.context,proposal);
  assert.deepEqual(result,proposal);assert.notEqual(result,proposal);assert.notEqual(result.intent,f.intent);frozen(result);
  assert.deepEqual(g.createActorAIActionIntent(f.context,{actionKey:'wait',targetEntityId:null}),{...f.context,actionKey:'wait',targetEntityId:null});
  const manual={...f.state,controller:'manual'};
  assert.throws(()=>g.validateActorAIDecisionResult(manual,f.context,proposal),TypeError);
  assert.deepEqual(g.validateActorAIDecisionResult(manual,f.context,{status:'no_action',reason:'manual_control',intent:null}),{status:'no_action',reason:'manual_control',intent:null});
  assert.deepEqual(g.validateActorAIDecisionResult(f.state,f.context,{status:'no_action',reason:'no_candidate',intent:null}),{status:'no_action',reason:'no_candidate',intent:null});
  for(const [state,context,input] of [
    [f.state,{...f.context,actorId:'other'},proposal],
    [f.state,f.context,{...proposal,intent:{...f.intent,actorId:'other'}}],
    [f.state,f.context,{...proposal,intent:{...f.intent,decisionId:'other'}}],
    [f.state,f.context,{...proposal,intent:null}],
    [f.state,f.context,{...proposal,reason:'manual_control'}],
    [f.state,f.context,{status:'no_action',reason:'manual_control',intent:null}],
    [manual,f.context,{status:'no_action',reason:'no_candidate',intent:null}],
    [f.state,f.context,{status:'no_action',reason:'no_candidate',intent:f.intent}],
    [f.state,f.context,{status:'completed',reason:'none',intent:f.intent}],
  ])assert.throws(()=>g.validateActorAIDecisionResult(state,context,input),TypeError);
  assert.equal(JSON.stringify(f),before);
  console.log('ACTOR_AI_DECISION_PASS');
});

contract('AI foundation: every closed record rejects malformed own-data fields without invoking getters',assert=>{
  const f=fixture(),proposal={status:'proposed',reason:'none',intent:f.intent};let getterCalls=0;
  const cases=[
    [{profileId:'P'},x=>g.createActorAIProfileReference(x)],
    [initial(),x=>g.createActorAIState(f.actor,profile(),x)],
    [f.state,x=>g.validateActorAIState(x,f.entities)],
    [f.state,x=>g.createActorAIDecisionContext(x,'D')],
    [f.context,x=>g.createActorAIActionIntent(x,{actionKey:'wait',targetEntityId:null})],
    [{actionKey:'wait',targetEntityId:null},x=>g.createActorAIActionIntent(f.context,x)],
    [f.state,x=>g.validateActorAIDecisionResult(x,f.context,proposal)],
    [f.context,x=>g.validateActorAIDecisionResult(f.state,x,proposal)],
    [proposal,x=>g.validateActorAIDecisionResult(f.state,f.context,x)],
    [f.intent,x=>g.validateActorAIDecisionResult(f.state,f.context,{...proposal,intent:x})],
  ];
  for(const [valid,run] of cases) {
    for(const bad of [null,undefined,[],42,{...valid,unknown:true},{...valid,[Symbol('extra')]:true}])assert.throws(()=>run(bad),TypeError);
    for(const key of Object.keys(valid)) {
      const missing={...valid};delete missing[key];assert.throws(()=>run(missing),TypeError);
      const inherited=Object.assign(Object.create({[key]:valid[key]}),missing);assert.throws(()=>run(inherited),TypeError);
      const getter={...valid};Object.defineProperty(getter,key,{get(){getterCalls++;return valid[key];}});assert.throws(()=>run(getter),TypeError);
      for(const invalid of [undefined,null,'', '   ',false,0,{},[]]) {
        if(key==='intent'||key==='targetEntityId'&&invalid===null)continue;
        assert.throws(()=>run({...valid,[key]:invalid}),TypeError);
      }
    }
    const plain=Object.assign(Object.create(null),valid);frozen(run(plain));
  }
  for(const value of [null,{},''])assert.throws(()=>g.createActorAIDecisionContext(f.state,value),TypeError);
  assert.equal(getterCalls,0);
  console.log('ACTOR_AI_VALIDATION_PASS');
});

contract('AI foundation: optional Entity-only module composition and explicit dependency selection',assert=>{
  const definitions=JSON.parse(readFileSync(new URL('./actor-ai-modules.json',import.meta.url),'utf8')).modules;
  const registry=definitions.reduce(g.registerModule,g.createModuleRegistry());
  assert.deepEqual(g.getModule(registry,'actor-ai'),{id:'actor-ai',optional:true,dependencies:['entity']});
  assert.equal(g.isModuleEnabled(g.configureModules(registry,{}),'actor-ai'),false);
  for(const enable of [['entity','actor-ai'],['entity','progression','actor-ai'],['entity','combat','skill','effect','actor-ai']]) {
    const selection=g.configureModules(registry,{enable});
    assert.deepEqual(g.composeModules(registry,selection).moduleIds,enable);
  }
  assert.throws(()=>g.composeModules(registry,g.configureModules(registry,{enable:['actor-ai']})),TypeError);
  console.log('ACTOR_AI_MODULE_PASS');
});

contract('AI foundation: detached frozen snapshots, independent replay and canonical owner preservation',assert=>{
  function session(){
    const actorInput={id:'Player-Exact ',kind:'custom'},profileInput={profileId:'UnknownProfile'},initialInput={controller:'ai',behaviorStateId:'idle'};
    const actor=g.createEntity(actorInput),entities=g.addEntity(g.createEntityCollection(),actor);
    const resources=g.createEntityResourceState(actor,{health:{minimum:0,maximum:100,current:5}}),life=g.createEntityLifeState(actor,{status:'alive'});
    const canonical=JSON.stringify({actor,entities,resources,life});
    const profile=g.createActorAIProfileReference(profileInput),state=g.createActorAIState(actor,profileInput,initialInput);
    const mutable={...state,targetEntityId:'stale'},validated=g.validateActorAIState(mutable,entities);
    const context=g.createActorAIDecisionContext(validated,'D'),input={actionKey:'unimplemented-action',targetEntityId:null};
    const intent=g.createActorAIActionIntent(context,input),envelope={status:'proposed',reason:'none',intent:{...intent}};
    const result=g.validateActorAIDecisionResult(validated,context,envelope);
    actorInput.id=profileInput.profileId=initialInput.behaviorStateId=mutable.actorId=input.actionKey=envelope.intent.actionKey='changed';
    assert.deepEqual(state,{actorId:'Player-Exact ',profileId:'UnknownProfile',controller:'ai',behaviorStateId:'idle',targetEntityId:null});
    assert.equal(validated.targetEntityId,'stale');assert.equal(intent.actionKey,'unimplemented-action');assert.equal(result.intent.actionKey,'unimplemented-action');
    assert.equal(profile.profileId,'UnknownProfile');assert.equal(Object.isFrozen(profileInput),false);assert.equal(Object.isFrozen(mutable),false);
    assert.equal(JSON.stringify({actor,entities,resources,life}),canonical);
    const output={profile,state,validated,context,intent,result};Object.values(output).forEach(frozen);return output;
  }
  const old=[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval];let a,b;
  try {Date.now=Math.random=globalThis.setTimeout=globalThis.setInterval=()=>{throw Error('hidden provider');};a=session();b=session();}
  finally {[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval]=old;}
  assert.deepEqual(a,b);for(const key of Object.keys(a))assert.notEqual(a[key],b[key]);assert.notEqual(a.result.intent,b.result.intent);
  console.log('ACTOR_AI_REPLAY_PASS');
});
