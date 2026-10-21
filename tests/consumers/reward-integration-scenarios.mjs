import test from 'node:test';
import assert from 'node:assert/strict';

// Test-local L4 only. Both direct and physical-installed runners supply the public root.
export function rewardIntegrationTests(g) {
 const lines=[{lineId:'line-item',grantKindId:'item',referenceId:'potion_hp',amount:3},
  {lineId:'line-exp',grantKindId:'experience',referenceId:'character_exp',amount:100}];
 const owner={ownerKind:'character',ownerId:'hero-A'};
 const claimLiteral={claimId:'claim-A',source:{kind:'quest',id:'fixture-quest'},
  recipient:{kind:'character',id:'hero-A'},reward:{packageId:'fixture-quest-reward',lines},status:'available'};
 const initialInventory={inventoryId:'bag-A',owner,entries:[]};
 const initialProgression={entityId:'hero-A',level:1,experience:25};
 const finalInventory={inventoryId:'bag-A',owner,entries:[{item:{instanceId:'claim-A:line-item',
  definitionId:'potion_hp',properties:{quality:'fixture'}},quantity:3}]};
 function setup(rewardLines=lines) {
  const definition=g.createItemDefinition({definitionId:'potion_hp'},
   {categoryId:'consumable',tagIds:['healing'],rarityId:null,properties:{}});
  const context={items:[{definition,stackPolicy:{stackable:true},maxStackQuantity:20}]};
  const raw={...structuredClone(claimLiteral),reward:{packageId:'fixture-quest-reward',lines:structuredClone(rewardLines)}};
  const state=Object.freeze({claim:g.createRewardClaimState(raw),
   inventory:g.createInventoryState(initialInventory,context),
   progression:g.createProgressionState(g.createEntity({id:'hero-A',kind:'character'}),{level:1,experience:25})});
  return {raw,context,state};
 }
 function frozen(value) {
  if(value&&typeof value==='object') {
   assert.ok(Object.isFrozen(value),'deep frozen result');
   for(const child of Object.values(value))frozen(child);
  }
 }
 // A fixed integration fixture, not a reusable dispatcher. No authoritative writes here.
 function propose(base,context,{eligible=true,maxEntries=2,expPolicy,expectedSource='fixture-quest'}={}) {
  const calls=[];
  const plan=g.prepareRewardClaim(base.claim,{eligible});
  const deny=reason=>({status:'rejected',reason,baseline:base,candidate:null,plan,calls});
  if(plan.status==='rejected')return deny(plan.reason);
  if(base.claim.claimId!=='claim-A'||base.claim.source.kind!=='quest'||base.claim.source.id!==expectedSource||
   base.claim.recipient.kind!=='character'||base.claim.recipient.id!==base.progression.entityId||
   base.inventory.owner?.ownerKind!=='character'||base.inventory.owner.ownerId!==base.claim.recipient.id)return deny('binding_mismatch');
  for(const line of plan.grants) {
   if(line.grantKindId!=='item'&&line.grantKindId!=='experience')return deny('unsupported_kind');
   if(line.grantKindId==='experience'&&line.referenceId!=='character_exp')return deny('unsupported_reference');
  }
  let inventory=base.inventory,progression=base.progression;
  for(const line of plan.grants) {
   if(line.grantKindId==='item') {
    const fact=context.items.find(x=>x.definition.definitionId===line.referenceId);
    if(!fact)return deny('unresolved_item');
    calls.push('item');
    const item=g.createItemInstance(fact.definition,{instanceId:base.claim.claimId+':'+line.lineId,
     properties:{quality:'fixture'}});
    calls.push('inventory');
    const added=g.addInventoryEntry(inventory,context,{item,quantity:line.amount},{maxEntries},{eligible:true});
    if(added.status==='rejected')return deny(added.reason);
    inventory=added.candidate;
   } else {
    calls.push('experience');
    const gained=g.gainExperience(progression,line.amount,expPolicy);
    if(gained.transition.limited||gained.transition.appliedDelta!==line.amount)return deny('incomplete_experience');
    progression=gained.state;
   }
  }
  return {status:'accepted',reason:'none',baseline:base,plan,calls,
   candidate:Object.freeze({claim:plan.candidate,inventory,progression})};
 }
 function commit(current,proposal) {
  if(proposal.status!=='accepted'||proposal.baseline!==current)return current;
  return proposal.candidate; // caller assigns this one composite reference, synchronously
 }
 test('RWI success: literal Item3 EXP100 candidates and one composite commit',()=>{
  const {state,context}=setup();let current=state;
  assert.deepEqual(state.claim,claimLiteral);assert.deepEqual(state.inventory,initialInventory);
  const p=propose(current,context);
  assert.equal(current,state);assert.deepEqual(current.progression,initialProgression);
  assert.deepEqual(p.plan,{status:'accepted',reason:'none',candidate:{...claimLiteral,status:'claimed'},grants:lines});
  assert.deepEqual(Reflect.ownKeys(p.plan),['status','reason','candidate','grants']);
  assert.deepEqual(p.candidate.inventory,finalInventory);
  assert.deepEqual(p.candidate.progression,{entityId:'hero-A',level:1,experience:125});
  assert.deepEqual(g.gainExperience(state.progression,100),{state:{entityId:'hero-A',level:1,experience:125},
   transition:{entityId:'hero-A',before:25,after:125,requestedDelta:100,appliedDelta:100,limited:false}});
  assert.deepEqual(p.calls,['item','inventory','experience']);frozen(p.plan);frozen(p.candidate);
  assert.notEqual(p.plan.grants,state.claim.reward.lines);assert.notEqual(p.plan.candidate.reward.lines,p.plan.grants);
  current=commit(current,p);
  assert.deepEqual(current,{claim:{...claimLiteral,status:'claimed'},inventory:finalInventory,
   progression:{entityId:'hero-A',level:1,experience:125}});
  assert.deepEqual(state,{claim:claimLiteral,inventory:initialInventory,progression:initialProgression});
  assert.equal(current,p.candidate);
 });
 test('RWI atomic failure: full bag after EXP proposal and limited EXP after Item proposal',()=>{
  const {state,context}=setup([...lines].reverse());
  const full=propose(state,context,{maxEntries:0});
  assert.equal(full.reason,'capacity_exceeded');assert.equal(full.candidate,null);
  assert.deepEqual(full.calls,['experience','item','inventory']);
  assert.equal(commit(state,full),state);assert.deepEqual(state.progression,initialProgression);
  const normal=setup();
  const limited=propose(normal.state,normal.context,{expPolicy:{maximumExperience:50}});
  assert.equal(limited.reason,'incomplete_experience');assert.equal(limited.candidate,null);
  assert.deepEqual(limited.calls,['item','inventory','experience']);assert.equal(commit(normal.state,limited),normal.state);
  assert.deepEqual(normal.state.inventory,initialInventory);assert.equal(normal.state.claim.status,'available');
 });
 test('RWI delivery admission: fractional Item, unsupported kinds and recipient bindings',()=>{
  const fractional=setup([{...lines[0],amount:1.5}]);
  assert.equal(fractional.state.claim.reward.lines[0].amount,1.5);
  assert.throws(()=>propose(fractional.state,fractional.context),TypeError);
  assert.deepEqual(fractional.state.inventory,initialInventory);
  for(const kind of ['currency','unlock','unknown']) {
   const {state,context}=setup([lines[1],{...lines[0],grantKindId:kind}]);
   const denied=propose(state,context);assert.equal(denied.reason,'unsupported_kind');
   assert.deepEqual(denied.calls,[]);assert.equal(commit(state,denied),state);
  }
  const {state,context}=setup();
  for(const altered of [{...state,progression:{...state.progression,entityId:'other'}},
   {...state,claim:{...state.claim,claimId:'other'}},
   {...state,claim:{...state.claim,source:{kind:'quest',id:'other'}}}]) {
   const denied=propose(altered,context);assert.equal(denied.reason,'binding_mismatch');assert.deepEqual(denied.calls,[]);
  }
 });
 test('RWI replay: claimed rejection and stale available proposals require L4 freshness',()=>{
  const {state,context}=setup();const first=propose(state,context),second=propose(state,context);
  assert.equal(first.status,'accepted');assert.equal(second.status,'accepted');
  assert.deepEqual(first.candidate,second.candidate);assert.notEqual(first.candidate,second.candidate);
  let current=commit(state,first);assert.equal(commit(current,second),current);
  const duplicate=propose(current,context);
  assert.equal(propose(current,context,{eligible:false}).reason,'already_claimed');
  assert.equal(duplicate.reason,'already_claimed');assert.deepEqual(duplicate.calls,[]);
  assert.deepEqual(duplicate.plan,{status:'rejected',reason:'already_claimed',candidate:null,grants:[]});
  const ineligible=propose(state,context,{eligible:false});assert.equal(ineligible.reason,'ineligible');
  assert.deepEqual(ineligible.plan,{status:'rejected',reason:'ineligible',candidate:null,grants:[]});
  assert.deepEqual(ineligible.calls,[]);assert.equal(commit(state,ineligible),state);
  // A different composite baseline (even with same claim) invalidates an old proposal.
  const changed=Object.freeze({...state,progression:g.gainExperience(state.progression,1).state});
  assert.equal(commit(changed,second),changed);assert.equal(changed.progression.experience,26);
  const replay=setup();assert.deepEqual(propose(replay.state,replay.context).candidate,first.candidate);
 });
 test('RWI snapshots: invalid structures fail, L3 mutation cannot rewrite grants',()=>{
  const {state,context,raw}=setup();const p=propose(state,context);
  context.items[0].definition=g.createItemDefinition({definitionId:'replacement'},
   {categoryId:null,tagIds:[],rarityId:null,properties:{}});
  raw.reward.lines[0].amount=19;raw.recipient.id='other';raw.reward.lines.reverse();
  assert.deepEqual(state.claim,claimLiteral);assert.deepEqual(p.plan.grants,lines);frozen(state.claim);frozen(p.plan);
  assert.throws(()=>{p.plan.grants[0].amount=9;},TypeError);
  assert.throws(()=>propose({...state,claim:{...state.claim,status:'claimed',reward:{packageId:'p',lines:[{...lines[0],amount:0}]}}},context),TypeError);
  assert.throws(()=>g.prepareRewardClaim(state.claim,{eligible:'yes'}),TypeError);
 });
 test('RWI neutral composition: empty, independent entitlements and meaningful profile data',()=>{
  const {state,context}=setup([]);const empty=propose(state,context);
  assert.deepEqual(empty.plan.grants,[]);assert.deepEqual(empty.calls,[]);
  assert.equal(empty.status,'accepted');assert.equal(empty.candidate.inventory,state.inventory);
  assert.equal(empty.candidate.progression,state.progression);assert.equal(empty.candidate.claim.status,'claimed');
  const a=g.createRewardClaimState(claimLiteral),b=g.createRewardClaimState({...claimLiteral,claimId:'claim-B'});
  assert.equal(g.prepareRewardClaim(a,{eligible:true}).status,'accepted');
  assert.equal(g.prepareRewardClaim(b,{eligible:true}).status,'accepted');
  // Distinct structural assumptions, not simulated games: text no-op; 2D stack;
  // 2.5D achievement source with opaque fractional EXP and no Item context.
  const achievement=g.createRewardClaimState({...claimLiteral,source:{kind:'achievement',id:'explorer'},
   reward:{packageId:'fractional-exp',lines:[{lineId:'xp',grantKindId:'experience',referenceId:'character_exp',amount:0.5}]}});
  assert.deepEqual(g.prepareRewardClaim(achievement,{eligible:true}).grants,
   [{lineId:'xp',grantKindId:'experience',referenceId:'character_exp',amount:0.5}]);
  assert.equal(g.prepareRewardClaim(achievement,{eligible:true}).candidate.source.kind,'achievement');
  let registry=g.createModuleRegistry();registry=g.registerModule(registry,{id:'reward',optional:true,dependencies:[]});
  const composed=g.composeModules(registry,g.configureModules(registry,{enable:['reward']}));
  assert.deepEqual(composed.moduleIds,['reward']);
 });
}
