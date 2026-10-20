import {evaluateSkillResourceCosts, applySkillResourceCosts,
  type SkillResourceCost, type SkillResourceCostBounds, type SkillResourceCostRequest,
  type SkillResourceCostStatus, type SkillResourceCostRejectionReason,
  type SkillResourceCostAssessment, type SkillResourceCostApplicationResult,
  type SkillAdmissionResult, type EntityResourceState, type EntityResourceTransitionResult} from '@rpg/gameplay';

const admission: SkillAdmissionResult = {instanceId: 'i', skillId: 's', actorEntityId: 'a', status: 'admitted', reason: 'none'};
const resources: EntityResourceState = {entityId: 'a', current: {mana: 100}};
const cost: SkillResourceCost = {resourceId: 'mana', amount: .25};
const bounds: SkillResourceCostBounds = {resourceId: 'mana', minimum: 0, maximum: 100, currentAboveMaximum: 'reject'};
const request: SkillResourceCostRequest = {costs: [cost], bounds: [bounds]};
const evaluated: SkillResourceCostAssessment = evaluateSkillResourceCosts(admission, resources, request);
const applied: SkillResourceCostApplicationResult = applySkillResourceCosts(admission, resources, request);
const signature: (admission: SkillAdmissionResult, resources: EntityResourceState,
  request: SkillResourceCostRequest) => SkillResourceCostAssessment = evaluateSkillResourceCosts;
const applicationSignature: (admission: SkillAdmissionResult, resources: EntityResourceState,
  request: SkillResourceCostRequest) => SkillResourceCostApplicationResult = applySkillResourceCosts;
const status: SkillResourceCostStatus = evaluated.status;
const reason: SkillResourceCostRejectionReason = evaluated.reason;
const rejectedId: string | null = evaluated.rejectedResourceId;
if (applied.status === 'applied') {
  const state: EntityResourceState = applied.state;
  const diagnostics: readonly EntityResourceTransitionResult['transition'][] = applied.transitions;
  const none: 'none' = applied.reason;
  // @ts-expect-error Candidate state is immutable.
  state.current.mana = 0;
  // @ts-expect-error No interim state authorities in diagnostics.
  diagnostics[0]!.state;
  // @ts-expect-error Canonical diagnostic is immutable.
  diagnostics[0]!.applied = 0;
  void [state, diagnostics, none];
} else {
  const state: null = applied.state;
  const transitions: readonly [] = applied.transitions;
  const rejection: 'resource_not_found' | 'insufficient_resource' = applied.reason;
  void [state, transitions, rejection];
}
type IsAny<T> = 0 extends (1 & T) ? true : false;
const noAny: [IsAny<typeof evaluated>, IsAny<typeof applied>, IsAny<typeof applied.transitions[number]>,
  IsAny<typeof evaluateSkillResourceCosts>, IsAny<typeof applySkillResourceCosts>] = [false, false, false, false, false];
// @ts-expect-error Explicit bounds required.
const missingBounds: SkillResourceCostRequest = {costs: []};
// @ts-expect-error No implicit policy.
const missingPolicy: SkillResourceCostBounds = {resourceId: 'mana', minimum: 0, maximum: 100};
// @ts-expect-error Closed policy vocabulary.
const badPolicy: SkillResourceCostBounds = {...bounds, currentAboveMaximum: 'clamp'};
// @ts-expect-error No cost formula at this stage.
const formula: SkillResourceCost = {resourceId: 'mana', amount: () => 25};
// @ts-expect-error No implicit resource identity.
const missingId: SkillResourceCost = {amount: 1};
// @ts-expect-error No metadata contract.
const extra: SkillResourceCostRequest = {...request, metadata: {}};
// @ts-expect-error Cost entry readonly.
cost.amount = 0;
// @ts-expect-error Bounds readonly.
bounds.minimum = 1;
// @ts-expect-error Request list readonly.
request.costs.push(cost);
// @ts-expect-error Assessment readonly.
evaluated.rejectedResourceId = 'changed';
// @ts-expect-error Application readonly.
applied.status = 'rejected';
// @ts-expect-error Three arguments required.
applySkillResourceCosts(admission, resources);
// @ts-expect-error Application accepts admission, never an old payable assessment.
applySkillResourceCosts(evaluated, resources, request);
// @ts-expect-error No activation/execution status.
const future: SkillResourceCostStatus = 'activated';
// @ts-expect-error No cooldown reason.
const futureReason: SkillResourceCostRejectionReason = 'cooldown_active';
// @ts-expect-error No deep resource-cost export.
import {applySkillResourceCosts as deep} from '@rpg/gameplay/resource-cost';
void [signature, applicationSignature, status, reason, rejectedId, noAny, missingBounds,
  missingPolicy, badPolicy, formula, missingId, extra, future, futureReason, deep];
