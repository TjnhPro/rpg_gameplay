import {createEntity, createSkillDefinition, createSkillInstance, createExecutionContext,
  createSkillCooldownState, evaluateSkillCooldownReady, startSkillCooldown,
  type SkillInstanceState, type GameplayExecutionContext, type SkillCooldownState,
  type SkillCooldownConfiguration, type SkillCooldownStatus, type SkillCooldownReason,
  type SkillCooldownAssessment, type SkillCooldownStartResult} from '@rpg/gameplay';

const instance = createSkillInstance(createSkillDefinition({skillId: 's'}),
  createEntity({id: 'a', kind: 'player'}), {instanceId: 'i'});
const context = createExecutionContext({clock: {now: () => 1000}});
const state: SkillCooldownState = createSkillCooldownState(instance);
const config: SkillCooldownConfiguration = {baseDurationMs: 1000, effectiveCdr: .25};
const assessment: SkillCooldownAssessment = evaluateSkillCooldownReady(instance, state, context);
const result: SkillCooldownStartResult = startSkillCooldown(instance, state, context, config);
const factory: (instance: SkillInstanceState) => SkillCooldownState = createSkillCooldownState;
const readiness: (instance: SkillInstanceState, state: SkillCooldownState,
  context: GameplayExecutionContext) => SkillCooldownAssessment = evaluateSkillCooldownReady;
const starter: (instance: SkillInstanceState, state: SkillCooldownState, context: GameplayExecutionContext,
  config: SkillCooldownConfiguration) => SkillCooldownStartResult = startSkillCooldown;
const status: SkillCooldownStatus = assessment.status;
const reason: SkillCooldownReason = assessment.reason;
const timestamp: number | null = state.readyAtMs;
if (result.status === 'started') {
  const next: SkillCooldownState = result.state;
  const duration: number = result.durationMs;
  const success: 'none' = result.reason;
  // @ts-expect-error Candidate state is readonly.
  next.readyAtMs = 0;
  void [next, duration, success];
} else {
  const next: null = result.state;
  const duration: null = result.durationMs;
  const rejection: 'cooldown_active' = result.reason;
  void [next, duration, rejection];
}
type IsAny<T> = 0 extends (1 & T) ? true : false;
const noAny: [IsAny<typeof state>, IsAny<typeof assessment>, IsAny<typeof result>,
  IsAny<typeof factory>, IsAny<typeof readiness>, IsAny<typeof starter>] = [false, false, false, false, false, false];
// @ts-expect-error Required explicit configuration.
startSkillCooldown(instance, state, context);
// @ts-expect-error Opaque canonical execution context required.
evaluateSkillCooldownReady(instance, state, {clock: {now: () => 1000}});
// @ts-expect-error No hidden default CDR.
const missing: SkillCooldownConfiguration = {baseDurationMs: 1000};
// @ts-expect-error No extra metadata contract.
const extra: SkillCooldownState = {...state, metadata: {}};
// @ts-expect-error Configuration readonly.
config.effectiveCdr = 0;
// @ts-expect-error Assessment readonly.
assessment.remainingMs = 0;
// @ts-expect-error Result readonly.
result.status = 'started';
// @ts-expect-error Cooldown is separate from instance identity.
instance.readyAtMs;
// @ts-expect-error Readiness is not a state.
startSkillCooldown(instance, assessment, context, config);
// @ts-expect-error No activation status vocabulary.
const invalidStatus: SkillCooldownStatus = 'activated';
// @ts-expect-error No implicit resource admission reason.
const invalidReason: SkillCooldownReason = 'insufficient_resource';
// @ts-expect-error Package exposes root only.
import {} from '@rpg/gameplay/modules/skill';
void [factory, readiness, starter, status, reason, timestamp, noAny, missing, extra, invalidStatus, invalidReason];
