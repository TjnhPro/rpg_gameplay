import {
  createEntity, createEntityAttributeState, getEntityBaseAttributes,
  setEntityBaseAttribute, calculateEntityStats,
  type EntityAttributeState, type EntityStatConfiguration, type EntityStatSnapshot,
} from '@rpg/gameplay';
import type {NumericRule, DerivedStatRule, NumericalModifier, PreparedStatCalculationInput} from '@rpg/core/kernel';

const numeric: NumericRule = {default: 0, enabled: true, bounds: {}};
const derived: DerivedStatRule = {...numeric, scaling: [{attribute: 'force', coefficient: 2, enabled: true}], training: 0};
const modifiers: readonly NumericalModifier[] = [];
const configuration: EntityStatConfiguration = {
  attributeOrder: ['force'], statOrder: ['output'], attributeRules: {force: numeric},
  attributeBaselines: {force: 0}, baseStats: {}, rules: {output: derived}, flatContributions: {}, modifiers,
};
const state: EntityAttributeState = createEntityAttributeState(createEntity({id: 'actor', kind: 'any'}), {force: 1.5});
const bases: Readonly<Record<string, number>> = getEntityBaseAttributes(state);
const next: EntityAttributeState = setEntityBaseAttribute(state, 'force', -2);
const result: EntityStatSnapshot = calculateEntityStats(next, configuration);
const kernelInput: PreparedStatCalculationInput = {...configuration, attributeBases: bases};
// @ts-expect-error Identity is immutable.
state.entityId = 'other';
// @ts-expect-error Base values are readonly.
bases.force = 2;
// @ts-expect-error State cannot replace base map.
state.baseAttributes = {};
// @ts-expect-error Effective attributes are readonly.
result.effectiveAttributes.force = 0;
// @ts-expect-error Derived stats are readonly.
result.stats.output = 0;
// @ts-expect-error Snapshot identity is readonly.
result.entityId = 'other';
// @ts-expect-error Snapshot contains no diagnostics/mutable modifier references.
result.details;
// @ts-expect-error Caller must provide modifier inputs, including empty list.
const incomplete: EntityStatConfiguration = {attributeOrder: [], statOrder: []};
// @ts-expect-error Attribute state remains separate from closed Entity definition.
createEntity({id: 'actor', kind: 'npc', baseAttributes: {force: 1}});
// @ts-expect-error No coercion of attribute values.
setEntityBaseAttribute(state, 'force', '2');
// @ts-expect-error No caller attributeBases override in calculation configuration.
const override: EntityStatConfiguration = {...configuration, attributeBases: {force: 999}};
void result; void kernelInput; void incomplete; void override;
