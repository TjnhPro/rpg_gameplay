import {
  createEntity, createEntityResourceState, getEntityResourceCurrent, normalizeEntityResource,
  transitionEntityResource, regenerateEntityResource,
  type EntityResourceState, type EntityResourceDefinition, type EntityResourceBounds,
  type EntityResourceTransitionInput, type EntityResourceRegenerationInput,
  type EntityResourceNormalizationResult, type EntityResourceTransitionResult,
} from '@rpg/gameplay';
import type {ResourceNormalizationInput, ResourceNormalizationResult, ResourceTransitionInput,
  ResourceTransitionResult, ResourceRegenerationInput} from '@rpg/core/kernel';

const definition: EntityResourceDefinition = {minimum: 0, maximum: 100};
const state: EntityResourceState = createEntityResourceState(createEntity({id: 'actor', kind: 'any'}), {energy: definition});
const current: number | undefined = getEntityResourceCurrent(state, 'energy');
const bounds: EntityResourceBounds = {minimum: 0, maximum: 80};
const normalized: EntityResourceNormalizationResult = normalizeEntityResource(state, 'energy', bounds);
const options: EntityResourceTransitionInput = {operation: 'decrease', amount: 25, maximum: 100,
  rule: {minimum: 0, currentAboveMaximum: 'allow', allowIncreaseFromMinimum: true}};
const transitioned: EntityResourceTransitionResult = transitionEntityResource(state, 'energy', options);
const regen: EntityResourceRegenerationInput = {minimum: 0, maximum: 100, ratePerSecond: 2.5,
  elapsedSeconds: 2, eligible: true, precision: {decimalPlaces: 2}};
const regenerated: EntityResourceTransitionResult = regenerateEntityResource(state, 'energy', regen);
const kernelNormalization: ResourceNormalizationInput = {resource: 'energy', ...definition};
const kernelTransition: ResourceTransitionInput = {resource: 'energy', current: 30, ...options};
const kernelRegen: ResourceRegenerationInput = {resource: 'energy', current: 30, ...regen};
const normalizationResult: ResourceNormalizationResult = normalized.calculation;
const transitionResult: ResourceTransitionResult = transitioned.transition;
// @ts-expect-error Immutable association.
state.entityId = 'other';
// @ts-expect-error Current map is readonly.
state.current.energy = 1;
// @ts-expect-error Current map cannot be replaced.
state.current = {};
// @ts-expect-error Diagnostics are readonly.
normalized.calculation.initialized = true;
// @ts-expect-error Diagnostics are readonly.
transitioned.transition.applied = 1;
// @ts-expect-error State/result envelope is readonly.
regenerated.state = state;
// @ts-expect-error Bounds cannot override stored current.
normalizeEntityResource(state, 'energy', {...bounds, current: 0});
// @ts-expect-error No implicit amount/policy defaults.
transitionEntityResource(state, 'energy', {operation: 'increase', maximum: 100});
// @ts-expect-error No hidden precision/time provider.
regenerateEntityResource(state, 'energy', {minimum: 0, maximum: 100, ratePerSecond: 1, eligible: true});
// @ts-expect-error Unsupported gameplay operation.
const invalid: EntityResourceTransitionInput = {...options, operation: 'heal'};
// @ts-expect-error Entity remains closed id/kind.
createEntity({id: 'actor', kind: 'any', current: {energy: 1}});
// @ts-expect-error No implicit life state.
transitioned.state.dead;
void current; void kernelNormalization; void kernelTransition; void kernelRegen;
void normalizationResult; void transitionResult; void invalid;
