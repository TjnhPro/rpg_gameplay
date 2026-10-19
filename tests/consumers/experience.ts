import {
  createEntity, createProgressionState, gainExperience, adjustExperience,
  type ExperienceAdjustment, type ExperienceTransition, type ExperienceTransitionResult,
  type ProgressionState,
} from '@rpg/gameplay';
const state: ProgressionState = createProgressionState(createEntity({id: 'x', kind: 'custom'}), {level: 10, experience: 1.25});
const input: ExperienceAdjustment = {delta: -0.25, maximumExperience: 10};
const result: ExperienceTransitionResult = adjustExperience(state, input);
const transition: ExperienceTransition = result.transition;
const gain: ExperienceTransitionResult = gainExperience(state, 2.5, {maximumExperience: 5});
const read: number = gain.state.experience;
const limited: boolean = transition.limited;
// @ts-expect-error Readonly input.
input.delta = 1;
// @ts-expect-error Readonly next state.
result.state.experience = 1;
// @ts-expect-error Readonly diagnostic.
transition.appliedDelta = 1;
// @ts-expect-error Readonly result.
result.state = state;
// @ts-expect-error Explicit numeric gain.
gainExperience(state, '1');
// @ts-expect-error No default delta.
adjustExperience(state, {});
// @ts-expect-error Closed operation shape.
adjustExperience(state, {delta: 1, skillPoints: 2});
// @ts-expect-error Gain policy does not accept a second delta.
gainExperience(state, 1, {delta: 2});
// @ts-expect-error No state authority, cap or level transition fields.
result.state.maximumExperience;
// @ts-expect-error Only root is exported.
import {gainExperience as deep} from '@rpg/gameplay/modules/progression';
void read; void limited; void deep;
