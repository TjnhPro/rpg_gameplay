import {createSkillLoadoutState, validateSkillLoadoutState, assignSkillLoadoutSlot,
  replaceSkillLoadoutSlot, removeSkillLoadoutSlot, createEntity, createSkillDefinition, createSkillInstance,
  type EntitySnapshot, type SkillInstanceState, type SkillLoadoutLayout, type SkillLoadoutSlot,
  type SkillLoadoutState, type SkillSlotAssignmentPolicy, type SkillSlotRemovalPolicy,
  type SkillLoadoutMutationOperation, type SkillLoadoutMutationReason, type SkillLoadoutMutationResult} from '@rpg/gameplay';

const entity = createEntity({id: 'player', kind: 'player'});
const instance = createSkillInstance(createSkillDefinition({skillId: 'fire'}), entity, {instanceId: 'instance'});
const layout: SkillLoadoutLayout = {loadoutId: 'primary', slotIds: ['slot']};
const policy: SkillSlotAssignmentPolicy = {eligible: true, allowDuplicateInstance: false};
const removal: SkillSlotRemovalPolicy = {eligible: true};
const factory: (entity: EntitySnapshot, layout: SkillLoadoutLayout) => SkillLoadoutState = createSkillLoadoutState;
const validator: (state: SkillLoadoutState) => SkillLoadoutState = validateSkillLoadoutState;
const assign: (state: SkillLoadoutState, slotId: string, instance: SkillInstanceState,
  policy: SkillSlotAssignmentPolicy) => SkillLoadoutMutationResult = assignSkillLoadoutSlot;
const replace: typeof assign = replaceSkillLoadoutSlot;
const remove: (state: SkillLoadoutState, slotId: string, policy: SkillSlotRemovalPolicy) => SkillLoadoutMutationResult = removeSkillLoadoutSlot;
const state = validator(factory(entity, layout));
const slot: SkillLoadoutSlot = state.slots[0]!;
const result = assign(state, 'slot', instance, policy);
const operation: SkillLoadoutMutationOperation = result.operation;
const reason: SkillLoadoutMutationReason = result.reason;
const before: string | null = result.beforeInstanceId;
if (result.status === 'applied') {
  const none: 'none' = result.reason;
  const candidate: SkillLoadoutState = result.state;
  const after: string | null = result.afterInstanceId;
  replace(candidate, 'slot', instance, policy); remove(candidate, 'slot', removal);
  // @ts-expect-error Deep readonly slot references.
  candidate.slots[0]!.instanceId = 'changed';
  void [none, after];
} else {
  const rejected: Exclude<SkillLoadoutMutationReason, 'none'> = result.reason;
  const noCandidate: null = result.state;
  const noAfter: null = result.afterInstanceId;
  void [rejected, noCandidate, noAfter];
}
type IsAny<T> = 0 extends (1 & T) ? true : false;
const noAny: [IsAny<typeof state>, IsAny<typeof result>, IsAny<typeof factory>, IsAny<typeof validator>,
  IsAny<typeof assign>, IsAny<typeof replace>, IsAny<typeof remove>] = [false, false, false, false, false, false, false];
// @ts-expect-error Required explicit duplicate policy.
assign(state, 'slot', instance, {eligible: true});
// @ts-expect-error Removal does not take assignment metadata.
remove(state, 'slot', {eligible: true, allowDuplicateInstance: true});
// @ts-expect-error Layout has no implicit slot count.
factory(entity, {loadoutId: 'primary'});
// @ts-expect-error Slots contain references, not embedded Skill Instances.
const invalidSlot: SkillLoadoutSlot = {slotId: 'slot', instanceId: instance};
// @ts-expect-error Ordered readonly slots.
state.slots.push(slot);
// @ts-expect-error Policy readonly.
policy.allowDuplicateInstance = true;
// @ts-expect-error Removal policy readonly.
removal.eligible = false;
// @ts-expect-error Layout readonly.
layout.slotIds = [];
// @ts-expect-error Result readonly.
result.afterInstanceId = null;
// @ts-expect-error No activation outcome vocabulary.
const invalidReason: SkillLoadoutMutationReason = 'cooldown_active';
// @ts-expect-error No swap operation.
const invalidOperation: SkillLoadoutMutationOperation = 'swap';
// @ts-expect-error No active-loadout metadata.
const invalidState: SkillLoadoutState = {...state, active: true};
// @ts-expect-error Root-only exports.
import {} from '@rpg/gameplay/modules/skill';
void [operation, reason, before, noAny, invalidSlot, invalidReason, invalidOperation, invalidState];
