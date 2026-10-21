import {createItemDefinition,createItemInstance,getItemInstanceProperty,setItemInstanceProperty,replaceItemInstanceProperties,
  type ItemPropertyReadResult,type ItemPropertyOperationAdmission,type ItemPropertyOperationResult,type ItemInstanceState} from '@rpg/gameplay';
const d=createItemDefinition({definitionId:'D'},{categoryId:null,tagIds:[],rarityId:null,properties:{}});
const i=createItemInstance(d,{instanceId:'I',properties:{}});
const admission:ItemPropertyOperationAdmission={eligible:true};
const read:ItemPropertyReadResult=getItemInstanceProperty(d,i,'');
if(read.found){const value=read.value;void value;
  // @ts-expect-error Read result is readonly.
  read.value=1;
}else{
  // @ts-expect-error Absent has no value field.
  read.value;
}
const outcome:ItemPropertyOperationResult=setItemInstanceProperty(d,i,'x',null,admission);
function narrow(result:ItemPropertyOperationResult){
  if(result.status==='accepted'){
    const candidate:ItemInstanceState=result.candidate;const reason:'none'=result.reason;void reason;
    // @ts-expect-error Candidate identity remains readonly.
    candidate.instanceId='other';
    // @ts-expect-error Candidate properties remain readonly.
    candidate.properties.x=2;
    // @ts-expect-error Outcome candidate is readonly.
    result.candidate=i;
  }else{const candidate:null=result.candidate;const reason:'ineligible'=result.reason;void candidate;void reason;}
}
narrow(outcome);narrow(replaceItemInstanceProperties(d,i,{},admission));
// @ts-expect-error Admission readonly.
admission.eligible=false;
// @ts-expect-error Boolean only.
setItemInstanceProperty(d,i,'x',1,{eligible:1});
// @ts-expect-error Closed admission.
replaceItemInstanceProperties(d,i,{},{eligible:true,extra:1});
// @ts-expect-error String key only.
getItemInstanceProperty(d,i,1);
// @ts-expect-error No unsafe values.
setItemInstanceProperty(d,i,'x',undefined,admission);
// @ts-expect-error Complete instance required.
getItemInstanceProperty(d,{instanceId:'I',definitionId:'D'},'x');
// @ts-expect-error Root entry only.
import {} from '@rpg/gameplay/dist/modules/item/index.js';
