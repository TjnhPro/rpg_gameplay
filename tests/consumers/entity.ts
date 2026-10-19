import {createEntity, type EntityDefinition, type EntitySnapshot} from '@rpg/gameplay';
const input: EntityDefinition = {id: 'Actor / 1', kind: 'caller-kind'};
const entity: EntitySnapshot = createEntity(input);
const id: string = entity.id;
const kind: string = entity.kind;
// @ts-expect-error Identity is required.
createEntity({kind: 'npc'});
// @ts-expect-error Kind is required.
createEntity({id: 'actor'});
// @ts-expect-error No numeric ID coercion.
createEntity({id: 1, kind: 'npc'});
// @ts-expect-error Kind is a string, not built-in enum or numeric tag.
createEntity({id: 'actor', kind: 1});
// @ts-expect-error This milestone has no arbitrary state fields.
createEntity({id: 'actor', kind: 'npc', hp: 100});
// @ts-expect-error Snapshot is readonly.
entity.id = 'other';
// @ts-expect-error Snapshot classification is readonly.
entity.kind = 'other';
// @ts-expect-error Definition contract is readonly.
input.id = 'other';
// @ts-expect-error No premature gameplay state.
entity.stats;
void id; void kind;
