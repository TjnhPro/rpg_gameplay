import {activateSkill, reportSkillExecutionOutcome,
  type SkillActivationInput, type SkillActivationResult, type SkillActivationRejectionReason,
  type SkillExecutionIntent, type SkillExecutionPreflight, type SkillExecutionRequest,
  type SkillExecutionStatus, type SkillExecutionReport, type SkillExecutionOutcome} from '@rpg/gameplay';

declare const input: SkillActivationInput;
const intent: SkillExecutionIntent = {attemptId: 'attempt', dispatch: {kind: 'caller'}};
const preflight: SkillExecutionPreflight = {kind: 'caller', status: 'accepted'};
const activate: (input: SkillActivationInput) => SkillActivationResult = activateSkill;
const report: (request: SkillExecutionRequest, report: SkillExecutionReport) => SkillExecutionOutcome = reportSkillExecutionOutcome;
const result = activate({...input, intent, executionPreflight: preflight});
if (result.status === 'accepted') {
  const reason: 'none' = result.reason;
  const request: SkillExecutionRequest = result.request;
  const status: SkillExecutionStatus = 'completed';
  const outcome = report(request, {status});
  const dispatchKind: 'caller' | 'combat' = outcome.dispatchKind;
  if (request.dispatch.kind === 'combat') {
    const target: string = request.dispatch.targetEntityId;
    // @ts-expect-error Deep readonly dispatch.
    request.dispatch.actionId = 'changed';
    void target;
  }
  // @ts-expect-error Resource candidates readonly.
  result.resources.current.mana = 0;
  // @ts-expect-error Cooldown candidates readonly.
  result.cooldown.readyAtMs = 0;
  // @ts-expect-error Outcome readonly.
  outcome.status = 'failed';
  void [reason, dispatchKind];
} else {
  const reason: SkillActivationRejectionReason = result.reason;
  const candidates: [null, null, null] = [result.request, result.resources, result.cooldown];
  void [reason, candidates];
}
type IsAny<T> = 0 extends (1 & T) ? true : false;
const noAny: [IsAny<typeof result>, IsAny<SkillExecutionOutcome>, IsAny<typeof activate>, IsAny<typeof report>] = [false, false, false, false];
// @ts-expect-error All activation records mandatory.
activateSkill({intent, executionPreflight: preflight});
// @ts-expect-error Closed activation contract.
activateSkill({...input, metadata: {}});
// @ts-expect-error Explicit accepted/rejected preflight vocabulary.
const badPreflight: SkillExecutionPreflight = {kind: 'combat', status: 'admitted'};
// @ts-expect-error No default target or action for combat.
const missing: SkillExecutionIntent = {attemptId: 'a', dispatch: {kind: 'combat'}};
// @ts-expect-error Caller dispatch has no Combat bindings.
const extra: SkillExecutionIntent = {attemptId: 'a', dispatch: {kind: 'caller', actionId: 'a'}};
// @ts-expect-error No hit/success policy in execution report.
const badReport: SkillExecutionReport = {status: 'completed', hit: true};
// @ts-expect-error Accepted activation is not completion vocabulary.
const badStatus: SkillExecutionStatus = 'accepted';
// @ts-expect-error Input readonly.
input.executionPreflight = preflight;
// @ts-expect-error Root exports only.
import {} from '@rpg/gameplay/modules/skill';
void [noAny, badPreflight, missing, extra, badReport, badStatus];
