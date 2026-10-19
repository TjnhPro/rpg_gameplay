import {
  createEntity, createProgressionState, evaluateLevelAdvancement, advanceProgressionLevel,
  type ExperienceMode, type LevelRequirement, type LevelAdvancementPolicy,
  type LevelAdvancementBlockReason, type LevelAdvancementAssessment, type LevelAdvancementResult,
  type ProgressionState,
} from '@rpg/gameplay';
const mode: ExperienceMode = 'level-local';
const step: LevelRequirement = {toLevel: 2, requiredExperience: 1.25, eligible: true};
const policy: LevelAdvancementPolicy = {experienceMode: mode, maxLevel: 100, targetLevel: 2, requirements: [step]};
const state: ProgressionState = createProgressionState(createEntity({id: 'x', kind: 'custom'}), {level: 1, experience: 2});
const assessment: LevelAdvancementAssessment = evaluateLevelAdvancement(state, policy);
const result: LevelAdvancementResult = advanceProgressionLevel(state, policy);
const reason: LevelAdvancementBlockReason = result.transition.reason;
const blocked: number | undefined = assessment.blockedAtLevel;
const advanced: readonly number[] = result.transition.advancedLevels;
// @ts-expect-error Mode is required.
advanceProgressionLevel(state, {maxLevel: 100, targetLevel: 2, requirements: [step]});
// @ts-expect-error No default target.
evaluateLevelAdvancement(state, {experienceMode: mode, maxLevel: 100, requirements: [step]});
// @ts-expect-error Closed policy, no rewards.
advanceProgressionLevel(state, {...policy, attributePoints: 1});
// @ts-expect-error Explicit supported mode.
const wrongMode: ExperienceMode = 'auto';
// @ts-expect-error Eligibility must be boolean, not a callback.
const wrongStep: LevelRequirement = {toLevel: 2, requiredExperience: 1, eligible: () => true};
// @ts-expect-error Closed requirement.
const extraStep: LevelRequirement = {...step, quest: 'x'};
// @ts-expect-error Readonly requirements.
policy.requirements.push(step);
// @ts-expect-error Readonly policy.
policy.targetLevel = 3;
// @ts-expect-error Readonly requirement.
step.eligible = false;
// @ts-expect-error Readonly next state.
result.state.level = 3;
// @ts-expect-error Readonly transition.
result.transition.reason = 'none';
// @ts-expect-error Readonly list.
result.transition.advancedLevels.push(3);
// @ts-expect-error Readonly result.
result.state = state;
// @ts-expect-error No stored mode or cap.
result.state.experienceMode;
// @ts-expect-error Root-only package.
import {advanceProgressionLevel as deep} from '@rpg/gameplay/modules/progression';
void reason; void blocked; void advanced; void wrongMode; void wrongStep; void extraStep; void deep;
