import {evaluateActorAILifeGate,evaluateActorAIReset,createActorAIDecisionTimingState,evaluateActorAIDecisionTiming,
 type ActorAILifeGateResult,type ActorAIResetReason,type ActorAIResetRequest,type ActorAIResetResult,
 type ActorAIDecisionTimingState,type ActorAIDecisionTimingPolicy,type ActorAIDecisionTimingResult,
 type ActorAIState,type EntityCollection,type EntityLifeState,type ActorAIBehaviorPolicy,type GameplayExecutionContext} from '@rpg/gameplay';
declare const state:ActorAIState,entities:EntityCollection,life:EntityLifeState,behavior:ActorAIBehaviorPolicy,context:GameplayExecutionContext;
const gate:ActorAILifeGateResult=evaluateActorAILifeGate(state,entities,life);
if(gate.status==='allowed'){const r:'none'=gate.reason;void r;}else{const r:'actor_dead'|'manual_control'=gate.reason;void r;}
const reason:ActorAIResetReason='respawn';const request:ActorAIResetRequest={reason,resetBehaviorStateId:'idle'};
const reset:ActorAIResetResult=evaluateActorAIReset(state,entities,life,behavior,request);
if(reset.status==='applied'){const next:ActorAIState=reset.state;void next;}else{const no:null=reset.state;void no;}
const timing:ActorAIDecisionTimingState=createActorAIDecisionTimingState(state,context);
const policy:ActorAIDecisionTimingPolicy={intervalMs:500};
const result:ActorAIDecisionTimingResult=evaluateActorAIDecisionTiming(state,entities,life,timing,policy,context);
if(result.status==='ready'){const next:ActorAIDecisionTimingState=result.state;void next;}else{const no:null=result.state;void no;}
// @ts-expect-error Immutable cursor.
timing.observedAtMs=0;
// @ts-expect-error Life must be provided.
evaluateActorAILifeGate(state,entities);
// @ts-expect-error Context opaque capability, not a raw clock.
createActorAIDecisionTimingState(state,{now:()=>1000});
// @ts-expect-error Actor-bound cursor cannot omit actor.
const missing:ActorAIDecisionTimingState={observedAtMs:0,nextEligibleAtMs:0};void missing;
// @ts-expect-error Closed policy.
const wrong:ActorAIDecisionTimingPolicy={intervalMs:500,catchUp:true};void wrong;
// @ts-expect-error blocked result never contains a timing candidate.
const bad:ActorAIDecisionTimingResult={status:'blocked',reason:'actor_dead',state:timing};void bad;
// @ts-expect-error reason discriminant.
const badGate:ActorAILifeGateResult={status:'allowed',reason:'actor_dead',actorId:'A'};void badGate;
// @ts-expect-error Closed reset reasons.
const badRequest:ActorAIResetRequest={reason:'revive',resetBehaviorStateId:'idle'};void badRequest;
// @ts-expect-error Root-only package.
import {} from '@rpg/gameplay/modules/actor-ai';
