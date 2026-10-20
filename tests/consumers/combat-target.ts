import {evaluateCombatTargetValidation, evaluateCombatActionAdmission, createCombatActionContext,
  createEntityCollection, type CombatTargetRelation, type CombatTargetPolicy,
  type CombatTargetValidationStatus, type CombatTargetRejectionReason,
  type CombatTargetValidationResult, type EntityLifeStatus} from '@rpg/gameplay';

const collection = createEntityCollection();
const context = createCombatActionContext({actionId: 'id', actionType: 'custom', sourceEntityId: 'a',
  target: {kind: 'entity', entityId: 'b'}});
const receipt = evaluateCombatActionAdmission(context, collection, {entityId: 'a', status: 'alive'}, {eligible: true});
const life = {entityId: 'b', status: 'alive' as const};
const policy: CombatTargetPolicy = {relation: 'enemy', allowedRelations: ['self', 'ally', 'enemy', 'neutral'],
  allowedLifeStatuses: ['alive', 'dead']};
const result: CombatTargetValidationResult = evaluateCombatTargetValidation(receipt, collection, life, policy);
const relations: CombatTargetRelation[] = ['self', 'ally', 'enemy', 'neutral'];
const statuses: CombatTargetValidationStatus[] = ['accepted', 'rejected'];
const reasons: CombatTargetRejectionReason[] = ['none', 'target_not_found', 'relation_not_allowed', 'target_life_not_allowed'];
const canonicalLife: EntityLifeStatus = result.targetLifeStatus;
type IsAny<T> = 0 extends (1 & T) ? true : false;
const noAny: [IsAny<typeof evaluateCombatTargetValidation>, IsAny<typeof result>,
  IsAny<typeof result.context>, IsAny<typeof result.relation>, IsAny<typeof result.targetLifeStatus>,
  IsAny<typeof policy.allowedRelations[number]>] = [false, false, false, false, false, false];
// @ts-expect-error Admission required, context alone is insufficient.
evaluateCombatTargetValidation(context, collection, life, policy);
// @ts-expect-error Target Life is mandatory.
evaluateCombatTargetValidation(receipt, collection, undefined, policy);
// @ts-expect-error No implicit policy.
evaluateCombatTargetValidation(receipt, collection, life);
// @ts-expect-error Unknown relation.
const badRelation: CombatTargetRelation = 'unknown';
// @ts-expect-error Target stage cannot return admitted.
const badStatus: CombatTargetValidationStatus = 'admitted';
// @ts-expect-error Actor reason is not target reason.
const badReason: CombatTargetRejectionReason = 'source_dead';
// @ts-expect-error Exact canonical life literals.
evaluateCombatTargetValidation(receipt, collection, {entityId: 'b', status: 'living'}, policy);
// @ts-expect-error No callback policy.
evaluateCombatTargetValidation(receipt, collection, life, () => policy);
// @ts-expect-error No mutable policy array.
policy.allowedRelations.push('self');
// @ts-expect-error No mutable life policy array.
policy.allowedLifeStatuses[0] = 'dead';
// @ts-expect-error Policy readonly.
policy.relation = 'self';
// @ts-expect-error Result readonly.
result.targetEntityId = 'other';
// @ts-expect-error Result readonly.
result.status = 'rejected';
// @ts-expect-error Result readonly.
result.reason = 'target_not_found';
// @ts-expect-error Result readonly.
result.relation = 'self';
// @ts-expect-error Result readonly.
result.targetLifeStatus = 'dead';
// @ts-expect-error Context readonly.
result.context = context;
// @ts-expect-error Nested target readonly.
result.context.target.entityId = 'other';
// @ts-expect-error Not an execution receipt.
result.executed;
// @ts-expect-error Root-only exports.
import {evaluateCombatTargetValidation as deep} from '@rpg/gameplay/modules/combat';
void relations; void statuses; void reasons; void canonicalLife; void noAny;
void badRelation; void badStatus; void badReason; void deep;
