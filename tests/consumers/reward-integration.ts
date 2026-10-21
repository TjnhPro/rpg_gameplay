import {createEntity,createItemDefinition,createItemInstance,createInventoryState,addInventoryEntry,
 createProgressionState,gainExperience,createRewardPackage,validateRewardPackage,createRewardClaimState,
 validateRewardClaimState,prepareRewardClaim,type RewardLine,type RewardPackage,type RewardSourceReference,
 type RewardRecipientReference,type RewardClaimState,type RewardClaimAdmission,type RewardClaimPreparationResult,
 type InventoryState,type InventoryValidationContext,type ProgressionState} from '@rpg/gameplay';
const line:RewardLine={lineId:'i',grantKindId:'item',referenceId:'potion_hp',amount:3};
const reward:RewardPackage=validateRewardPackage(createRewardPackage({packageId:'p',lines:[line]}));
const source:RewardSourceReference={kind:'quest',id:'q'},recipient:RewardRecipientReference={kind:'character',id:'hero-A'};
const claim:RewardClaimState=validateRewardClaimState(createRewardClaimState({claimId:'c',source,recipient,reward,status:'available'}));
const admission:RewardClaimAdmission={eligible:true};
const result:RewardClaimPreparationResult=prepareRewardClaim(claim,admission);
const definition=createItemDefinition({definitionId:'potion_hp'},{categoryId:null,tagIds:[],rarityId:null,properties:{}});
const context:InventoryValidationContext={items:[{definition,stackPolicy:{stackable:true},maxStackQuantity:20}]};
const inventory:InventoryState=createInventoryState({inventoryId:'bag',owner:null,entries:[]},context);
const progression:ProgressionState=createProgressionState(createEntity({id:'hero-A',kind:'character'}),{level:1,experience:25});
if(result.status==='accepted') {
 const reason:'none'=result.reason,candidate:RewardClaimState=result.candidate,grants:readonly RewardLine[]=result.grants;
 const item=createItemInstance(definition,{instanceId:'caller-id',properties:{}});
 const added=addInventoryEntry(inventory,context,{item,quantity:3},{maxEntries:2},{eligible:true});
 const gained=gainExperience(progression,100,{maximumExperience:1000});
 if(added.status==='accepted') {
  const next:{readonly claim:RewardClaimState;readonly inventory:InventoryState;readonly progression:ProgressionState}=
   {claim:candidate,inventory:added.candidate,progression:gained.state};
  // @ts-expect-error authoritative snapshots remain readonly
  next.inventory.entries.push({item,quantity:1});
  // @ts-expect-error progression scalar is readonly
  next.progression.experience=0;
 }
 // @ts-expect-error candidate status is readonly
 candidate.status='available';
 // @ts-expect-error accepted grants are readonly
 result.grants.push(line);
 // @ts-expect-error accepted cannot have null candidate
 const absent:null=result.candidate;
 void [reason,absent];
} else {
 const reason:'already_claimed'|'ineligible'=result.reason,candidate:null=result.candidate,grants:readonly []=result.grants;
 // @ts-expect-error rejected cannot provide a claim candidate
 const leaked:RewardClaimState=result.candidate;
 void [reason,candidate,grants,leaked];
}
// @ts-expect-error opaque IDs still require strings
const bad:RewardLine={lineId:1,grantKindId:'item',referenceId:'potion_hp',amount:3};
void bad;
