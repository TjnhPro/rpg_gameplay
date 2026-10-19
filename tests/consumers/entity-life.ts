import {
  createEntity, createEntityLifeState, createEntityResourceState, resolveEntityDefeat, reviveEntity,
  type EntityLifeStatus, type EntityLifeState, type EntityLifeResourcePolicy,
  type EntityLifeTransitionOutcome, type EntityLifeTransitionResult, type EntityResourceBounds,
} from '@rpg/gameplay';

const entity = createEntity({id: 'actor', kind: 'caller-kind'});
const status: EntityLifeStatus = 'dead';
const state: EntityLifeState = createEntityLifeState(entity, {status});
const bounds: EntityResourceBounds = {minimum: -5, maximum: 100};
const policy: EntityLifeResourcePolicy = {resourceId: 'vitality', ...bounds};
const resources = createEntityResourceState(entity, {vitality: {...bounds, current: 20}});
const defeated: EntityLifeTransitionResult = resolveEntityDefeat(state, resources, policy);
const revived: EntityLifeTransitionResult = reviveEntity(defeated.state, resources, policy);
const outcome: EntityLifeTransitionOutcome = revived.outcome;
const after: EntityLifeStatus = revived.after;
// @ts-expect-error Closed life status union.
const invalid: EntityLifeStatus = 'respawning';
// @ts-expect-error Explicit status required.
createEntityLifeState(entity, {});
// @ts-expect-error Closed initialization boundary.
createEntityLifeState(entity, {status: 'alive', health: 1});
// @ts-expect-error Immutable association.
state.entityId = 'other';
// @ts-expect-error Immutable status.
state.status = 'alive';
// @ts-expect-error Immutable policy bounds.
policy.maximum = 200;
// @ts-expect-error Immutable policy selection.
policy.resourceId = 'mana';
// @ts-expect-error Immutable diagnostics.
revived.outcome = 'unchanged';
// @ts-expect-error Immutable diagnostics.
revived.before = 'alive';
// @ts-expect-error Immutable diagnostics.
revived.after = 'dead';
// @ts-expect-error Immutable result association.
revived.entityId = 'other';
// @ts-expect-error Immutable result envelope.
revived.state = state;
// @ts-expect-error Nested state is immutable.
revived.state.status = 'dead';
// @ts-expect-error Life-only result contains no resource authority.
revived.current;
// @ts-expect-error Life policy must explicitly define bounds.
resolveEntityDefeat(state, resources, {resourceId: 'vitality'});
// @ts-expect-error Identity remains closed.
createEntity({id: 'actor', kind: 'caller-kind', status: 'alive'});
void outcome; void after; void invalid;
