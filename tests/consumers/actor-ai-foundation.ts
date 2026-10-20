import {createEntity,createEntityCollection,addEntity,createActorAIProfileReference,createActorAIState,
  validateActorAIState,createActorAIDecisionContext,createActorAIActionIntent,validateActorAIDecisionResult,
  type ActorAIProfileReference,type ActorAIControllerMode,type ActorAIInitialState,type ActorAIState,
  type ActorAIDecisionContext,type ActorAIActionIntent,type ActorAIDecisionResult} from '@rpg/gameplay';
const actor=createEntity({id:'player',kind:'player'});
const entities=addEntity(createEntityCollection(),actor);
const profile:ActorAIProfileReference=createActorAIProfileReference({profileId:'custom'});
const controller:ActorAIControllerMode='ai';
const initial:ActorAIInitialState={controller,behaviorStateId:'idle'};
const state:ActorAIState=validateActorAIState(createActorAIState(actor,profile,initial),entities);
const context:ActorAIDecisionContext=createActorAIDecisionContext(state,'decision');
const intent:ActorAIActionIntent=createActorAIActionIntent(context,{actionKey:'wait',targetEntityId:null});
const result:ActorAIDecisionResult=validateActorAIDecisionResult(state,context,{status:'proposed',reason:'none',intent});
// @ts-expect-error Readonly AI data.
state.targetEntityId='changed';
// @ts-expect-error Readonly profile.
profile.profileId='changed';
// @ts-expect-error Readonly context.
context.actorId='changed';
// @ts-expect-error Readonly intent.
intent.actionKey='changed';
if(result.status==='proposed') {
  const reason:'none'=result.reason;void reason;
  // @ts-expect-error Nested result intent is readonly.
  result.intent.decisionId='changed';
} else {const empty:null=result.intent;void empty;}
// @ts-expect-error Exactly one supported controller.
const bad:ActorAIControllerMode='both';void bad;
// @ts-expect-error Initial target is not configurable.
createActorAIState(actor,profile,{controller:'ai',behaviorStateId:'idle',targetEntityId:'enemy'});
// @ts-expect-error Closed action input requires explicit nullable target.
createActorAIActionIntent(context,{actionKey:'wait'});
// @ts-expect-error Discriminated result forbids intent on no_action.
const invalid:ActorAIDecisionResult={status:'no_action',reason:'no_candidate',intent};void invalid;
// @ts-expect-error Deep package path remains closed.
import {} from '@rpg/gameplay/modules/actor-ai';
