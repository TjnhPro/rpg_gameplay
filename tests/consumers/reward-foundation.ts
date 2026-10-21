import {createRewardPackage, validateRewardPackage, createRewardClaimState, validateRewardClaimState,
  type RewardLine, type RewardPackage, type RewardSourceReference, type RewardRecipientReference,
  type RewardClaimState} from '@rpg/gameplay';

const line: RewardLine = {lineId:'a',grantKindId:'future',referenceId:'opaque',amount:0.25};
const reward: RewardPackage = validateRewardPackage(createRewardPackage({packageId:'p',lines:[line]}));
const source: RewardSourceReference = {kind:'quest',id:'q'};
const recipient: RewardRecipientReference = {kind:'account',id:'a'};
const claim: RewardClaimState = validateRewardClaimState(createRewardClaimState({claimId:'c',source,recipient,reward,status:'available'}));
const status: 'available' | 'claimed' = claim.status;
// @ts-expect-error package identity is readonly
reward.packageId = 'changed';
// @ts-expect-error lines are readonly
reward.lines.push(line);
// @ts-expect-error nested line values are readonly
line.amount = 3;
// @ts-expect-error embedded package is readonly
claim.reward = reward;
// @ts-expect-error source reference is readonly
source.id = 'changed';
// @ts-expect-error recipient reference is readonly
recipient.kind = 'changed';
// @ts-expect-error claim status is readonly
claim.status = 'claimed';
// @ts-expect-error unknown status
createRewardClaimState({claimId:'c',source,recipient,reward,status:'pending'});
// @ts-expect-error package lines are mandatory
createRewardPackage({packageId:'p'});
// @ts-expect-error amount is a number
const bad: RewardLine = {lineId:'a',grantKindId:'item',referenceId:'x',amount:'3'};
// @ts-expect-error no source policy or delivery engine metadata
createRewardPackage({packageId:'p',lines:[],delivered:true});
void [bad,status];
