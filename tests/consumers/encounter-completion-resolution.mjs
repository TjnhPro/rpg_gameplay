import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {evaluateEncounterCompletion} from '@rpg/gameplay';
import * as g from '@rpg/gameplay';

function contract(ids, name, run) {
  test('Encounter completion '+name, () => {
    let assertions=0;
    const checked=new Proxy(assert,{get(target,key){return (...args)=>{assertions++;return Reflect.get(target,key)(...args);};}});
    run(checked);assert.ok(assertions>0,'Encounter completion requires actual assertions');
    for(const id of ids.split(' ').filter(Boolean))console.log('ENCOUNTER_R'+id+'_PASS');
  });
}
const elimination=(sides=['party','enemies'],zeroSurvivors='pending')=>({ruleId:'last-standing',kind:'side_elimination',contenderSideIds:sides,zeroSurvivors});
const victory=(w=['party'],d=['enemies'])=>({kind:'victory',winnerSideIds:w,defeatedSideIds:d});
const draw=()=>({kind:'draw',winnerSideIds:[],defeatedSideIds:[]});
const objective=(ruleId='protect',whenStatus='succeeded',outcome=victory(),objectiveId='protect-crystal')=>({ruleId,kind:'objective',objectiveId,whenStatus,outcome});
function fixture(sides=['party','enemies'],participants=[['player-001','party','player'],['monster-001','enemies','monster']]) {
  let entities=g.createEntityCollection();
  for(const [id,,kind] of participants)entities=g.addEntity(entities,g.createEntity({id,kind}));
  entities=g.addEntity(entities,g.createEntity({id:'foreign-001',kind:'npc'}));
  const prepared=g.createEncounterState({definitionId:'forest-wolves'},{encounterId:'forest-fight-001',sides:sides.map(sideId=>({sideId})),participants:participants.map(([entityId,sideId])=>({entityId,sideId}))},entities);
  // Accepted activation permits empty rosters structurally; completion tests need
  // active/terminal snapshots without claiming lifecycle transition provenance.
  const state={...prepared,status:'active'};
  return {state,entities,policy:{definitionId:'forest-wolves',rules:[elimination()]},
    observation:{encounterId:state.encounterId,participants:participants.map(([entityId],i)=>({entityId,life:g.createEntityLifeState(g.getEntity(entities,entityId),{status:i===0?'alive':'dead'})})),objectives:[],continuation:'clear'}};
}
const evaluate=f=>evaluateEncounterCompletion(f.state,f.entities,f.policy,f.observation);
const pending=(reason='no_completion_condition_met',participantEntityId=null)=>({status:'pending',reason,encounterId:'forest-fight-001',ruleId:null,participantEntityId,outcome:null});
const resolved=(outcome=victory(),ruleId='last-standing')=>({status:'resolvable',reason:'rule_matched',encounterId:'forest-fight-001',ruleId,participantEntityId:null,outcome});
const clone=value=>structuredClone(value);
function frozen(a,value){if(value&&typeof value==='object'){a.ok(Object.isFrozen(value),'deep freeze');for(const v of Object.values(value))frozen(a,v);}}

