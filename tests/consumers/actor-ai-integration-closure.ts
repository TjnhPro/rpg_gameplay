import * as g from '@rpg/gameplay';
// Strict installed composition. Values are supplied by L4; no source aliases.
export function decide(state:g.ActorAIState,entities:g.EntityCollection,life:g.EntityLifeState,
 profile:g.ActorAIBehaviorPolicy,perception:g.ActorAIPerceptionSnapshot,
 perceptionPolicy:g.ActorAIPerceptionPolicy,targetPolicy:g.ActorAITargetSelectionPolicy,
 actions:g.ActorAIActionSelectionPolicy,timing:g.ActorAIDecisionTimingState,context:g.GameplayExecutionContext){
 const gate=g.evaluateActorAILifeGate(state,entities,life);
 if(gate.status!=='allowed')return gate;
 const due=g.evaluateActorAIDecisionTiming(state,entities,life,timing,{intervalMs:500},context);
 if(due.status!=='ready')return due;
 const view=g.evaluateActorAIPerception(state,entities,perception,perceptionPolicy);
 const target=g.evaluateActorAITargetSelection(state,entities,view,targetPolicy);
 if(target.state===null)return target;
 const transition=g.evaluateActorAIBehaviorTransition(target.state,entities,g.createActorAIBehaviorObservation(target.state,['target_acquired']),profile);
 if(transition.state===null)return transition;
 const decision=g.createActorAIDecisionContext(transition.state,'D');
 const selected=g.evaluateActorAIActionSelection(transition.state,entities,decision,actions,g.createActorAIActionObservation(decision,[{actionKey:'attack',status:'available',reasonId:null}]));
 if(selected.status==='selected' && selected.decision.intent!==null){
  const feedback:g.ActorAIActionExecutionFeedback={...selected.decision.intent,attemptId:'A',phase:'execution',status:'completed',reasonId:null};
  g.validateActorAIActionExecutionFeedback(selected,feedback);
  // @ts-expect-error Completed requires execution provenance, never admission.
  const invalid:g.ActorAIActionExecutionFeedback={...feedback,phase:'admission'};void invalid;
  // @ts-expect-error Immutable candidate timing.
  due.state.nextEligibleAtMs=0;
 }
 return selected;
}
// @ts-expect-error Root-only public package.
import {} from '@rpg/gameplay/dist/modules/actor-ai/index.js';
