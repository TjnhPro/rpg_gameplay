import {createSkillDefinition, createSkillInstance, createEntity,
  type SkillDefinition, type SkillInstanceInitialState, type SkillInstanceState, type EntitySnapshot} from '@rpg/gameplay';

const definition: SkillDefinition = createSkillDefinition({skillId: 'fireball'});
const initial: SkillInstanceInitialState = {instanceId: 'instance-a'};
const entity: EntitySnapshot = createEntity({id: 'player-1', kind: 'player'});
const instance: SkillInstanceState = createSkillInstance(definition, entity, initial);
const definitionFactory: (input: SkillDefinition) => SkillDefinition = createSkillDefinition;
const instanceFactory: (definition: SkillDefinition, entity: EntitySnapshot,
  initial: SkillInstanceInitialState) => SkillInstanceState = createSkillInstance;
const ids: readonly string[] = [definition.skillId, instance.instanceId, instance.skillId, instance.entityId];
type IsAny<T> = 0 extends (1 & T) ? true : false;
const noAny: [IsAny<typeof createSkillDefinition>, IsAny<typeof createSkillInstance>,
  IsAny<typeof definition>, IsAny<typeof instance>, IsAny<typeof instance.instanceId>,
  IsAny<typeof instance.skillId>, IsAny<typeof instance.entityId>] = [false, false, false, false, false, false, false];
// @ts-expect-error Definition identity is readonly.
definition.skillId = 'other';
// @ts-expect-error Initial identity is readonly.
initial.instanceId = 'other';
// @ts-expect-error Instance identity is readonly.
instance.instanceId = 'other';
// @ts-expect-error Skill reference is readonly.
instance.skillId = 'other';
// @ts-expect-error Entity reference is readonly.
instance.entityId = 'other';
// @ts-expect-error Definition ID is required.
createSkillDefinition({});
// @ts-expect-error Skill IDs are strings.
createSkillDefinition({skillId: 1});
// @ts-expect-error Rich game content is not L2 identity data.
createSkillDefinition({skillId: 'fireball', name: 'Fireball'});
// @ts-expect-error Instance ID is required; no generator fallback.
createSkillInstance(definition, entity, {});
// @ts-expect-error All three factory arguments are required.
createSkillInstance(definition, entity);
// @ts-expect-error Instance IDs are strings.
createSkillInstance(definition, entity, {instanceId: 1});
// @ts-expect-error Entity is a canonical id/kind snapshot, not a bare ID.
createSkillInstance(definition, 'player-1', initial);
// @ts-expect-error Entity ID comes only from Entity, never an independent initial field.
createSkillInstance(definition, entity, {instanceId: 'a', entityId: 'other'});
// @ts-expect-error Progression owns rank; no duplicated state.
instance.rank;
// @ts-expect-error No availability/activation state is implied.
instance.activated;
// @ts-expect-error No cooldown placeholder.
createSkillInstance(definition, entity, {instanceId: 'a', cooldown: 0});
// @ts-expect-error Private Skill declarations are not exported.
import {createSkillInstance as deep} from '@rpg/gameplay/modules/skill';
// @ts-expect-error No separate Skill package subpath.
import {createSkillDefinition as subpath} from '@rpg/gameplay/skill';
void definitionFactory; void instanceFactory; void ids; void noAny; void deep; void subpath;