contract('01 02 03 04 12','facts',a=>{
  const f=fixture(),input=clone(f.observation);input.objectives=['pending','succeeded','failed'].map((status,i)=>({objectiveId:'O'+i,status}));
  const observation=g.createEncounterCompletionObservation(input);
  a.deepEqual(Object.keys(observation),['encounterId','participants','objectives','continuation']);
  a.deepEqual(observation.participants.map(fact=>fact.life),[{entityId:'player-001',status:'alive'},{entityId:'monster-001',status:'dead'}]);
  a.deepEqual(g.createEncounterCompletionObservation(f.observation).objectives,[]);
  a.deepEqual(observation.objectives.map(fact=>fact.status),['pending','succeeded','failed']);
  input.participants[0].life.status='dead';input.objectives[0].status='failed';input.participants.push(input.participants[0]);
  a.equal(observation.participants[0].life.status,'alive');a.equal(observation.objectives[0].status,'pending');a.equal(observation.participants.length,2);
  a.equal(Object.isFrozen(input),false);a.equal(Object.isFrozen(input.objectives),false);frozen(a,observation);
  const opaque={...f.observation,encounterId:' Encounter ',objectives:[{objectiveId:' Objective ',status:'pending'}]};
  a.equal(g.createEncounterCompletionObservation(opaque).encounterId,' Encounter ');a.equal(g.createEncounterCompletionObservation(opaque).objectives[0].objectiveId,' Objective ');
});
contract('05 06 07 08 09 10 11','correlation',a=>{
  const f=fixture();f.observation.participants.reverse();a.deepEqual(evaluate(f),resolved());
  f.observation.participants=f.observation.participants.filter(fact=>fact.entityId==='player-001');
  a.deepEqual(evaluate(f),pending('participant_fact_missing','monster-001'),'N02 complete Life evidence');
  f.observation.participants.push({entityId:'foreign-001',life:{entityId:'foreign-001',status:'dead'}});
  a.throws(()=>evaluate(f),{name:'TypeError',message:/Foreign Encounter completion/},'N01 foreign Life binding');
  const duplicate=fixture();duplicate.observation.participants.push(clone(duplicate.observation.participants[0]));
  a.throws(()=>g.createEncounterCompletionObservation(duplicate.observation),{name:'TypeError',message:/Duplicate.*participant/},'N11 duplicate participant');
  const objectives=fixture();objectives.observation.objectives=[{objectiveId:'X',status:'succeeded'},{objectiveId:'X',status:'pending'}];
  a.throws(()=>g.createEncounterCompletionObservation(objectives.observation),{name:'TypeError',message:/Duplicate.*objective/},'N10 duplicate objective');
  const mismatch=fixture();mismatch.observation.participants[0]={entityId:'player-001',life:{entityId:'monster-001',status:'alive'}};
  a.throws(()=>g.createEncounterCompletionObservation(mismatch.observation),{name:'TypeError',message:/Life identity mismatch/},'N09 Life identity binding');
  const wrong=fixture();wrong.observation.encounterId='other';a.throws(()=>evaluate(wrong),{name:'TypeError',message:/observation mismatch/});
  const definition=fixture();definition.policy.definitionId='other';a.throws(()=>evaluate(definition),{name:'TypeError',message:/definition mismatch/},'N16 definition binding');
});
contract('13 14 15 16 17 18 19 22','elimination',a=>{
  const f=fixture();a.deepEqual(evaluate(f),resolved(),'N03 literal living party');
  f.observation.participants[0].life={entityId:'player-001',status:'dead'};f.observation.participants[1].life={entityId:'monster-001',status:'alive'};
  a.deepEqual(evaluate(f),resolved(victory(['enemies'],['party'])));
  f.observation.participants[0].life={entityId:'player-001',status:'alive'};a.deepEqual(evaluate(f),pending());
  const triple=fixture(['alpha','beta','gamma'],[['A','alpha','monster'],['B','beta','player'],['C','gamma','pet']]);
  triple.policy.rules=[elimination(['gamma','beta','alpha'])];
  a.deepEqual(evaluate(triple),resolved(victory(['alpha'],['gamma','beta'])),'N12 membership not Entity kind');
  triple.observation.participants[1].life={entityId:'B',status:'alive'};a.deepEqual(evaluate(triple),pending());
  for(const fact of triple.observation.participants)fact.life={entityId:fact.entityId,status:'dead'};
  a.deepEqual(evaluate(triple),pending());triple.policy.rules=[elimination(['gamma','beta','alpha'],'draw')];a.deepEqual(evaluate(triple),resolved(draw()));
  const neutral=fixture(['party','enemies','spectators'],[['player-001','party','monster'],['monster-001','enemies','player'],['N','spectators','npc']]);
  neutral.observation.participants[2].life={entityId:'N',status:'alive'};a.deepEqual(evaluate(neutral),resolved());
});
contract('20 21 23 24 25 26','dynamic',a=>{
  const f=fixture(),previous=evaluate(f);
  const change=g.applyEncounterMembershipChange(f.state,f.entities,{joinAllowedStatuses:['active'],leaveAllowedStatuses:['active'],changeSideAllowedStatuses:['active'],allowedJoinLifeStatuses:['alive','dead'],requireWorldReadyOnJoin:false},{encounterId:f.state.encounterId,operation:'leave',entityId:'monster-001'});
  a.equal(change.status,'applied');f.state=change.state;f.observation.participants=f.observation.participants.slice(0,1);
  a.deepEqual(evaluate(f),pending(),'N04 empty contender cannot lose');a.deepEqual(previous,resolved());a.equal(f.state.status,'active');
  const empty=fixture(['party','enemies'],[]);empty.policy.rules=[elimination(['party','enemies'],'draw')];a.deepEqual(evaluate(empty),pending());
  const separate=fixture();separate.state={...separate.state,encounterId:'another'};separate.observation.encounterId='another';a.equal(evaluate(separate).encounterId,'another');a.deepEqual(evaluate(f),pending());
  const revived=fixture();revived.observation.participants[1].life={entityId:'monster-001',status:'alive'};a.deepEqual(evaluate(revived),pending());
  for(const contenders of [[],['party']])a.throws(()=>g.createEncounterCompletionPolicy({definitionId:'D',rules:[elimination(contenders)]}),{name:'TypeError'});
  const one=fixture(['survivors'],[['S','survivors','custom']]);one.policy.rules=[objective('survival','succeeded',victory(['survivors'],[]),'survive-until-turn-10')];
  const activated=g.activateEncounter({...one.state,status:'prepared'},one.entities,{minimumParticipants:1,minimumOccupiedSides:1,requiredOccupiedSideIds:[],allowedLifeStatuses:['alive'],requireWorldReady:false},{encounterId:one.state.encounterId,participants:[{entityId:'S',life:{entityId:'S',status:'alive'},worldReady:false}]});
  a.equal(activated.status,'activated');one.state=activated.state;one.observation.objectives=[{objectiveId:'survive-until-turn-10',status:'succeeded'}];a.deepEqual(evaluate(one).outcome,victory(['survivors'],[]));
});
contract('27 28 29 30 31 32 33 34 35 39 40','objectives',a=>{
  const f=fixture();f.policy.rules=[objective()];f.observation.objectives=[{objectiveId:'protect-crystal',status:'succeeded'}];a.deepEqual(evaluate(f),resolved(victory(),'protect'));
  f.policy.rules=[objective('failure','failed',victory(['enemies'],['party']))];f.observation.objectives[0].status='failed';a.deepEqual(evaluate(f),resolved(victory(['enemies'],['party']),'failure'));
  f.observation.objectives[0].status='pending';a.deepEqual(evaluate(f),pending(),'N06 pending objective cannot match');f.observation.objectives=[];a.deepEqual(evaluate(f),pending(),'unreported objective cannot match');
  f.policy.rules=[objective('first'),objective('second','succeeded',draw(),'second-objective')];f.observation.objectives=[{objectiveId:'second-objective',status:'succeeded'},{objectiveId:'protect-crystal',status:'succeeded'}];a.equal(evaluate(f).ruleId,'first','N07 ordered policy priority');f.observation.objectives.reverse();a.equal(evaluate(f).ruleId,'first');
  f.policy.rules=[];a.deepEqual(evaluate(f),pending());f.policy.rules=[objective('unknown','succeeded',victory(['missing'],[]))];a.throws(()=>evaluate(f),{name:'TypeError',message:/side reference/});
  const multi=fixture(['alpha','beta','gamma','delta'],[['A','alpha','custom'],['B','beta','monster'],['C','gamma','player'],['D','delta','pet']]);
  multi.policy.rules=[objective('coalition','succeeded',victory(['beta','alpha'],['delta','gamma']))];multi.observation.objectives=[{objectiveId:'protect-crystal',status:'succeeded'}];
  a.deepEqual(evaluate(multi),resolved(victory(['beta','alpha'],['delta','gamma']),'coalition'),'N13 exact L3 side order');
  multi.policy.rules=[objective('draw','succeeded',draw())];a.deepEqual(evaluate(multi),resolved(draw(),'draw'));
  // Unsatisfied elimination continues into explicit forfeit; leave is never itself a loss.
  f.policy.rules=[elimination(),objective('forfeit','succeeded',victory(),'forfeit-reported')];f.state={...f.state,participants:f.state.participants.slice(0,1)};f.observation.participants=f.observation.participants.slice(0,1);f.observation.objectives=[{objectiveId:'forfeit-reported',status:'succeeded'}];a.equal(evaluate(f).ruleId,'forfeit');
});
contract('36 37 38 51 52 53 54 55','barriers',a=>{
  const f=fixture();f.observation.continuation='pending';a.deepEqual(evaluate(f),pending('continuation_pending'),'N05 continuation barrier');
  f.policy.rules=[objective()];f.observation.objectives=[{objectiveId:'protect-crystal',status:'succeeded'}];a.deepEqual(evaluate(f),pending('continuation_pending'));
  f.observation.participants=[];a.deepEqual(evaluate(f),pending('continuation_pending'));f.observation.continuation='clear';a.deepEqual(evaluate(f),pending('participant_fact_missing','player-001'));
  const next=fixture();next.entities=g.addEntity(next.entities,g.createEntity({id:'wave2',kind:'monster'}));next.state={...next.state,participants:[next.state.participants[0],{entityId:'wave2',sideId:'enemies'}]};
  next.observation.participants=[next.observation.participants[0],{entityId:'wave2',life:{entityId:'wave2',status:'alive'}}];a.deepEqual(evaluate(next),pending());next.observation.participants[1].life.status='dead';a.deepEqual(evaluate(next),resolved());a.equal(next.state.status,'active');
  next.observation.participants.reverse();next.observation.participants=[];a.deepEqual(evaluate(next),pending('participant_fact_missing','player-001'));
});
contract('41 42 43 44 45 46','invalid-outcomes',a=>{
  const reject=(outcome,message)=>a.throws(()=>g.createEncounterCompletionPolicy({definitionId:'D',rules:[objective('O','succeeded',outcome)]}),{name:'TypeError'},message);
  reject(victory(['party'],['party']),'N14 disjoint winner defeated');reject(victory(['party','party'],[]),'duplicate winner');reject(victory(['party'],['enemies','enemies']),'duplicate defeated');
  reject(victory([],['enemies']),'N15 winnerless victory');reject({kind:'draw',winnerSideIds:['party'],defeatedSideIds:[]},'N15 nonempty draw winner');reject({kind:'draw',winnerSideIds:[],defeatedSideIds:['enemies']},'N15 nonempty draw defeated');
  for(const outcome of [victory(['unknown'],[]),victory(['party'],['unknown'])]){const f=fixture();f.policy.rules=[objective('unknown','succeeded',outcome)];a.throws(()=>evaluate(f),{name:'TypeError',message:/side reference/});}
});
contract('49 50 58','validate-before-domain',a=>{
  const f=fixture();for(const status of ['prepared','resolved','closed','cancelled']){f.state={...f.state,status};a.deepEqual(evaluate(f),pending('encounter_not_active'),'N17 nonactive barrier');}
  const later=fixture();later.policy.rules=[objective(),{...objective('malformed'),whenStatus:'pending'}];later.observation.objectives=[{objectiveId:'protect-crystal',status:'succeeded'}];
  a.throws(()=>evaluate(later),{name:'TypeError',message:/objective rule/},'N08 complete later rule validation');
  for(const status of ['active','closed']){later.state={...later.state,status};later.observation.continuation='pending';a.throws(()=>evaluate(later),{name:'TypeError',message:/objective rule/});}
});
contract('56','snapshots-replay',a=>{
  const first=fixture(),second=fixture();a.notEqual(first.state,second.state);a.notEqual(first.observation,second.observation);
  const one=evaluate(first),two=evaluate(second);a.deepEqual(one,resolved());a.deepEqual(two,resolved());a.notEqual(one,two);a.notEqual(one.outcome.winnerSideIds,two.outcome.winnerSideIds);frozen(a,one);frozen(a,two);
  const f=fixture();f.policy.rules=[objective()];f.observation.objectives=[{objectiveId:'protect-crystal',status:'succeeded'}];
  const policy=g.createEncounterCompletionPolicy(f.policy),captured=evaluateEncounterCompletion(f.state,f.entities,policy,f.observation);
  a.ok(Object.isFrozen(captured.outcome.winnerSideIds),'N18 frozen outcome arrays');frozen(a,captured);frozen(a,policy);a.notEqual(captured.outcome,policy.rules[0].outcome);
  f.policy.rules[0].outcome.winnerSideIds[0]='enemies';a.deepEqual(captured,resolved(victory(),'protect'));a.equal(Object.isFrozen(f.policy),false);a.equal(Object.isFrozen(f.policy.rules[0].outcome.winnerSideIds),false);
  const literal='["resolvable","rule_matched","forest-fight-001","last-standing",null,"victory",["party"],["enemies"]]';
  const trace=r=>JSON.stringify([r.status,r.reason,r.encounterId,r.ruleId,r.participantEntityId,r.outcome.kind,r.outcome.winnerSideIds,r.outcome.defeatedSideIds]);
  a.equal(trace(one),literal);a.equal(trace(two),literal);console.log('ENCOUNTER_COMPLETION_REPLAY_SHA256 '+createHash('sha256').update(literal).digest('hex'));
});
contract('57','purity',a=>{
  const f=fixture(),before=clone(f);let calls=0;
  const saved=[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval,globalThis.crypto?.randomUUID];
  const trap=()=>{throw new Error('N19 forbidden implicit completion provider');};
  globalThis.__encounterCompletionDispatch=()=>{calls++;};
  try{Date.now=trap;Math.random=trap;globalThis.setTimeout=trap;globalThis.setInterval=trap;if(globalThis.crypto)globalThis.crypto.randomUUID=trap;a.deepEqual(evaluate(f),resolved());}
  finally{[Date.now,Math.random,globalThis.setTimeout,globalThis.setInterval]=saved;if(globalThis.crypto)globalThis.crypto.randomUUID=saved[4];delete globalThis.__encounterCompletionDispatch;}
  a.equal(calls,0,'N20 zero reward World dispatch');a.deepEqual(f,before);a.equal(f.state.status,'active');
});
contract('47 48','canonical-combat',a=>{
  const f=fixture(),player=g.getEntity(f.entities,'player-001'),monster=g.getEntity(f.entities,'monster-001');
  const life=g.createEntityLifeState(monster,{status:'alive'}),resources=g.createEntityResourceState(monster,{health:{minimum:0,maximum:20,current:20}});
  const action=g.createCombatActionContext({actionId:'lethal',actionType:'explicit',sourceEntityId:player.id,target:{kind:'entity',entityId:monster.id}});
  const admission=g.evaluateCombatActionAdmission(action,f.entities,g.createEntityLifeState(player,{status:'alive'}),{eligible:true});
  const target=g.evaluateCombatTargetValidation(admission,f.entities,life,{relation:'enemy',allowedRelations:['enemy'],allowedLifeStatuses:['alive']});
  const context=g.createExecutionContext({clock:{now:()=>1000},random:{next:()=>.5}});
  const attack=g.resolveCombatAttack(admission,target,{hit:{dodgeChance:0,eligible:true,rule:{enabled:true,bounds:{min:0,max:1}}},critical:{chance:0,bonus:0,eligible:false,rule:{enabled:true,bounds:{min:0,max:1}}},damage:{base:20,rank:1,perRank:0,scaling:[],flat:{definition:0,additional:0,resolved:0},bonuses:[]},mitigation:{ruleKey:'none',rating:0,rule:{enabled:false,bounds:{min:0,max:1},levelScalingEnabled:false}}},context);
  const application=g.applyCombatAttackDamage(attack,resources,life,{resourceId:'health',minimum:0,maximum:20,currentAboveMaximum:'reject'});
  a.equal(application.resourceResult.state.current.health,0);a.equal(application.lifeResult.state.status,'dead');
  f.observation.participants[1].life=application.lifeResult.state;const before=clone({application,attack,f});
  let dispatch=0;globalThis.__encounterCompletionDispatch=()=>{dispatch++;};try{a.deepEqual(evaluate(f),resolved());}finally{delete globalThis.__encounterCompletionDispatch;}
  a.equal(dispatch,0,'no reward dispatch');a.deepEqual({application,attack,f},before);a.equal(f.state.status,'active');
});
contract('60','installed-surface',a=>{
  const manifest=JSON.parse(readFileSync(new URL('./node_modules/@rpg/gameplay/package.json',import.meta.url)));
  a.equal(manifest.version,'0.8.5');a.deepEqual(manifest.exports,{'.':{types:'./dist/index.d.ts',import:'./dist/index.js'}});
  for(const name of ['createEncounterCompletionPolicy','createEncounterCompletionObservation','evaluateEncounterCompletion'])a.equal(typeof g[name],'function');
  const registry=[{id:'entity',optional:true,dependencies:[]},{id:'encounter',optional:true,dependencies:['entity']}].reduce(g.registerModule,g.createModuleRegistry());const composition=g.composeModules(registry,g.configureModules(registry,{enable:['entity','encounter']}));a.deepEqual(composition.moduleIds,['entity','encounter']);a.deepEqual(evaluate(fixture()),resolved());
});
contract('','structural',a=>{
  const f=fixture();let reads=0;
  const getter=()=>{reads++;return 'succeeded';};
  const invalid=[null,[],Object.create({encounterId:'forest-fight-001'}),{...f.observation,extra:true},{...f.observation,[Symbol()]:1},{...f.observation,participants:[,]},{...f.observation,participants:Object.assign([],{extra:1})},{...f.observation,continuation:'unknown'},{...f.observation,participants:[{entityId:'player-001',life:{entityId:'player-001',status:'unknown'}}]},{...f.observation,objectives:[{objectiveId:'X',get status(){return getter();}}]}];
  for(const input of invalid)a.throws(()=>g.createEncounterCompletionObservation(input),{name:'TypeError'});
  const policies=[{...f.policy,rules:[elimination(),elimination()]},{...f.policy,rules:[{...elimination(),zeroSurvivors:'win'}]},{...f.policy,rules:[{...objective(),get whenStatus(){return getter();}}]},{...f.policy,rules:[{...objective(),outcome:{...victory(),get winnerSideIds(){reads++;return ['party'];}}}]},{...f.policy,rules:[{...elimination(),contenderSideIds:['party','party']}]},{...f.policy,rules:[{...elimination(),contenderSideIds:['party',' ']}]}];
  for(const input of policies)a.throws(()=>g.createEncounterCompletionPolicy(input),{name:'TypeError'});a.equal(reads,0);
  const nullPrototype=Object.assign(Object.create(null),f.observation);a.deepEqual(g.createEncounterCompletionObservation(nullPrototype),f.observation);
  const broken=fixture();broken.entities=g.removeEntity(broken.entities,'monster-001');a.throws(()=>evaluate(broken),{name:'TypeError'});
});
