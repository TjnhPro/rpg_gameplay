import {createEffectStatusState, applyEffectStatusTransition, listActiveEffectStatuses,
  listActiveEffectRestrictions, evaluateEffectRestrictionGate,
  type EffectStatusCapture, type EffectStatusSnapshot, type EffectStatusState,
  type EffectStatusView, type EffectRestrictionView, type EffectRestrictionPolicy,
  type EffectRestrictionAssessment, type EffectStatusTransitionResult,
  type EffectLifecycleState, type EffectLifecycleStartResult, type EffectLifecycleTransitionResult,
  type EffectStackMutationResult, type SkillAdmissionPolicy, type CombatActorEligibilityPolicy,
  type EffectApplyPolicy} from '@rpg/gameplay';

declare const lifecycle: EffectLifecycleState, start: EffectLifecycleStartResult,
  advance: EffectLifecycleTransitionResult, stack: EffectStackMutationResult;
const capture: EffectStatusCapture = {statusIds: ['custom'], restrictionIds: ['custom-block']};
const snapshot: EffectStatusSnapshot = {effectInstanceId: 'A', ...capture};
const state: EffectStatusState = createEffectStatusState(lifecycle);
const sync: (current: EffectStatusState, previous: EffectLifecycleState,
  transition: EffectLifecycleStartResult | EffectLifecycleTransitionResult | EffectStackMutationResult,
  payload?: EffectStatusCapture) => EffectStatusTransitionResult = applyEffectStatusTransition;
const result = sync(state, lifecycle, start, capture);
sync(state, lifecycle, advance); sync(state, lifecycle, stack);
if (result.status === 'applied') {
  const reason: 'none' = result.reason;
  const statuses: readonly EffectStatusView[] = listActiveEffectStatuses(lifecycle, result.state);
  const restrictions: readonly EffectRestrictionView[] = listActiveEffectRestrictions(lifecycle, result.state);
  const policy: EffectRestrictionPolicy = {blockedByRestrictionIds: ['custom-block']};
  const assessment: EffectRestrictionAssessment = evaluateEffectRestrictionGate(lifecycle, result.state, policy);
  const decision: 'allowed' | 'blocked' = assessment.status;
  const why: 'none' | 'active_restriction' = assessment.reason;
  const skill: SkillAdmissionPolicy = {owned: true, eligible: assessment.status === 'allowed', rank: {mode: 'not_required'}};
  const combat: CombatActorEligibilityPolicy = {eligible: assessment.status === 'allowed'};
  const effect: EffectApplyPolicy = {sourceEligible: true, targetEligible: assessment.status === 'allowed', allowedTargetLifeStatuses: ['alive']};
  // @ts-expect-error Readonly nested payloads.
  result.state.snapshots[0]!.statusIds.push('changed');
  // @ts-expect-error Readonly snapshot binding.
  snapshot.effectInstanceId = 'B';
  // @ts-expect-error Readonly provenance.
  statuses[0]!.effectInstanceIds.push('B');
  // @ts-expect-error Readonly restriction projection.
  restrictions[0]!.effectId = 'changed';
  // @ts-expect-error Readonly assessment.
  assessment.matches.push(restrictions[0]!);
  void reason; void decision; void why; void skill; void combat; void effect;
} else {
  const empty: null = result.state;
  const reason: 'transition_rejected' | 'stale_transition' | 'capture_required' = result.reason;
  void empty; void reason;
}
// @ts-expect-error Both explicit arrays required.
const incomplete: EffectStatusCapture = {statusIds: []};
// @ts-expect-error Companion stores no duplicated lifecycle.
const duplicateOwner: EffectStatusState = {lifecycle, snapshots: []};
// @ts-expect-error Snapshot contains no duplicated effect identity/content.
const duplicated: EffectStatusSnapshot = {...snapshot, effectId: 'silence'};
// @ts-expect-error IDs are strings.
const numeric: EffectRestrictionPolicy = {blockedByRestrictionIds: [1]};
// @ts-expect-error Separate previous canonical lifecycle is mandatory.
applyEffectStatusTransition(state, start, capture);
// @ts-expect-error No private delta validator exported.
import {companionTransition} from '@rpg/gameplay';
// @ts-expect-error No deep exports.
import {} from '@rpg/gameplay/dist/modules/effect/index.js';
void incomplete; void duplicateOwner; void duplicated; void numeric; void companionTransition;
