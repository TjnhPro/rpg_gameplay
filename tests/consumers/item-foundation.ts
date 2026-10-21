import {createItemDefinitionReference,createItemInstanceReference,validateItemInstanceReference,
  createItemDefinition,validateItemDefinition,createItemInstance,validateItemInstance,
  type ItemDefinitionReference,type ItemInstanceInitialIdentity,type ItemInstanceReference,type ItemPropertyValue,
  type ItemDefinitionContent,type ItemDefinition,type ItemInstanceInitialState,type ItemInstanceState} from '@rpg/gameplay';
const reference:ItemDefinitionReference=createItemDefinitionReference({definitionId:'D'});
const identity:ItemInstanceInitialIdentity={instanceId:'I'};
const ref:ItemInstanceReference=createItemInstanceReference(reference,identity);
validateItemInstanceReference(reference,ref);
const value:ItemPropertyValue={nested:[null,false,'',0,{x:1}]};
const content:ItemDefinitionContent={categoryId:null,tagIds:['T'],rarityId:'opaque',properties:{value}};
const definition:ItemDefinition=validateItemDefinition(createItemDefinition(reference,content));
const initial:ItemInstanceInitialState={...identity,properties:{value}};
const instance:ItemInstanceState=validateItemInstance(definition,createItemInstance(definition,initial));
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
const definitionKeys:Equal<keyof ItemDefinition,'definitionId'|'categoryId'|'tagIds'|'rarityId'|'properties'>=true;
const instanceKeys:Equal<keyof ItemInstanceState,'instanceId'|'definitionId'|'properties'>=true;
// The recursive index signature is structurally the approved Readonly<Record>.
type ApprovedValue=null|string|number|boolean|readonly ItemPropertyValue[]|Readonly<Record<string,ItemPropertyValue>>;
const recursiveShape:Equal<ItemPropertyValue,ApprovedValue>=true;
void definitionKeys;void instanceKeys;void recursiveShape;
// @ts-expect-error Readonly reference identity.
reference.definitionId='other';
// @ts-expect-error Readonly instance reference.
ref.instanceId='other';
// @ts-expect-error Readonly full definition identity (mutation negative control).
definition.definitionId='other';
// @ts-expect-error Readonly metadata.
definition.categoryId=null;
// @ts-expect-error Readonly tag list.
definition.tagIds.push('other');
// @ts-expect-error Readonly dictionary.
instance.properties.x=1;
// @ts-expect-error Readonly full instance identity.
instance.instanceId='other';
// @ts-expect-error Function is not safe Item data.
const invalid:ItemPropertyValue=()=>1;void invalid;
// @ts-expect-error Definition requires all content fields.
createItemInstance(reference,initial);
// @ts-expect-error No quantity inside Item.
createItemInstance(definition,{...initial,quantity:1});
// @ts-expect-error No owner field inside Item.
const owner:ItemInstanceState={...instance,ownerId:'X'};void owner;
// @ts-expect-error Item is exposed only through the package root.
import {} from '@rpg/gameplay/dist/modules/item/index.js';
function narrow(input:ItemPropertyValue):void {
  if(input===null)return;
  if(typeof input==='string'||typeof input==='number'||typeof input==='boolean')return;
  if(Array.isArray(input))return;
  const dictionary:Readonly<Record<string,ItemPropertyValue>>=input as Readonly<Record<string,ItemPropertyValue>>;
  // @ts-expect-error Recursive dictionary is readonly.
  dictionary.x=3;
}
void narrow;
