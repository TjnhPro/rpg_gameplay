import {
  createEntity, createEntityAttributeState, calculateEntityStats, createEntityResourceState,
  normalizeEntityResource, transitionEntityResource, regenerateEntityResource,
  createEntityLifeState, resolveEntityDefeat, reviveEntity,
  type EntityStatConfiguration, type EntityLifeResourcePolicy,
} from '@rpg/gameplay';

const actor = createEntity({id: 'player-1', kind: 'player'});
const attributes = createEntityAttributeState(actor, {strength: 10});
const configuration: EntityStatConfiguration = {
  attributeOrder: ['strength'], statOrder: ['max-life'],
  attributeRules: {strength: {default: 0, bounds: {}, enabled: true}}, attributeBaselines: {strength: 0},
  baseStats: {'max-life': 5}, rules: {'max-life': {default: 5, bounds: {}, enabled: true,
    scaling: [{attribute: 'strength', coefficient: 2, enabled: true}], training: 0}},
  flatContributions: {}, modifiers: [],
};
const stats = calculateEntityStats(attributes, configuration);
const policy: EntityLifeResourcePolicy = {resourceId: 'health', minimum: 0, maximum: stats.stats['max-life']!};
const initial = createEntityResourceState(actor, {health: {minimum: 0, maximum: policy.maximum, current: 20}});
const normalized = normalizeEntityResource(initial, 'health', {minimum: policy.minimum, maximum: policy.maximum});
const depleted = transitionEntityResource(normalized.state, 'health', {operation: 'decrease', amount: 20,
  maximum: policy.maximum, rule: {minimum: 0, currentAboveMaximum: 'reject', allowIncreaseFromMinimum: true}});
const defeated = resolveEntityDefeat(createEntityLifeState(actor, {status: 'alive'}), depleted.state, policy);
const recovered = regenerateEntityResource(depleted.state, 'health', {minimum: 0, maximum: policy.maximum,
  ratePerSecond: 5, elapsedSeconds: 2, eligible: true, precision: {decimalPlaces: 2}});
const revived = reviveEntity(defeated.state, recovered.state, policy);
const id: string = revived.state.entityId;
// @ts-expect-error No inferred synchronization or resource mutator on life snapshots.
revived.state.current = recovered.state.current;
// @ts-expect-error Earlier numerical snapshot is immutable.
stats.stats['max-life'] = 100;
// @ts-expect-error Diagnostics are immutable across module boundaries.
recovered.transition.applied = 100;
void id;
