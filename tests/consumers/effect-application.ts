import {evaluateEffectApplyAdmission, applyEffect, createEntity, createEffectDefinition, createEffectInstance,
  createEffectState, createEntityCollection, addEntity, createEntityLifeState,
  type EffectDefinition, type EffectState, type EffectApplyRequest, type EffectApplyPolicy,
  type EffectApplyAdmissionStatus, type EffectApplyAdmissionReason, type EffectApplyAdmissionResult,
  type EffectApplyResult, type EntityCollection, type EntityLifeState} from '@rpg/gameplay';

const target = createEntity({id: 'target', kind: 'monster'});
const definition = createEffectDefinition({effectId: 'poison'});
const instance = createEffectInstance(definition, target, {effectInstanceId: 'effect-1',
  source: {kind: 'system', sourceId: 'environment', sourceKey: 'zone/area-1'}});
const request: EffectApplyRequest = {instance};
const policy: EffectApplyPolicy = {sourceEligible: true, targetEligible: true, allowedTargetLifeStatuses: ['alive', 'dead']};
const entities = addEntity(createEntityCollection(), target), life = createEntityLifeState(target, {status: 'alive'});
const args: [EffectDefinition, EffectApplyRequest, EffectState, EntityCollection, EntityLifeState, EffectApplyPolicy] =
  [definition, request, createEffectState(target), entities, life, policy];
const evaluation: EffectApplyAdmissionResult = evaluateEffectApplyAdmission(...args);
const result: EffectApplyResult = applyEffect(...args);
const signatures: [(...input: typeof args) => EffectApplyAdmissionResult, (...input: typeof args) => EffectApplyResult] =
  [evaluateEffectApplyAdmission, applyEffect];
const statuses: EffectApplyAdmissionStatus[] = ['admitted', 'rejected'];
const reasons: EffectApplyAdmissionReason[] = ['none', 'source_not_found', 'target_not_found', 'target_life_not_allowed',
  'source_ineligible', 'target_ineligible', 'instance_already_present'];
if (result.status === 'applied') {
  const next: EffectState = result.state; const reason: 'none' = result.reason;
  // @ts-expect-error Applied branch always supplies a state.
  const empty: null = result.state;
  void [next, reason, empty];
} else {
  const empty: null = result.state; const rejection: Exclude<EffectApplyAdmissionReason, 'none'> = result.reason;
  // @ts-expect-error Rejected branch exposes no partial candidate.
  const next: EffectState = result.state;
  // @ts-expect-error Rejected reason cannot be none.
  const none: 'none' = result.reason;
  void [empty, rejection, next, none];
}
// @ts-expect-error Request does not duplicate Effect identity.
const extra: EffectApplyRequest = {instance, effectId: 'poison'};
// @ts-expect-error Instance required.
const missing: EffectApplyRequest = {};
// @ts-expect-error Policy has no implicit defaults.
const implicit: EffectApplyPolicy = {sourceEligible: true, targetEligible: true};
// @ts-expect-error Explicit boolean only.
const nonboolean: EffectApplyPolicy = {...policy, sourceEligible: 'true'};
// @ts-expect-error Canonical Entity life status only.
const invalidLife: EffectApplyPolicy = {...policy, allowedTargetLifeStatuses: ['dying']};
// @ts-expect-error Admission receipt is not a replacement for context/policy.
applyEffect(definition, request, args[2], evaluation);
// @ts-expect-error Source-agnostic request still uses canonical Effect source union.
const invalidSource: EffectApplyRequest = {instance: {...instance, source: {kind: 'equipment', sourceId: 'p', sourceKey: 'item'}}};
// @ts-expect-error Request readonly.
request.instance = instance;
// @ts-expect-error Nested instance readonly.
request.instance.effectId = 'changed';
// @ts-expect-error Nested source readonly.
request.instance.source.sourceKey = 'changed';
// @ts-expect-error Policy readonly.
policy.sourceEligible = false;
// @ts-expect-error Policy statuses readonly.
policy.allowedTargetLifeStatuses.push('alive');
// @ts-expect-error Assessment readonly.
evaluation.status = 'rejected';
// @ts-expect-error Captured request readonly.
evaluation.request.instance.source.sourceId = 'changed';
// @ts-expect-error Result readonly.
result.state = null;
if (result.status === 'applied') {
  // @ts-expect-error Candidate state deeply readonly.
  result.state.instances.push(instance);
}
// @ts-expect-error Applied branch requires reason none.
const invalidApplied: EffectApplyResult = {status: 'applied', reason: 'source_ineligible', admission: evaluation, state: args[2]};
// @ts-expect-error Rejected branch requires null state.
const invalidRejected: EffectApplyResult = {status: 'rejected', reason: 'target_not_found', admission: evaluation, state: args[2]};
// @ts-expect-error No lifecycle result fields.
const expiresAt: number = result.expiresAt;
// @ts-expect-error Private helper is not a root export.
import {applyPolicySnapshot} from '@rpg/gameplay';
// @ts-expect-error Deep Effect entry remains private.
import {} from '@rpg/gameplay/modules/effect';
// @ts-expect-error No Effect engine/registry introduced.
import {EffectRegistry} from '@rpg/gameplay';
type IsAny<T> = 0 extends (1 & T) ? true : false;
const noAny: [IsAny<EffectApplyRequest>, IsAny<EffectApplyPolicy>, IsAny<EffectApplyAdmissionStatus>,
  IsAny<EffectApplyAdmissionReason>, IsAny<EffectApplyAdmissionResult>, IsAny<EffectApplyResult>] = [false, false, false, false, false, false];
void [signatures, statuses, reasons, noAny, extra, missing, implicit, nonboolean, invalidLife, invalidSource, invalidApplied, invalidRejected, expiresAt];
