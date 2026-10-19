import {
  createEntityCollection, addEntity, getEntity, hasEntity, listEntities, removeEntity, replaceEntity,
  type EntityCollection, type EntitySnapshot,
} from '@rpg/gameplay';
const empty: EntityCollection = createEntityCollection();
const base = addEntity(empty, {id: 'actor', kind: 'npc'});
const found: EntitySnapshot | undefined = getEntity(base, 'actor');
const exists: boolean = hasEntity(base, 'actor');
const list: readonly EntitySnapshot[] = listEntities(base);
const next: EntityCollection = replaceEntity(base, {id: 'actor', kind: 'companion'});
const removed: EntityCollection = removeEntity(base, 'actor');
// @ts-expect-error Collection membership is readonly.
base.entities = [];
// @ts-expect-error Backing membership is readonly.
base.entities.push({id: 'other', kind: 'npc'});
// @ts-expect-error Enumeration is readonly.
list.pop();
if (found) {
  // @ts-expect-error Lookup snapshot is readonly.
  found.kind = 'other';
}
// @ts-expect-error No unknown-ID guarantee for get.
const definite: EntitySnapshot = getEntity(base, 'unknown');
// @ts-expect-error Lookup IDs must be strings.
hasEntity(base, 1);
// @ts-expect-error Replacement is a full snapshot.
replaceEntity(base, {id: 'actor'});
// @ts-expect-error No generic state bag.
addEntity(base, {id: 'actor', kind: 'npc', state: {hp: 1}});
// @ts-expect-error No premature numerical state.
base.entities[0]!.resources;
void exists; void next; void removed; void definite;
