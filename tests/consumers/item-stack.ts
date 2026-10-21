import {createItemDefinition,createItemInstance,validateItemStackPolicy,assessItemStackCompatibility,
  type ItemStackPolicy,type ItemStackCompatibilityResult} from '@rpg/gameplay';
const policy:ItemStackPolicy=validateItemStackPolicy({stackable:true});
const d=createItemDefinition({definitionId:'D'},{categoryId:null,tagIds:[],rarityId:null,properties:{}});
const left=createItemInstance(d,{instanceId:'A',properties:{}}),right=createItemInstance(d,{instanceId:'B',properties:{}});
const result:ItemStackCompatibilityResult=assessItemStackCompatibility(d,left,d,right,policy);
function narrow(value:ItemStackCompatibilityResult){
  if(value.compatible){const reason:'none'=value.reason;void reason;}
  else{const reason:'same_instance'|'different_definition'|'definition_conflict'|'not_stackable'|'different_properties'=value.reason;void reason;}
  // @ts-expect-error Readonly result.
  value.compatible=false;
  // @ts-expect-error Readonly reason.
  value.reason='none';
  // @ts-expect-error Advisory result has no quantity or state.
  value.quantity;
}
narrow(result);
// @ts-expect-error Readonly policy.
policy.stackable=false;
// @ts-expect-error Closed input policy.
validateItemStackPolicy({stackable:true,maxStack:9});
// @ts-expect-error Boolean only.
validateItemStackPolicy({stackable:'true'});
// @ts-expect-error Complete instance required.
assessItemStackCompatibility(d,{instanceId:'A',definitionId:'D'},d,right,policy);
// @ts-expect-error Result discriminates reason.
const bad:ItemStackCompatibilityResult={compatible:true,reason:'same_instance'};void bad;
// @ts-expect-error No deep package entrypoint.
import {} from '@rpg/gameplay/dist/modules/item/index.js';
