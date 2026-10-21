import {
  createItemDefinitionReference,createItemInstanceReference,validateItemInstanceReference,
  createItemDefinition,validateItemDefinition,createItemInstance,validateItemInstance,
  getItemInstanceProperty,setItemInstanceProperty,replaceItemInstanceProperties,
  validateItemStackPolicy,assessItemStackCompatibility,
  type ItemDefinitionReference,type ItemInstanceInitialIdentity,type ItemInstanceReference,
  type ItemPropertyValue,type ItemDefinitionContent,type ItemDefinition,
  type ItemInstanceInitialState,type ItemInstanceState,type ItemPropertyReadResult,
  type ItemPropertyOperationAdmission,type ItemPropertyOperationResult,
  type ItemStackPolicy,type ItemStackCompatibilityResult,
} from '@rpg/gameplay';

const ref:ItemDefinitionReference=createItemDefinitionReference({definitionId:'D'});
const identity:ItemInstanceInitialIdentity={instanceId:'A'};
const instanceRef:ItemInstanceReference=validateItemInstanceReference(ref,createItemInstanceReference(ref,identity));
const value:ItemPropertyValue={nested:[null,1,'opaque']};
const content:ItemDefinitionContent={categoryId:null,rarityId:null,tagIds:[],properties:{payload:value}};
const d:ItemDefinition=validateItemDefinition(createItemDefinition(ref,content));
const initial:ItemInstanceInitialState={instanceId:instanceRef.instanceId,properties:{payload:value}};
const i:ItemInstanceState=validateItemInstance(d,createItemInstance(d,initial));
const admission:ItemPropertyOperationAdmission={eligible:true};
const result:ItemPropertyOperationResult=setItemInstanceProperty(d,i,'x',1,admission);
const policy:ItemStackPolicy=validateItemStackPolicy({stackable:true});

// Public immutable Item types embed into test-local reader signatures only.
function inventoryReader(definition:ItemDefinition,instance:ItemInstanceState):readonly [string,string,Readonly<Record<string,ItemPropertyValue>>]{
  return [definition.definitionId,instance.instanceId,instance.properties];
}
function equipmentReader(definition:ItemDefinition,instance:ItemInstanceState){
  const category:string|null=definition.categoryId,rarity:string|null=definition.rarityId;
  const tags:readonly string[]=definition.tagIds,properties:Readonly<Record<string,ItemPropertyValue>>=instance.properties;
  return {category,rarity,tags,properties};
}
function useProposal(proposal:ItemPropertyOperationResult){
  if(proposal.status==='accepted'){
    const candidate:ItemInstanceState=validateItemInstance(d,proposal.candidate);
    const reason:'none'=proposal.reason;void reason;
    inventoryReader(d,candidate);equipmentReader(d,candidate);
    // @ts-expect-error Candidate remains deeply readonly through public handoff.
    candidate.properties.x=2;
    // @ts-expect-error Candidate outcome is readonly.
    proposal.candidate=i;
  }else{const candidate:null=proposal.candidate;const reason:'ineligible'=proposal.reason;void candidate;void reason;}
}
useProposal(result);useProposal(replaceItemInstanceProperties(d,i,{},admission));
const lookup:ItemPropertyReadResult=getItemInstanceProperty(d,i,'x');
if(lookup.found){const found:ItemPropertyValue=lookup.value;void found;
  // @ts-expect-error Found data is readonly.
  lookup.value=null;
}else{
  // @ts-expect-error Missing has no value field.
  lookup.value;
}
const other=createItemInstance(d,{instanceId:'B',properties:i.properties});
const compatibility:ItemStackCompatibilityResult=assessItemStackCompatibility(d,i,d,other,policy);
function narrowCompatibility(result:ItemStackCompatibilityResult){
  if(result.compatible){const reason:'none'=result.reason;void reason;}
  else{const reason:'same_instance'|'different_definition'|'definition_conflict'|'not_stackable'|'different_properties'=result.reason;void reason;}
  // @ts-expect-error Advisory outcome is readonly.
  result.compatible=false;
  // @ts-expect-error No quantity or authoritative commit.
  result.quantity;
}
narrowCompatibility(compatibility);
// @ts-expect-error Policy remains readonly.
policy.stackable=false;
// @ts-expect-error Definition metadata remains readonly.
d.categoryId='changed';
// @ts-expect-error No mutable Inventory state on Item.
i.quantity=5;
// @ts-expect-error Definition reference does not replace a complete definition.
createItemInstance(ref,initial);
// @ts-expect-error Source label is outside the closed Item payload.
createItemInstance(d,{...initial,sourceType:'reward'});
// @ts-expect-error No stack engine export.
import {createItemStack} from '@rpg/gameplay';
// @ts-expect-error Private deep entry is closed.
import {} from '@rpg/gameplay/dist/modules/item/index.js';
