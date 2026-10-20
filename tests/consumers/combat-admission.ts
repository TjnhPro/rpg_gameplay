import {createCombatActionContext, evaluateCombatActionAdmission, createEntityCollection,
  type EntityLifeState, type CombatActorEligibilityPolicy, type CombatAdmissionStatus,
  type CombatAdmissionReason, type CombatAdmissionResult} from '@rpg/gameplay';

const context = createCombatActionContext({actionId: 'id', actionType: 'custom',
  sourceEntityId: 'actor', target: {kind: 'entity', entityId: 'unknown'}});
const life: EntityLifeState = {entityId: 'actor', status: 'alive'};
const policy: CombatActorEligibilityPolicy = {eligible: true};
const result: CombatAdmissionResult = evaluateCombatActionAdmission(context, createEntityCollection(), life, policy);
const status: CombatAdmissionStatus = result.status;
const reason: CombatAdmissionReason = result.reason;
const statuses: CombatAdmissionStatus[] = ['admitted', 'rejected'];
const reasons: CombatAdmissionReason[] = ['none', 'source_not_found', 'source_dead', 'source_ineligible'];
type IsAny<T> = 0 extends (1 & T) ? true : false;
const noAny: [IsAny<typeof evaluateCombatActionAdmission>, IsAny<typeof result>,
  IsAny<typeof result.context>, IsAny<typeof result.status>, IsAny<typeof result.reason>] = [false, false, false, false, false];
// @ts-expect-error Policy required on every call.
evaluateCombatActionAdmission(context, createEntityCollection(), life);
// @ts-expect-error No callback eligibility.
evaluateCombatActionAdmission(context, createEntityCollection(), life, {eligible: () => true});
// @ts-expect-error No coercion.
evaluateCombatActionAdmission(context, createEntityCollection(), life, {eligible: 1});
// @ts-expect-error Missing source life, no default.
evaluateCombatActionAdmission(context, createEntityCollection(), undefined, policy);
// @ts-expect-error Exact canonical life status.
evaluateCombatActionAdmission(context, createEntityCollection(), {entityId: 'actor', status: 'living'}, policy);
// @ts-expect-error Collection required, not an array.
evaluateCombatActionAdmission(context, [], life, policy);
// @ts-expect-error Exact admission status union.
const wrongStatus: CombatAdmissionStatus = 'executed';
// @ts-expect-error No target rejection in actor stage.
const wrongReason: CombatAdmissionReason = 'target_not_found';
// @ts-expect-error Policy readonly.
policy.eligible = false;
// @ts-expect-error Result readonly.
result.status = 'rejected';
// @ts-expect-error Reason readonly.
result.reason = 'source_dead';
// @ts-expect-error Embedded context readonly.
result.context = context;
// @ts-expect-error Context nested target readonly.
result.context.target.entityId = 'changed';
// @ts-expect-error No execution receipt field.
result.executed;
// @ts-expect-error Root-only declarations.
import {evaluateCombatActionAdmission as deep} from '@rpg/gameplay/modules/combat';
void status; void reason; void statuses; void reasons; void noAny; void wrongStatus; void wrongReason; void deep;
