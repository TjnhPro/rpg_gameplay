import {prepareRewardClaim,createRewardClaimState,type RewardClaimAdmission,type RewardClaimPreparationResult,
  type RewardClaimState,type RewardLine} from '@rpg/gameplay';
const state=createRewardClaimState({claimId:'c',source:{kind:'quest',id:'q'},recipient:{kind:'character',id:'a'},
  reward:{packageId:'p',lines:[]},status:'available'});
const admission:RewardClaimAdmission={eligible:true};
const result:RewardClaimPreparationResult=prepareRewardClaim(state,admission);
if(result.status==='accepted') {
  const reason:'none'=result.reason,candidate:RewardClaimState=result.candidate,grants:readonly RewardLine[]=result.grants;
  // @ts-expect-error accepted candidate cannot be null
  const absent:null=result.candidate;
  // @ts-expect-error nested candidate is readonly
  result.candidate.status='available';
  // @ts-expect-error grants array is readonly
  result.grants.push({lineId:'a',grantKindId:'item',referenceId:'x',amount:1});
  for(const line of result.grants) {
    // @ts-expect-error grant snapshots are readonly
    line.amount=0;
  }
  void [reason,candidate,grants,absent];
} else {
  const reason:'already_claimed'|'ineligible'=result.reason,candidate:null=result.candidate,grants:readonly []=result.grants;
  // @ts-expect-error rejection never leaks a candidate
  const leak:RewardClaimState=result.candidate;
  // @ts-expect-error rejected reason cannot claim success
  const success:'none'=result.reason;
  void [reason,candidate,grants,leak,success];
}
// @ts-expect-error result discriminant is readonly
result.status='rejected';
// @ts-expect-error admission is readonly
admission.eligible=false;
// @ts-expect-error explicit eligibility is mandatory
prepareRewardClaim(state,{});
// @ts-expect-error eligibility is boolean without coercion
prepareRewardClaim(state,{eligible:'true'});
// @ts-expect-error extra policy fields are outside this operation
prepareRewardClaim(state,{eligible:true,grant:true});
