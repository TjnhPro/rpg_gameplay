import * as g from '@rpg/gameplay';
const actor = g.createEntity({id: 'player-1', kind: 'player'});
const definition: g.SkillDefinition = g.createSkillDefinition({skillId: 'fireball'});
const instance: g.SkillInstanceState = g.createSkillInstance(definition, actor, {instanceId: 'instance-001'});
const ranks = g.createSkillRankState(actor, {fireball: 3});
const loadout = g.assignSkillLoadoutSlot(g.createSkillLoadoutState(actor,
  {loadoutId: 'primary', slotIds: ['slot-1']}), 'slot-1', instance, {eligible: true, allowDuplicateInstance: false});
const collection = g.addEntity(g.createEntityCollection(), actor);
const life = g.createEntityLifeState(actor, {status: 'alive'});
const admission = g.evaluateSkillActivationAdmission(definition, instance, actor.id, collection, life,
  {owned: true, eligible: true, rank: {mode: 'required', currentRank: g.getSkillRank(ranks, 'fireball') ?? null, minimumRank: 2}});
let resources: g.EntityResourceState = g.createEntityResourceState(actor, {mana: {minimum: 0, maximum: 100}});
let cooldown: g.SkillCooldownState = g.createSkillCooldownState(instance);
const execution = g.createExecutionContext({clock: {now: () => 1000}, random: {next: () => .2}});
const intent: g.SkillExecutionIntent = {attemptId: 'attempt-001', dispatch: {kind: 'combat', actionId: 'action-001',
  actionType: 'spell_attack', targetEntityId: 'monster-1'}};
const input: g.SkillActivationInput = {instance, admission, resourceState: resources,
  resourceCosts: {costs: [{resourceId: 'mana', amount: 25}], bounds: [{resourceId: 'mana', minimum: 0, maximum: 100, currentAboveMaximum: 'reject'}]},
  cooldownState: cooldown, cooldownConfig: {baseDurationMs: 1000, effectiveCdr: .25}, executionContext: execution,
  intent, executionPreflight: {kind: 'combat', status: 'accepted'}};
const result: g.SkillActivationResult = g.activateSkill(input);
declare const targetResources: g.EntityResourceState, targetLife: g.EntityLifeState, numerical: g.CombatAttackInput;
if (result.status === 'accepted') {
  resources = result.resources; cooldown = result.cooldown;
  const request: g.SkillExecutionRequest = result.request;
  if (request.dispatch.kind === 'combat') {
    const context = g.createCombatActionContext({actionId: request.dispatch.actionId, actionType: request.dispatch.actionType,
      sourceEntityId: request.actorEntityId, target: {kind: 'entity', entityId: request.dispatch.targetEntityId}});
    const combatAdmission = g.evaluateCombatActionAdmission(context, collection, life, {eligible: true});
    const validation = g.evaluateCombatTargetValidation(combatAdmission, collection, targetLife,
      {relation: 'enemy', allowedRelations: ['enemy'], allowedLifeStatuses: ['alive']});
    const attack = g.resolveCombatAttack(combatAdmission, validation, numerical, execution);
    const application = g.applyCombatAttackDamage(attack, targetResources, targetLife,
      {resourceId: 'health', minimum: 0, maximum: 100, currentAboveMaximum: 'allow'});
    const outcome: g.SkillExecutionOutcome = g.reportSkillExecutionOutcome(request, {status: 'completed'});
    // @ts-expect-error Immutable outcome.
    outcome.status = 'failed';
    void application;
  }
  // @ts-expect-error Immutable request/dispatch.
  request.actorEntityId = 'other';
  // @ts-expect-error Entity owns readonly resource snapshot.
  resources.current.mana = 0;
} else {
  const noRequest: null = result.request, noResources: null = result.resources, noCooldown: null = result.cooldown;
  void [noRequest, noResources, noCooldown];
}
if (loadout.status === 'applied') {
  const reference: string | null = loadout.state.slots[0]!.instanceId;
  // @ts-expect-error Reference is not a canonical Skill Instance or authorization.
  g.activateSkill({...input, instance: reference});
}
// @ts-expect-error No integration runtime/facade.
g.executeSkill(input);
// @ts-expect-error No direct mutable rank alias in Skill Instance.
instance.rank = 3;
// @ts-expect-error No implicit transaction/commit flag.
g.activateSkill({...input, commit: true});
// @ts-expect-error Only root exports are public.
import {} from '@rpg/gameplay/modules/skill';
type IsAny<T> = 0 extends (1 & T) ? true : false;
const noAny: [IsAny<typeof input>, IsAny<typeof result>, IsAny<typeof loadout>] = [false, false, false];
void [cooldown, noAny];
