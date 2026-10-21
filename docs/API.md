## v0.10.4 — Inventory integration evidence only (IN21–IN25)

No production source or public API changes from v0.10.3. Installed consumers compose
Item creation with Inventory snapshots, queries/capacity, add, quantity adjustment,
complete merge and removal. Three caller data profiles share the same headless API.
Hand-authored future handoff snapshots demonstrate representability only; no split,
transfer, Equipment, slot, persistence or global ownership operation is implemented.
Developer milestone/phase acceptance PENDING. [Report](reports/v0.10.4-inventory-integration-closure.md).

## v0.10.3 — Inventory Stack & Merge (IN16–IN20)

Root adds mergeInventoryEntries(state,context,sourceInstanceId,destinationInstanceId,admission)
and InventoryMergeReason (ineligible, missing_entry, same_instance, item_incompatible,
stack_limit_exceeded), returning the existing InventoryTransitionResult union.
Complete structure validation precedes admission, missing membership and same-ID rejection.
Canonical Item assessItemStackCompatibility owns full definition/property/policy compatibility.
Safe integer overflow and explicit cap violations reject the entire merge. On success, remove
source membership, preserve destination Item and remaining entry order, sum quantity, validate
and deeply freeze/detach the full candidate. L4 owns commits and global identity invariants.
No split, remainder, auto-stack or transfer. [Report](reports/v0.10.3-inventory-stack-merge.md).

## v0.10.2 — Inventory Add, Remove & Quantity (IN11–IN15)

Root adds addInventoryEntry(state,context,entry,capacity,admission),
removeInventoryEntry(state,context,instanceId,admission) and
adjustInventoryQuantity(state,context,instanceId,delta,admission).
Types: InventoryOperationAdmission {readonly eligible:boolean} and InventoryMutationReason
(ineligible, already_present, missing_entry, capacity_exceeded, quantity_underflow,
stack_limit_exceeded, quantity_not_allowed). All use the existing InventoryTransitionResult union.
Structural validation precedes admission, including the incoming Item, safe positive quantity,
closed capacity/admission, IDs and nonzero safe-integer delta. Invalid structure throws TypeError.
Then admission rejection takes precedence; add checks duplicate, capacity, stackability and cap
in that order; remove/adjust check missing membership. Overflow rejects stack_limit_exceeded.
Positive safe quantities violating stackability/caps yield business rejections, not TypeError.
Accepted full candidates pass canonical validation and are detached/frozen; results are frozen.
Add appends without merging, remove preserves remaining order, adjust to zero removes membership.
No authoritative Item grant/delete or storage commit. [Report](reports/v0.10.2-inventory-add-remove-quantity.md).

## v0.10.1 — Inventory Queries & Capacity (IN06–IN10)

Root adds getInventoryEntry(state, context, instanceId), listInventoryEntries(state, context),
hasInventoryItem(state, context, instanceId), assessInventoryCapacity(state, context, policy, additionalEntries).
Types: InventoryCapacityPolicy {readonly maxEntries: number | null} and
InventoryCapacityAssessment {readonly fits: boolean; readonly occupied: number; readonly available: number | null}.
All calls validate the complete state/context first. IDs match exactly, without case folding
or Unicode normalization; blank lookup IDs throw TypeError. Entries/lists are detached/frozen.
Capacity counts entries, not quantity. Policy is a closed own-data record; maximum and
additional count are nonnegative safe integers (explicit null maximum means unbounded).
Finite available is max(maximum - occupied, 0); fits requires the existing state and
additional entries to fit. Unbounded fits is true for any valid additional count, without
adding potentially unsafe integers. Over-capacity state remains valid and unchanged.
Foundation shapes/semantics unchanged. [Report](reports/v0.10.1-inventory-queries-capacity.md).

## v0.10.0 — Inventory Foundation (IN01–IN05)

Root adds `createInventoryState(input, context)` and `validateInventoryState(state, context)`;
both return fresh detached/frozen complete snapshots or throw TypeError.
Six types: InventoryOwnerReference, InventoryEntry, InventoryState, InventoryItemContext,
InventoryValidationContext and InventoryTransitionResult<TReason extends string>.
State contains only inventoryId, nullable neutral owner and ordered entries with canonical
ItemInstanceState plus positive safe-integer quantity. Instance ID is the membership key.
Context supplies complete definitions, Item stackability and explicit maximum/null;
it is not stored. Item public validators own Item binding/properties. No Add/Remove,
Merge/Split/Transfer, slots, capacity, authorization or global identity management.
[Approved task](tasks/active/v0.10.0-inventory-foundation.md) / [report](reports/v0.10.0-inventory-foundation.md).
Earlier checkpoint sections below are historical.

## v0.9.3 — Item API frozen, integration evidence only

No production or public declaration changes from 0.9.2: exactly twelve Item
functions/thirteen types. Installed consumers use root ESM and readonly public
shapes for definition → instance → inspect → set/replace candidate → revalidate →
compatibility → read handoff. The missing-property result remains {found:false};
explicit null is present. Source labels stay outside Item. Candidates and advisory
compatibility prove neither authoritative commit nor ownership/quantity/equipment.
See the v0.9.3 final report; milestone and phase acceptance PENDING.

## v0.9.2 — Item stack compatibility IT09–IT11

Root additions: validateItemStackPolicy(policy) and
assessItemStackCompatibility(leftDefinition, leftInstance, rightDefinition,
rightInstance, policy); types ItemStackPolicy and ItemStackCompatibilityResult.
Policy is exactly {stackable:boolean}; validation returns a fresh frozen snapshot.
All five complete operands validate canonically before any incompatibility result.
Invalid own-data/prototype/nested/binding input throws TypeError without getters.

Valid operands yield exactly frozen {compatible,reason}, in priority order:
same_instance, different_definition, definition_conflict, not_stackable,
different_properties, then {compatible:true,reason:'none'}. Definition comparison
includes category, rarity, ordered tags and all properties. Instance comparison
includes all properties; distinct instance IDs are required. Records compare exact
own keys independent of insertion order; arrays remain ordered; scalars use
Object.is (0 differs from -0). Comparisons use validated captured data only.

This is advisory structural compatibility. L3 supplies policy; L4 rechecks current
ownership/freshness before any future commit. No quantity, stack storage, merge,
split, ID retirement or global uniqueness evidence. Previous contracts unchanged.
See [task](tasks/active/v0.9.2-item-stack-compatibility.md) and
[report](reports/v0.9.2-item-stack-compatibility.md). Earlier sections are historical.

## v0.9.1 — Item property operations IT06–IT08

Root-only additions: getItemInstanceProperty(definition, instance, key),
setItemInstanceProperty(definition, instance, key, value, admission), and
replaceItemInstanceProperties(definition, instance, properties, admission).
New types: ItemPropertyReadResult, ItemPropertyOperationAdmission and
ItemPropertyOperationResult. The eight Foundation types/seven functions stay unchanged.

Read returns exactly {found:false} or {found:true,value}; it reads instance own
properties only, distinguishing absent, null and all falsy data. Keys are any exact
strings, including empty/whitespace, Unicode and __proto__. Set replaces/adds one
key; replacement removes every omitted key. Both return a new full same-ID candidate
for closed {eligible:true}, or {status:'rejected',reason:'ineligible',candidate:null}
for valid {eligible:false}. Accepted shape is
{status:'accepted',reason:'none',candidate:<ItemInstanceState>}.

Canonical complete definition/instance validation and recursive payload/admission
validation precede rejection. Malformed input throws TypeError. Every returned
object is detached/deeply frozen; inputs remain untouched. ECMAScript own-key order
is preserved. Admission is a caller assertion; L3 owns permitted property semantics
and L4 rechecks current authoritative state and commits. No arithmetic, implicit
definition defaults, deletion operation, events or persistence.

## v0.9.0 — Item foundation (IT01–IT05)

Root-only seven functions: createItemDefinitionReference, createItemInstanceReference,
validateItemInstanceReference, createItemDefinition, validateItemDefinition,
createItemInstance, validateItemInstance. Eight types: ItemDefinitionReference,
ItemInstanceInitialIdentity, ItemInstanceReference, ItemPropertyValue,
ItemDefinitionContent, ItemDefinition, ItemInstanceInitialState, ItemInstanceState.

Definition has definitionId/categoryId/tagIds/rarityId/properties. Instance has
instanceId/definitionId/properties. IDs are exact nonblank strings; category/rarity
are opaque nullable IDs; tags are ordered unique IDs. Instance properties are its
own explicit data and never inherit definition properties. Narrow reference helpers
require a projected {definitionId}, not a contentful definition.

Creation and validation return fresh detached deeply frozen snapshots. Records
are closed own-data plain/null-prototype objects. Recursive properties accept
null, strings, finite numbers (including -0), booleans, dense arrays and plain
records, including arbitrary dangerous string keys as inert own data. Accessors,
cycles, unsupported values/prototypes, symbol keys and sparse/extended arrays
throw TypeError. Reflection reads descriptors, not getters. JavaScript cannot
portably detect every Proxy; inspection failures are rejected. No arbitrary size
policy is added; deeply nested/large untrusted inputs still need caller budgets.

No quantity/slot/owner/location, arithmetic, catalog, store, implicit ID, property
operations, stack compatibility, Inventory/Equipment/Loot/Reward execution.
See [task](tasks/active/v0.9.0-item-foundation.md) and
[report](reports/v0.9.0-item-foundation.md). Developer acceptance PENDING;
phase IN_PROGRESS, PR Draft. Earlier sections are historical.

## v0.8.7 — Encounter integration closure EN36–EN40

Existing public functions compose installed PvE, pending/clear waves, independent
Dungeon battles and externally selected turns in L4 test consumers. No production
API, five-field EncounterState, optional entity-only dependency or canonical
Combat/Skill/Effect/AI owner changes. See the [final evidence](reports/v0.8.7-encounter-final-review.md).
Technical review does not accept the phase: Developer acceptance remains PENDING,
PR #13 remains Draft. Concrete game profiles, World spawning, durable/distributed
transactions, rewards, rendering and game balance remain NOT_EVALUATED.

## v0.8.6 — composition only, no new public API

EN31–EN35 use current canonical Life and existing activateEncounter,
applyEncounterMembershipChange, evaluateEncounterCompletion, resolveEncounter,
closeEncounter, cancelEncounter and createEncounterCleanupHandoff. Callers refresh
full-roster facts and retain L4 revision/fact generations; returned candidates do
not authenticate a commit or authorize side effects. No new recovery/wave status,
participant Life store, module export or default game policy. See the
[installed evidence](reports/v0.8.6-encounter-continuity-recovery.md).

## v0.8.5 — EN26–EN30 terminal candidate API

Root-only ESM signatures (EntityCollection is the canonical Entity owner):

```ts
createEncounterClosurePolicy(input: EncounterClosurePolicy): EncounterClosurePolicy
resolveEncounter(state: EncounterState, entities: EntityCollection, policy: EncounterCompletionPolicy, observation: EncounterCompletionObservation): EncounterResolutionTransitionResult
closeEncounter(state: EncounterState, entities: EntityCollection, disposition: EncounterDispositionRecord): EncounterCloseTransitionResult
cancelEncounter(state: EncounterState, entities: EntityCollection, policy: EncounterClosurePolicy, request: EncounterCancellationRequest): EncounterCancellationTransitionResult
createEncounterCleanupHandoff(state: EncounterState, entities: EntityCollection, disposition: EncounterDispositionRecord): EncounterCleanupHandoff
```

Seven new types are EncounterDispositionRecord, EncounterResolutionTransitionResult,
EncounterCloseTransitionResult, EncounterClosurePolicy, EncounterCancellationRequest,
EncounterCancellationTransitionResult and EncounterCleanupHandoff. Root inventory
is155 functions/267 types, preserving every prior named export and signature.

Disposition is exactly {kind:'resolution',encounterId,definitionId,ruleId,outcome}
or {kind:'cancellation',encounterId,definitionId,reasonId,outcome:null}. Resolution
retains canonical EncounterResolutionOutcome, selected rule and unique/disjoint
declared-side arrays. IDs are opaque exact nonblank strings. Close/cleanup check
identity/outcome correlations; neither authenticates a caller record or proves
that a transition was committed. State remains the original five fields.

Resolve calls evaluateEncounterCompletion freshly; pending yields rejected with
its exact existing reason and state:null/disposition:null. Close permits only
resolved→closed; prepared/active reject encounter_not_resolved and closed/cancelled
reject already_terminal. Resolved plus cancellation record throws TypeError.
Cancellation policy is {definitionId,cancelAllowedStatuses:('prepared'|'active')[]};
[] is valid deny-all, duplicates invalid. Request is {encounterId,reasonId}.
Resolved/closed/cancelled reject already_finalized; excluded prepared/active reject
cancellation_not_allowed. Every rejection has null candidates; successes reason:none.

Cleanup accepts only closed+resolution or cancelled+cancellation and returns exactly
{encounterId,terminalStatus,dispositionKind,participantEntityIds} in roster order.
Empty terminal roster yields[]. All structural inputs validate before domain
rejections; unknown fields, accessors, symbols, sparse/duplicate arrays and malformed
correlations throw TypeError. Outputs are deeply frozen/detached; inputs unchanged.
L4 owns current-baseline atomic acceptance, record persistence, dispatch and retries.
There is no internal commit/store, implicit close, World action or receipt authority.

Phase IN_PROGRESS; Developer acceptance PENDING; PR #13 remains Draft.
v0.8.6/v0.8.7 NOT_STARTED. No Ready UI, merge, tag or publish. Concrete gameplay
profiles NOT_EVALUATED. Earlier checkpoint sections below are historical.


## v0.8.4 — EN21–EN25 completion assessment

Root-only native ESM functions:

- createEncounterCompletionPolicy(input: EncounterCompletionPolicy): EncounterCompletionPolicy
- createEncounterCompletionObservation(input: EncounterCompletionObservation): EncounterCompletionObservation
- evaluateEncounterCompletion(state: EncounterState, entities: EntityCollection, policy: EncounterCompletionPolicy, observation: EncounterCompletionObservation): EncounterCompletionAssessment

Thirteen public types: EncounterParticipantLifeFact, EncounterObjectiveStatus,
EncounterObjectiveFact, EncounterContinuation, EncounterCompletionObservation,
EncounterVictoryOutcomeTemplate, EncounterDrawOutcomeTemplate, EncounterOutcomeTemplate,
EncounterCompletionRule, EncounterCompletionPolicy, EncounterResolutionOutcome,
EncounterCompletionPendingReason, EncounterCompletionAssessment. Exact root runtime
inventory150 functions;260 type exports. All prior exports/signatures preserved.

Observation has exactly encounterId/participants/objectives/continuation. Facts use
canonical EntityLifeState with exact nested entity binding. Missing current roster
Life is incomplete; foreign/duplicate facts and identity mismatches throw TypeError.
Objectives are pending/succeeded/failed; missing/pending cannot satisfy a rule.
Policy definitionId must match state. All rules/references/facts validate before any
domain return, including unselected rules and inactive encounters. Closed own data,
dense arrays, exact opaque nonblank IDs, no accessors/coercion, deep freeze/detachment.

Ordered rules: side_elimination has at least two unique declared contender sides
and explicit zeroSurvivors pending|draw. Empty contender roster never means dead.
One live side wins; other named contenders lose in policy order; zero live sides
draw only by explicit policy; multiple live sides continue to later rules. Objective
rules match exact objectiveId/whenStatus and project explicit side templates. Victory
requires nonempty unique winners disjoint from unique defeated sides; objective
defeated may be empty. Draw requires both arrays empty. No side inferred from kind.

Precedence after structural validation: encounter_not_active; continuation_pending;
participant_fact_missing (first canonical roster ID); first matching rule; otherwise
no_completion_condition_met. Pending has null ruleId/outcome and nullable missing ID.
Resolvable has reason rule_matched, exact ruleId, participantEntityId:null and
frozen outcome. No state candidate/receipt, remembered result, mutation or dispatch.
L4 owns current Life/World/continuation provenance and any future authoritative commit.

## v0.7.6 additive root API

Four functions: `evaluateActorAILifeGate(state, entities, actorLife)`,
`evaluateActorAIReset(state, entities, actorLife, behaviorPolicy, request)`,
`createActorAIDecisionTimingState(state, executionContext)`, and
`evaluateActorAIDecisionTiming(state, entities, actorLife, timing, policy, executionContext)`.
Seven types: `ActorAILifeGateResult`, `ActorAIResetReason`, `ActorAIResetRequest`,
`ActorAIResetResult`, `ActorAIDecisionTimingState`, `ActorAIDecisionTimingPolicy`,
`ActorAIDecisionTimingResult`. Root inventory: **130 functions / 222 types**.

Life gate validates canonical Entity membership and exact bound Life, with dead
preceding manual. Reset reasons respawn/session_reset require an allowed behavior
state; disengage requires null destination and preserves current behavior. All
clear target, preserve actor/profile/controller, reject dead Life. L4 commits.
Timing companion has actorId/observedAtMs/nextEligibleAtMs. Interval is a nonnegative
safe integer. Foundation opaque context supplies one clock sample per live AI
evaluation; dead/manual consume none. Initial cursor is immediately eligible.
Ready returns an immutable candidate; not_due/blocked return null state. Time
regression and unrepresentable advance fail closed. Zero interval is explicitly due
at the same timestamp, without a loop. Candidates are observations, never execution
authority or a durable reservation; L4 rechecks current Life/controller and baseline.
Existing ActorAIState and AI01–AI30 signatures remain unchanged. Root-only exports.

## v0.7.5 terminal feedback — AI26–AI30

One additive root function/type; total **126 functions /215 types**:

```ts
validateActorAIActionExecutionFeedback(
  selection: ActorAIActionSelectionResult,
  feedback: ActorAIActionExecutionFeedback
): ActorAIActionExecutionFeedback
```

Feedback carries exact actorId/decisionId/actionKey/targetEntityId from the selected
proposal and a caller-owned nonblank attemptId. Valid terminal combinations:

| phase | status | reasonId |
|---|---|---|
| admission | rejected | nonblank string |
| execution | completed | null |
| execution | failed | nonblank string |

Selection and feedback use closed own-data validation, without invoking getters.
No feedback for no_action/manual. Result is detached and frozen; inputs/state are
unchanged. Invalid discriminants, target bindings, malformed diagnostics or wrong
correlation throw TypeError. Nonblank identifiers are preserved exactly.
The validator cannot prove caller execution, authorize an action, establish current
controller/world state, prevent duplicate execution, or commit state. Repeated valid
reports are intentionally accepted. L4 verifies receipts, binds actionKey to canonical
execution, rechecks freshness and owns any attempt ledger. No runtime/store/callback.
Integration consumers use actual Combat admission/target/attack/damage, Skill
admission/cost/cooldown/activation/outcome, Effect lifecycle/status/restrictions and
Entity resources/Life. These are test-only caller composition, not new AI APIs.
[report](reports/v0.7.5-combat-skill-effect-integration.md). Historical inventories below are preserved.

## v0.7.4 Action Selection & Intent — AI21–AI25

Three functions/nine types added; root **125 functions /214 types**.
All AI01–AI20 contracts remain unchanged. Types: ActorAIActionKind,
ActorAIActionTargetMode, ActorAIActionRule, ActorAIActionSelectionPolicy,
ActorAIActionAvailability, ActorAIActionObservation, ActorAIActionRuleRejectionReason,
ActorAIActionRuleRejection, ActorAIActionSelectionResult.

```ts
createActorAIActionSelectionPolicy(input: ActorAIActionSelectionPolicy): ActorAIActionSelectionPolicy;
createActorAIActionObservation(context: ActorAIDecisionContext,
  availability: readonly ActorAIActionAvailability[]): ActorAIActionObservation;
evaluateActorAIActionSelection(state: ActorAIState, entities: EntityCollection,
  context: ActorAIDecisionContext, policy: ActorAIActionSelectionPolicy,
  observation: ActorAIActionObservation): ActorAIActionSelectionResult;
```

Policy is a closed profileId/rules record. Each ordered rule has ruleId,
behaviorStateId, actionKey, actionKind and targetMode. IDs are exact nonblank,
case-sensitive, never normalized. Rule IDs unique. Reused actionKey requires
consistent kind/mode across every behavior rule. Empty rules are valid.

| actionKind | Allowed targetMode | Intent target |
| --- | --- | --- |
| basic_attack | current_target | state.targetEntityId |
| skill | current_target / self | state.targetEntityId / actorId |
| approach_target | current_target | state.targetEntityId |
| return_home | none | null |
| wait | none | null |

Observation contains actorId, decisionId and dense availability array. Each entry
is exactly {actionKey,status,reasonId}: available/null or unavailable/nonblank
opaque reasonId. Unique action keys; unknown extra keys are valid facts but cannot
select a rule. Availability order never defines priority. No canonical admission
interpretation of reasonId. Fact freshness and decision-ID uniqueness are L4-owned.

Validate canonical actor/state, closed context, entire policy and observation,
actor/decision/profile identities before manual/no-op/selection. Manual returns
no_action/manual_control, null rule/kind, validated no_action decision and [].
AI iterates rules in declared order, skipping different behavior without diagnostics.
Applicable rejection precedence: target_missing, availability_missing, action_unavailable.
First valid available rule wins; rejected contains only preceding applicable failures,
ordered by policy. None selected gives no_action/no_candidate with null intent;
no implicit wait. Explicit wait still requires configured rule and available fact.

Result fields: status selected/no_action; reason rule_selected/no_candidate/manual_control;
selectedRuleId string/null; actionKind kind/null; decision ActorAIDecisionResult;
rejected readonly ActorAIActionRuleRejection[] (ruleId/actionKey/reason).
Selected wraps proposed/none using existing createActorAIActionIntent and
validateActorAIDecisionResult. Both no-action paths use the same accepted validator.
This metadata interface does not introduce another execution intent authority.
All records/arrays detached and frozen; caller inputs remain untouched.

Current target is a structural reference, not proof of eligibility/existence/Life.
No state/target/behavior/controller changes, hidden time/RNG, execution or world
calculations. L4 must revalidate all canonical conditions before execution.
Full declarations live at public root; no deep export. [report](reports/v0.7.4-ai-action-selection-intent.md).

## v0.7.3 AI Behavior & State Transitions — AI16–AI20

Additive root API: three functions/five types; total **122 functions /205 types**.
All AI01–AI15 signatures and behavior retained.

```ts
type ActorAIBehaviorTargetRequirement = 'any' | 'present' | 'absent';
interface ActorAIBehaviorRule {
  readonly ruleId: string;
  readonly fromStateId: string;
  readonly triggerId: string;
  readonly toStateId: string;
  readonly targetRequirement: ActorAIBehaviorTargetRequirement;
}
interface ActorAIBehaviorPolicy {
  readonly profileId: string;
  readonly stateIds: readonly string[];
  readonly rules: readonly ActorAIBehaviorRule[];
}
interface ActorAIBehaviorObservation {
  readonly actorId: string;
  readonly triggerIds: readonly string[];
}
createActorAIBehaviorPolicy(input: ActorAIBehaviorPolicy): ActorAIBehaviorPolicy;
createActorAIBehaviorObservation(state: ActorAIState,
  triggerIds: readonly string[]): ActorAIBehaviorObservation;
evaluateActorAIBehaviorTransition(state: ActorAIState, entities: EntityCollection,
  observation: ActorAIBehaviorObservation,
  policy: ActorAIBehaviorPolicy): ActorAIBehaviorTransitionResult;
```

All IDs exact/nonblank/case-sensitive. Unique state/trigger/rule IDs, valid rule
state references and explicit guard required. Empty rules/triggers are valid;
empty state sets can be captured but cannot contain a valid evaluation state.
Policy factory detaches/freezes nested records/arrays and preserves rule order.
Observation factory structurally validates state and captures supplied triggers,
without generating events or checking collection membership.

Evaluator validates state/canonical actor, complete policy/observation, profile
and actor binding, current-state membership before manual gate. All malformed
input rejects even when manual/no-trigger/no-match; no partial valid subset.
First rule matching source, trigger membership and target guard wins. Guard
failure continues to later rules; trigger order has no priority. present/absent
checks null only, not target existence/Life/eligibility. Same-state rule wins
without continuing to later rules. No automatic target-selection chaining.

ActorAIBehaviorTransitionResult is a readonly discriminated union:

| status | reason | ruleId / triggerId | nextBehaviorStateId | state |
| --- | --- | --- | --- | --- |
| transitioned | rule_matched | string / string | string | ActorAIState |
| unchanged | no_trigger / no_matching_rule / same_state | string or null | string | ActorAIState |
| blocked | manual_control | null / null | null | null |

Every result includes previousBehaviorStateId:string. same_state carries matched
IDs; no_trigger/no_matching_rule carry null IDs. Every nonblocked state is detached
and frozen; only behaviorStateId can change. Actor/profile/controller/target exact
values preserved. No result-validation API is added; closed output discriminators
are proved by literal runtime oracles and strict declarations.
L3 configures arbitrary states/profiles, L4 supplies genuine events/current state
and commits candidates after authority/freshness checks. No built-in profile,
action success inference, timer/RNG, World/movement or execution. [Report](reports/v0.7.3-ai-behavior-state-transitions.md).

## v0.7.2 Target Acquisition & Selection — AI11–AI15

Additive root API: one function/three types; total **119 functions /200 types**.
Existing AI01–AI10 and all historical signatures/semantics preserved.

```ts
evaluateActorAITargetSelection(state: ActorAIState, entities: EntityCollection,
  perception: ActorAIPerceptionAssessment,
  policy: ActorAITargetSelectionPolicy): ActorAITargetSelectionResult
```

ActorAITargetSelectionPolicy has required readonly retention:
'retain_if_eligible'|'prefer_priority' and preferredTargetIds:readonly string[].
Duplicate/nonblank-invalid IDs reject; absent/excluded preferences cannot win.
retain_if_eligible preserves an eligible current target over every preference;
otherwise prefer supplied IDs in order, then minimum remaining ID using
locale-independent UTF-16 lexical comparison. Perception order does not break ties.

ActorAITargetLossReason is 'not_perceived'|ActorAIPerceptionExclusionReason.
ActorAITargetSelectionResult is a readonly discriminated union:

| status | reason | selectedTargetEntityId | state |
| --- | --- | --- | --- |
| selected | acquired / retained / switched | string | ActorAIState |
| no_target | no_candidates / target_lost | null | ActorAIState |
| blocked | manual_control | null | null |

Every envelope also contains previousTargetEntityId:string|null and
lossReason:ActorAITargetLossReason|null. Loss is null without a previous target
or when it remains eligible, including priority-only switches. Otherwise use the
exact exclusion reason, or not_perceived if absent from both lists. A lost target
without replacement yields a candidate with null target. All nonblocked candidates
are detached/frozen; only targetEntityId may differ. Manual control never receives
a candidate and never clears its original target.

Processing validates state/canonical actor, closed assessment and actor binding,
then policy before checking manual control. Assessment validates time, exact
status/reason/count agreement, accepted facts/exclusion reasons and unique IDs
within/across both dense own-data lists. Closed records/accessors/symbols/inherited
fields reject without getters. Shared perception validators are reused; AI09 is
never rerun and its policy gates are not duplicated.
Structural integrity does not establish provenance/freshness. L4 supplies genuine
assessment evidence and rechecks current state/controller/world before commit and
execution. No World query, distance/threat score, behavior transition or action
execution is performed. See [report](reports/v0.7.2-target-acquisition-selection.md).

## v0.7.1 AI Perception & Context — AI06–AI10

Additive root API: three functions/six types; total **118 functions /197 types**.
All v0.7.0 signatures/semantics preserved. New signatures:

```ts
createActorAIPerceptionSnapshot(state: ActorAIState,
  input: {readonly observedAtMs: number; readonly candidates: readonly ActorAIPerceivedEntity[]}): ActorAIPerceptionSnapshot
validateActorAIPerceptionSnapshot(state: ActorAIState,
  perception: ActorAIPerceptionSnapshot): ActorAIPerceptionSnapshot
evaluateActorAIPerception(state: ActorAIState, entities: EntityCollection,
  perception: ActorAIPerceptionSnapshot, policy: ActorAIPerceptionPolicy): ActorAIPerceptionAssessment
```

All fields readonly. ActorAIPerceivedEntity: entityId/relationId:string,
lifeStatus:EntityLifeStatus, visible/inRange/reachable:boolean.
ActorAIPerceptionSnapshot: actorId:string, observedAtMs:number, candidates:readonly facts[].
ActorAIPerceptionPolicy: allowedRelationIds:readonly string[],
allowedLifeStatuses:readonly EntityLifeStatus[], requireVisible/requireInRange/
requireReachable/allowSelf:boolean; every field required, empty lists allow none.
ActorAIPerceptionExclusionReason: the seven strings below.
ActorAIPerceptionExclusion: entityId:string, reason:exclusion reason.
ActorAIPerceptionAssessment: actorId/observedAtMs, status:'candidates_available'|
'no_candidates', reason:'none'|'no_perceived_entities'|'no_eligible_candidates',
eligible:readonly facts[], excluded:readonly exclusions[].

Closed own-data ordinary/null-prototype records; dense own-data arrays without
extra/symbol/accessor fields. Invalid IDs/life/booleans, duplicates, negative or
nonfinite time and actor mismatch throw TypeError without running getters.
Factory/validator capture facts including structurally valid stale references.
Evaluation validates state, canonical collection/actor, snapshot, policy, binding;
then filters in input order. First failing reason wins:
entity_not_found → self_not_allowed → target_life_not_allowed → relation_not_allowed
→ target_not_visible → target_out_of_range → target_not_reachable.
Exact relation/life membership; each boolean gate is explicit. Both manual/AI
controllers may inspect perception; manual proposal restriction is preserved.
Results are deeply detached/frozen, preserve order/time, never select or mutate a
target/state, execute gameplay, inspect HP or query World/Spatial. L4 owns fact
truth/freshness; eligible means advisory filtering, never admission.

## v0.7.0 Actor AI Foundation — AI01–AI05

Additive root API: six functions / seven types; total **115 functions / 191 types**.
Existing signatures and behavior are preserved.

```ts
createActorAIProfileReference(input: ActorAIProfileReference): ActorAIProfileReference
createActorAIState(actor: EntitySnapshot, profile: ActorAIProfileReference,
  initial: ActorAIInitialState): ActorAIState
validateActorAIState(state: ActorAIState, entities: EntityCollection): ActorAIState
createActorAIDecisionContext(state: ActorAIState, decisionId: string): ActorAIDecisionContext
createActorAIActionIntent(context: ActorAIDecisionContext,
  input: {readonly actionKey: string; readonly targetEntityId: string | null}): ActorAIActionIntent
validateActorAIDecisionResult(state: ActorAIState, context: ActorAIDecisionContext,
  result: ActorAIDecisionResult): ActorAIDecisionResult
```

Public types: `ActorAIProfileReference` (profileId), `ActorAIControllerMode`
(manual | ai), `ActorAIInitialState` (controller, behaviorStateId),
`ActorAIState` (actorId, profileId, controller, behaviorStateId, targetEntityId),
`ActorAIDecisionContext` (decisionId, actorId), `ActorAIActionIntent`
(decisionId, actorId, actionKey, targetEntityId), `ActorAIDecisionResult`.
All fields are readonly; every returned record, including nested result intent,
is detached and frozen.

Creation validates canonical Entity, preserves exact nonblank IDs and starts with
targetEntityId:null. State validation requires the actor in canonical collection;
a stale nonblank target is permitted as a reference, never eligibility evidence.
Contexts require explicit decision IDs; intents accept opaque action keys and
nullable target references without action lookup or execution.
Result `proposed / none / intent` requires AI controller and exact actor/decision
bindings. `no_action / manual_control / null` requires manual controller;
`no_action / no_candidate / null` requires AI controller.
Malformed records, missing/extra/symbol/accessor/inherited fields, invalid IDs,
controllers or discriminator combinations throw TypeError without invoking getters.
Ordinary or null-prototype own-data records are supported.
These functions only validate structure; they do not evaluate AI or change state.
See [checkpoint report](reports/v0.7.0-actor-ai-foundation.md).

## v0.6.7-FIX01: explicit target-defeat cleanup

One additive function and two types: root109 functions /184 types. Historical
stack action unions, removal reasons and existing function behavior are unchanged.

```ts
export interface EffectTargetDefeatCleanupRequest { readonly defeatedAtMs: number }
export function cleanupDefeatedTargetEffects(
  lifecycle: EffectLifecycleState, periodic: EffectPeriodicState,
  targetLife: EntityLifeState, request: EffectTargetDefeatCleanupRequest,
  context: GameplayExecutionContext
): EffectTargetDefeatCleanupResult;
```

The result is `applied / none / action: target_defeated` with an empty canonical
lifecycle aligned at `defeatedAtMs`, and lexical instance-ID ordered
`removed / target_defeated` events at that time. Or it is `rejected`, null state,
empty events, and reason `target_alive`, `time_regressed`, `time_after_horizon`,
`pending_ticks_before_defeat` or `pending_expiration_before_defeat`.
All three existing companion transition functions accept this dedicated result;
no capture is allowed. Modifier/Status snapshots and Periodic entries become empty.

Caller supplies canonical dead Entity Life and the actual simulation death time
(lethal tick intent's `dueAtMs`, never automatically the current horizon).
Require `observedAtMs <= defeatedAtMs <= readExecutionTime(context)`.
Invalid shapes/nonfinite/negative time, wrong Life binding, invalid context or
misaligned periodic state throw TypeError. Earlier unresolved ticks/expiry reject;
same-time/future ticks are canceled. Cleanup takes precedence over same-time
expiration: one terminal removal per instance, no synthetic tick or expiry event.
Empty dead-target cleanup succeeds without events and aligns observation time.
Ordinary advancement/refresh/consume/group removal retain pending-tick guards.

L4 stages canonical Entity Resource/Life, completed cursor, cleanup and all three
companions before publishing one complete candidate against its current baseline.
Structural receipts/Life are caller evidence, not committed-persistence proofs;
there is no transaction manager or distributed exactly-once guarantee.
See [patch report](reports/v0.6.7-fix01-target-defeat-cleanup.md).

## v0.6.7 original closure checkpoint (historical)

No production behavior or public API additions/removals relative to v0.6.6:
108 root functions / 182 root types. EF36–EF40 is integration evidence, not a new
facade. Installed L4 callers compose the existing Effect application, canonical
lifecycle and Modifier/Status/Periodic companions with actual Entity Resource/Life,
Entity/Core stats and independent Skill/Combat admissions. L3 supplies fixed
amounts, modifier captures and generic restriction policy. All candidates stage
from the same baseline; a caller publishes the complete immutable local snapshot
only on success and only if that baseline is still current. Failure preserves the
pending tick. This is not database atomicity or distributed exactly-once proof.

See [final review report](reports/v0.6.7-effect-final-review.md) and PR #11 for final exact-head CI/readiness. Earlier checkpoint
statuses below are historical. Developer approval PENDING; no merge/tag/publish.
Concrete game profile behavior NOT_EVALUATED.

## EF31–EF35 Periodic Effects (v0.6.6)

Four functions/eight types, root-only; root108 functions/182 types. Earlier104
functions/174 types and all existing signatures remain unchanged. Public declarations:

```ts
export type EffectPeriodicCapture = {
    readonly mode: 'none';
} | {
    readonly mode: 'periodic';
    readonly kind: 'dot' | 'hot';
    readonly intervalMs: number;
    readonly resourceId: string;
};
export type EffectPeriodicEntry = {
    readonly effectInstanceId: string;
    readonly mode: 'none';
} | {
    readonly effectInstanceId: string;
    readonly mode: 'periodic';
    readonly kind: 'dot' | 'hot';
    readonly intervalMs: number;
    readonly resourceId: string;
    readonly nextTickAtMs: number;
};
/** Progress payload only; canonical lifecycle remains membership/lifetime authority. */
export interface EffectPeriodicState {
    readonly entityId: string;
    readonly observedAtMs: number;
    readonly entries: readonly EffectPeriodicEntry[];
}
export interface EffectPeriodicTickIntent {
    readonly effectInstanceId: string;
    readonly effectId: string;
    readonly targetEntityId: string;
    readonly kind: 'dot' | 'hot';
    readonly resourceId: string;
    readonly dueAtMs: number;
}
export type EffectPeriodicTickAssessment = {
    readonly status: 'due';
    readonly reason: 'none';
    readonly intent: EffectPeriodicTickIntent;
} | {
    readonly status: 'idle';
    readonly reason: 'none';
    readonly intent: null;
} | {
    readonly status: 'blocked';
    readonly reason: 'target_dead';
    readonly intent: null;
} | {
    readonly status: 'rejected';
    readonly reason: 'time_regressed';
    readonly intent: null;
};
export interface EffectPeriodicTickEvent {
    readonly type: 'tick-completed';
    readonly effectInstanceId: string;
    readonly effectId: string;
    readonly targetEntityId: string;
    readonly kind: 'dot' | 'hot';
    readonly atMs: number;
}
export type EffectPeriodicCompletionResult = {
    readonly status: 'applied';
    readonly reason: 'none';
    readonly state: EffectPeriodicState;
    readonly events: readonly EffectPeriodicTickEvent[];
} | {
    readonly status: 'rejected';
    readonly reason: 'stale_tick' | 'target_dead' | 'time_regressed';
    readonly state: null;
    readonly events: readonly [];
};
export type EffectPeriodicTransitionResult = {
    readonly status: 'applied';
    readonly reason: 'none';
    readonly state: EffectPeriodicState;
} | {
    readonly status: 'rejected';
    readonly reason: 'transition_rejected' | 'stale_transition' | 'capture_required' | 'pending_ticks';
    readonly state: null;
};
/** Empty initialization only; never reconstruct periodic history. */
export declare function createEffectPeriodicState(lifecycle: EffectLifecycleState): EffectPeriodicState;
/** Follow canonical receipts; refusing advancement across unresolved ticks preserves D15.
 * Non-addition capture is malformed, consistent with the other companion APIs.
 * L4 commits lifecycle and all companions together. Explicit removal may cancel future work.
 */
export declare function applyEffectPeriodicTransition(current: EffectPeriodicState, previousLifecycle: EffectLifecycleState, transition: EffectLifecycleStartResult | EffectLifecycleTransitionResult | EffectStackMutationResult, capture?: EffectPeriodicCapture): EffectPeriodicTransitionResult;
/** At most one intent, ordered by timestamp then lexical instance ID; no cursor or Entity mutation. */
export declare function getNextDueEffectTick(lifecycle: EffectLifecycleState, periodic: EffectPeriodicState, targetLife: EntityLifeState, context: GameplayExecutionContext): EffectPeriodicTickAssessment;
/** Cursor candidate only, never proof of numerical execution or a cross-request exactly-once guarantee.
 * targetLife is the pre-execution alive snapshot; L4 atomically commits the corresponding successful
 * Entity Resource/Life outcomes and cursor (or explicit defeat cleanup), then plans using updated Life.
 */
export declare function completeEffectPeriodicTick(lifecycle: EffectLifecycleState, periodic: EffectPeriodicState, intent: EffectPeriodicTickIntent, targetLife: EntityLifeState, context: GameplayExecutionContext): EffectPeriodicCompletionResult;
```

Every addition requires explicit capture, including mode:none. Initialization is
empty-only. Capture/entry/state/intent/Life records are closed own-data contracts;
arrays dense, one entry per canonical instance in the same order, same Entity/time.
Fields detach and freeze without freezing caller inputs. intervalMs must be finite
and positive; timestamp addition must be finite and strictly later. IDs opaque.
Malformed input throws TypeError; rejection never returns a candidate.

Periodic state owns only configuration/cursors, not instances or lifetimes.
First tick = canonical startedAtMs + intervalMs. A tick is eligible at due<=clock
and due<=expiresAtMs (inclusive); persistent effects have no expiry ceiling.
Planning returns one earliest timestamp, then lexical instance ID, with no mutation.
Clock is caller-supplied Foundation time, read once per plan/completion. Regressed
time rejects; dead target blocks, including HoT. No automatic revive or source-death
cleanup. Finish one tick before planning another with updated Life.

Completion validates the exact earliest due intent, advances only that cursor by
one interval and emits metadata at scheduled dueAtMs. Duplicate/out-of-order/too-early
completion is stale_tick. Completion uses the pre-execution alive Life snapshot;
L4 must first execute actual Entity Resource transition and Entity defeat resolution,
then atomically commit their successful candidates with the cursor (or defeat cleanup).
The completion API cannot authenticate Entity execution or current authority.
Reusing an old structural state is not a cross-request exactly-once guarantee.
Never commit a cursor after failed execution; retry the same intent from unchanged state.
Successful zero-effective HoT still completes. Applied magnitude comes from Core's
Resource result, never abs(after-before), especially for above-maximum normalization.

applyEffectPeriodicTransition consumes the existing canonical lifecycle/stack receipts
through the shared private companion validator. New capture required; refresh preserves
capture/cadence; consume/remove/expire prune exactly corresponding entries. It rejects
pending_ticks if advancement crosses an unresolved eligible tick, even on expiry.
Drain all due ticks, then advance/expire and commit lifecycle plus modifier/status/
periodic companions together. Explicit removal/defeat cleanup at the previous canonical
boundary may cancel future work without fake numerical receipts. Capture on a
non-addition throws TypeError, matching other companions. Receipts are structural,
not authenticated persistence/concurrency proofs; L4 owns freshness and atomic commit.

L3 supplies periodic configuration and fixed pre-resolved nonnegative tick amount.
L4 executes dot via Entity decrease, hot via Entity increase with explicit rules;
Entity/Core own numerical bounds/applied magnitude and Entity owns Life. No attack
resolution, formula scaling/resistance, timers, hidden RNG, scheduler or new runtime.
v0.6.7 NOT_STARTED; phase IN_PROGRESS; Developer acceptance PENDING.

## EF26–EF30 Effect Restrictions & Status (v0.6.5)

Five functions/eight types, root-only. IDs are opaque nonblank exact/case-sensitive
strings with no interpretation, defaults or registry. Both capture arrays required,
empty allowed, duplicates within each array rejected. The same identity across
instances retains all contributor provenance. Values/order detach and freeze;
closed own-data records/dense arrays reject accessors without invoking getters.

createEffectStatusState requires empty canonical lifecycle. Status state contains
entityId/observedAtMs/snapshots only, not instances or embedded lifecycle. Every
query/assessment validates Entity/time/order and one snapshot per active instance,
including strict unresolved-expiry rejection. Queries never advance lifecycle.
Status views use first-appearance order; restriction views use canonical instance
then capture order, resolving effectId from the lifecycle.

applyEffectStatusTransition(current, previousLifecycle, transition, capture?)
consumes actual EF12–EF20 results and validates canonical deltas through the same
private validator as modifiers. New appended instance requires explicit capture,
even empty. Refresh/no-membership changes preserve snapshots; cleanup follows
exact removed membership. All outputs detached/frozen. Rejected canonical receipts
return transition_rejected/null, mismatched delta baseline stale_transition/null,
missing new capture capture_required/null. Malformed values and capture on
refresh/another non-addition throw TypeError, as in the accepted modifier API;
the proposed capture_not_allowed outcome is finalized as this malformed-input
rule, not an unused union placeholder. Receipts do not authenticate freshness.

L4 must coordinate modifier/status candidates from the same previous lifecycle
and commit all with the canonical next lifecycle, or commit none. Companion
validation cannot prove authoritative freshness for equivalent structural history;
L4 owns current authority/concurrency. No second lifetime/transaction manager.

evaluateEffectRestrictionGate exact-matches caller blockedByRestrictionIds and
returns allowed/none/[] or blocked/active_restriction/all matching provenance.
It does not authorize a Skill, Combat action or Effect. L4 must first bind
assessment.entityId to the actor or target being assessed, then AND its existing
eligibility with assessment.status === 'allowed', and call the existing canonical
admission. Skill owned/rank/life and Combat source/target checks remain independent.
CombatTargetPolicy relation/life fields are not a generic immunity API. Any future
target-restriction API is a separate capability gap, not implemented here.

Public declarations:

```ts
/** Opaque, case-sensitive L3 identities; no built-in status/restriction vocabulary. */
export interface EffectStatusCapture {
    readonly statusIds: readonly string[];
    readonly restrictionIds: readonly string[];
}
export interface EffectStatusSnapshot extends EffectStatusCapture {
    readonly effectInstanceId: string;
}
/** Payload index only. Active membership is supplied separately by the canonical lifecycle. */
export interface EffectStatusState {
    readonly entityId: string;
    readonly observedAtMs: number;
    readonly snapshots: readonly EffectStatusSnapshot[];
}
export interface EffectStatusView {
    readonly statusId: string;
    readonly effectInstanceIds: readonly string[];
}
export interface EffectRestrictionView {
    readonly effectInstanceId: string;
    readonly effectId: string;
    readonly restrictionId: string;
}
export interface EffectRestrictionPolicy {
    readonly blockedByRestrictionIds: readonly string[];
}
/** Restriction assessment only; never full Skill/Combat/Effect authorization. */
export interface EffectRestrictionAssessment {
    readonly entityId: string;
    readonly status: 'allowed' | 'blocked';
    readonly reason: 'none' | 'active_restriction';
    readonly matches: readonly EffectRestrictionView[];
}
export type EffectStatusTransitionResult = {
    readonly status: 'applied';
    readonly reason: 'none';
    readonly state: EffectStatusState;
} | {
    readonly status: 'rejected';
    readonly reason: 'transition_rejected' | 'stale_transition' | 'capture_required';
    readonly state: null;
};
/** Empty initialization only; no historical capture backfill. */
export declare function createEffectStatusState(lifecycle: EffectLifecycleState): EffectStatusState;
/** Follow validated canonical membership deltas, without executing another lifetime or admission engine.
 * L4 must atomically commit all companions with the same lifecycle candidate.
 * A replacement capture on refresh or another non-addition is malformed (TypeError).
 */
export declare function applyEffectStatusTransition(current: EffectStatusState, previousLifecycle: EffectLifecycleState, transition: EffectLifecycleStartResult | EffectLifecycleTransitionResult | EffectStackMutationResult, capture?: EffectStatusCapture): EffectStatusTransitionResult;
/** First-appearance status order and canonical contributor order, with no counters or caches. */
export declare function listActiveEffectStatuses(lifecycle: EffectLifecycleState, state: EffectStatusState): readonly EffectStatusView[];
/** Per-instance provenance; effectId comes exclusively from canonical membership. */
export declare function listActiveEffectRestrictions(lifecycle: EffectLifecycleState, state: EffectStatusState): readonly EffectRestrictionView[];
/** Exact caller-selected identities only. L3 interprets meaning; L4 composes existing admission policies. */
export declare function evaluateEffectRestrictionGate(lifecycle: EffectLifecycleState, state: EffectStatusState, policy: EffectRestrictionPolicy): EffectRestrictionAssessment;
```

Root104 functions/174 types. EF01–EF25 public declarations preserved. D01–D18,
Core pin, protected owners and graph unchanged; DoT/HoT/Closure deferred. Phase
IN_PROGRESS, acceptance PENDING. Earlier API sections describe historical scopes.

## EF21–EF25 Buff / Debuff & Stat Modifiers (v0.6.4)

`createEffectModifierState(lifecycle)` initializes an empty canonical lifecycle
only. `applyEffectModifierTransition(current, transition, capture?)` consumes
EF12–EF20 result values, validates entity/survivor/order/lifetime/event/membership
deltas and returns a frozen candidate. Exactly one newly appended instance needs
an explicit capture, including zero modifiers; refresh/advance/remove/consume
cannot receive a new capture (TypeError). Rejected canonical result maps to
transition_rejected/null; mismatched baseline to stale_transition/null; missing
new-instance capture to capture_required/null. Malformed structures throw
TypeError. The proposed capture_not_allowed result reason is finalized as TypeError
for every non-addition capture, preserving the approved refresh rule. These are
structural values, not authorization tokens; L4 supplies current authority/commit.

Snapshot classification is metadata: buff/debuff/neutral do not infer signs or
change calculation. Specs use actual Core ModifierOperation, finite values and
explicit enabled; modifierId is unique within an instance. Closed own-data records
and dense arrays reject extra/missing/inherited/accessor fields without invoking
getters. Values/order/IDs are exact, detached and deeply frozen. Lifecycle stays
the single instance owner; one ordered snapshot must match every active instance.
No backfill of unknown history, cached stats or implicit synchronization.

`listActiveEffectModifiers(state)` projects frozen detached Core NumericalModifier[]
in canonical instance/spec order with identity `effect / effectInstanceId / modifierId`.
Disabled entries remain disabled; Core owns filtering, conflicts and equivalent
dedup. Due-but-unresolved lifetimes reject projection; advance canonical lifecycle
first. Refresh preserves captures; expire/remove/consume/group cleanup prune them.
Entity owns target catalogs and stat calculation. No new stat helper or math.

```ts
import {listActiveEffectModifiers, calculateEntityStats} from '@rpg/gameplay';
// L4: one canonical modifier input, never also inject into flatContributions.
const modifiers = [...equipmentModifiers, ...listActiveEffectModifiers(effectState)];
const effective = calculateEntityStats(attributes, {...statConfiguration, modifiers});
```

Public additions (Core types imported from @rpg/core/kernel):

```ts
/** L3 metadata only; classification never changes numerical semantics. */
export type EffectClassification = 'buff' | 'debuff' | 'neutral';
export interface EffectModifierSpec {
    readonly modifierId: string;
    readonly target: string;
    readonly operation: ModifierOperation;
    readonly value: number;
    readonly enabled: boolean;
}
export interface EffectModifierCapture {
    readonly classification: EffectClassification;
    readonly modifiers: readonly EffectModifierSpec[];
}
export interface EffectModifierSnapshot extends EffectModifierCapture {
    readonly effectInstanceId: string;
}
/** Payload companion; lifecycle remains the only active instance authority. */
export interface EffectModifierState {
    readonly lifecycle: EffectLifecycleState;
    readonly snapshots: readonly EffectModifierSnapshot[];
}
export type EffectModifierTransitionResult = {
    readonly status: 'applied';
    readonly reason: 'none';
    readonly state: EffectModifierState;
} | {
    readonly status: 'rejected';
    readonly reason: 'transition_rejected' | 'stale_transition' | 'capture_required';
    readonly state: null;
};
/** Never fabricate payload history for already-active instances. */
export declare function createEffectModifierState(lifecycle: EffectLifecycleState): EffectModifierState;
/** Associate payloads with validated canonical deltas; never execute lifecycle/stack policy here.
 * Structural receipts are not authorization tokens. L4 owns freshness and commit.
 * Capture on an existing-instance transition is malformed and throws TypeError.
 */
export declare function applyEffectModifierTransition(current: EffectModifierState, transition: EffectLifecycleStartResult | EffectLifecycleTransitionResult | EffectStackMutationResult, capture?: EffectModifierCapture): EffectModifierTransitionResult;
/** Structural projection only. Core owns enabled filtering, identity resolution and all math. */
export declare function listActiveEffectModifiers(state: EffectModifierState): readonly NumericalModifier[];
```

Prior EF01–EF20 APIs and root-only package boundary remain unchanged. Root inventory:
99 runtime functions /166 types. Restrictions/DoT/HoT remain deferred; phase
IN_PROGRESS, Developer acceptance PENDING. Earlier API sections are historical.

## v0.6.3 Effect Stacking & Refresh (EF16–EF20)

Six root functions in the same optional Effect owner; EF01–EF15 schemas/signatures
and existing removal/event unions are unchanged.

```ts
export interface EffectStackGroupKey {
  readonly targetEntityId: string;
  readonly effectId: string;
  readonly sourceKey: string;
}
/** Derived view, never an additional active instance collection or policy store. */
export interface EffectStackGroupView {
  readonly key: EffectStackGroupKey;
  readonly source: EffectSourceReference;
  readonly instanceIds: readonly string[];
  readonly stackCount: number;
}
export type EffectStackPolicy =
  | {readonly mode: 'refresh'; readonly maxStacks: 1}
  | {readonly mode: 'stack'; readonly maxStacks: number};
export type EffectStackRejectionReason = 'application_rejected' | 'stale_application'
  | 'lifecycle_not_advanced' | 'time_regressed' | 'pending_expiry' | 'source_identity_conflict'
  | 'group_policy_conflict' | 'max_stacks_reached' | 'duration_mode_conflict'
  | 'persistent_already_present' | 'effect_not_found' | 'not_timed' | 'group_not_found' | 'insufficient_stacks';
export type EffectStackAdmissionResult =
  | {readonly status: 'admitted'; readonly reason: 'none'; readonly operation: 'add' | 'refresh'; readonly group: EffectStackGroupKey}
  | {readonly status: 'rejected'; readonly reason: EffectStackRejectionReason; readonly operation: null; readonly group: EffectStackGroupKey};
export interface EffectStackConsumeRequest {readonly group: EffectStackGroupKey; readonly count: number}
export interface EffectStackConsumedEvent {
  readonly type: 'stack-consumed';
  readonly group: EffectStackGroupKey;
  readonly consumedInstanceIds: readonly string[];
  readonly remainingStacks: number;
  readonly atMs: number;
}
export type EffectStackEvent = EffectLifecycleEvent | EffectStackConsumedEvent
  | {readonly type: 'refreshed'; readonly effectInstanceId: string; readonly effectId: string;
      readonly targetEntityId: string; readonly atMs: number; readonly expiresAtMs: number};
export type EffectStackMutationResult =
  | {readonly status: 'applied'; readonly reason: 'none'; readonly action: 'added' | 'refreshed' | 'consumed' | 'group_removed';
      readonly state: EffectLifecycleState; readonly events: readonly EffectStackEvent[]}
  | {readonly status: 'rejected'; readonly reason: EffectStackRejectionReason; readonly state: null; readonly events: readonly []};
function inspectEffectStackGroups(lifecycle: EffectLifecycleState): readonly EffectStackGroupView[];
function evaluateEffectStackAdmission(lifecycle: EffectLifecycleState, application: EffectApplyResult,
  duration: EffectDuration, policy: EffectStackPolicy, context: GameplayExecutionContext): EffectStackAdmissionResult;
function applyEffectStack(lifecycle: EffectLifecycleState, application: EffectApplyResult,
  duration: EffectDuration, policy: EffectStackPolicy, context: GameplayExecutionContext): EffectStackMutationResult;
function refreshEffectStackLifetime(lifecycle: EffectLifecycleState, effectInstanceId: string,
  duration: EffectDuration, context: GameplayExecutionContext): EffectStackMutationResult;
function consumeEffectStacks(lifecycle: EffectLifecycleState, request: EffectStackConsumeRequest): EffectStackMutationResult;
function removeEffectStackGroup(lifecycle: EffectLifecycleState, group: EffectStackGroupKey,
  reason: EffectRemovalReason): EffectStackMutationResult;
```

D06 key is exact targetEntityId/effectId/sourceKey. Groups preserve first appearance
and instance input order; stackCount derives from IDs. Same-group existing origins
must match source.kind/sourceId or throw TypeError. Incoming collisions reject
source_identity_conflict. Opaque case-sensitive IDs and __proto__/constructor work.
Views are detached and deeply frozen; no maxStacks/policy is persisted.

Policies are closed own-data: refresh/maxStacks1 or stack/positive-safe-integer.
Stack/1 rejects a second stack; refresh/1 renews an existing timed anchor. Both add
to an empty group. Accepted EF09 candidate must match the entire ordered current
EffectState plus exactly one incoming instance. It is a structural receipt, not
an authenticated token; L4 owns freshness/concurrency/commit.

All structure, groups, application, duration, policy, Foundation context and expiry
arithmetic validate before ordinary rejection. Priority: application_rejected,
stale_application, time_regressed, lifecycle_not_advanced, pending_expiry,
source_identity_conflict, group_policy_conflict, duration_mode_conflict,
persistent_already_present, max_stacks_reached. Assessment returns no candidate.
Time-sensitive calls read the supplied clock exactly once. Addition shares EF12's
canonical private implementation; no additional clock/provider is manufactured.

Refresh preserves the original instance and startedAtMs; expiry becomes
max(previousExpiry, now+duration). Overflow/precision loss throws TypeError before
rejection. Automatic refresh with multiple anchors rejects group_policy_conflict;
different duration modes reject duration_mode_conflict; existing persistent plus
persistent rejects persistent_already_present. Explicit renewal requires a timed
existing lifetime and timed duration (otherwise not_timed); missing ID rejects
effect_not_found. Persistent stacks retain null expiry and stack within capacity.

Mutation boundaries reject due membership at observedAtMs as pending_expiry,
without hidden expiration. A caller must advance the last valid canonical snapshot
through EF13 and rebuild its EF09 receipt; manually editing observedAtMs is not
advancement. Earlier EF11–EF15 keep their strict active-snapshot validation.
Inspection can describe due membership but never resolves it.

Consume validates exact group/positive safe count and removes exactly N or rejects
insufficient_stacks/group_not_found. Selection: earliest timed deadline, code-unit
lexical ID ties, persistent last with lexical ties. Survivors preserve input order.
One stack-consumed event carries selected IDs/remaining count; no fake removed
reason. Whole-group removal coordinates EF14, returning one removed event per
instance in the same deterministic selection order and caller-supplied reason.
Consume/remove read no clock and operate at observedAtMs; all rejections return
state:null/events:[]. No event publication, numerical changes or automatic commit.

L3 owns policy; L4 must keep policy consistent. Detectable conflicts are rejected,
but arbitrary historical policy changes cannot be inferred without a catalog.
No modifier aggregation, restrictions, periodic intents, scheduler or second store.

## v0.6.2 Effect Duration & Lifecycle (EF11–EF15)

Four new root functions; EF01–EF10 schemas/signatures remain unchanged:

```ts
type EffectDuration =
  | {readonly mode: 'timed'; readonly durationMs: number}
  | {readonly mode: 'persistent'};
/** Timing references only; the embedded EffectState remains the sole instance collection. */
interface EffectLifetimeState {
  readonly effectInstanceId: string;
  readonly mode: 'timed' | 'persistent';
  readonly startedAtMs: number;
  readonly expiresAtMs: number | null;
}
interface EffectLifecycleState {
  readonly effectState: EffectState;
  readonly lifetimes: readonly EffectLifetimeState[];
  readonly observedAtMs: number;
}
type EffectRemovalReason = 'explicit' | 'dispel' | 'target_defeated' | 'source_removed' | 'session_cleanup';
type EffectLifecycleEvent =
  | {readonly type: 'started'; readonly effectInstanceId: string; readonly effectId: string;
      readonly targetEntityId: string; readonly atMs: number}
  | {readonly type: 'expired'; readonly effectInstanceId: string; readonly effectId: string;
      readonly targetEntityId: string; readonly atMs: number}
  | {readonly type: 'removed'; readonly effectInstanceId: string; readonly effectId: string;
      readonly targetEntityId: string; readonly atMs: number; readonly reason: EffectRemovalReason};
type EffectLifecycleStartResult =
  | {readonly status: 'started'; readonly reason: 'none'; readonly state: EffectLifecycleState;
      readonly events: readonly EffectLifecycleEvent[]}
  | {readonly status: 'rejected'; readonly reason: 'application_rejected' | 'stale_application'
      | 'lifecycle_not_advanced' | 'time_regressed'; readonly state: null; readonly events: readonly []};
type EffectLifecycleTransitionResult =
  | {readonly status: 'applied'; readonly reason: 'none'; readonly state: EffectLifecycleState;
      readonly events: readonly EffectLifecycleEvent[]}
  | {readonly status: 'rejected'; readonly reason: 'effect_not_found' | 'time_regressed';
      readonly state: null; readonly events: readonly []};
function createEffectLifecycleState(state: EffectState, context: GameplayExecutionContext): EffectLifecycleState;
function startEffectLifetime(lifecycle: EffectLifecycleState, application: EffectApplyResult,
  duration: EffectDuration, context: GameplayExecutionContext): EffectLifecycleStartResult;
function advanceEffectLifecycle(lifecycle: EffectLifecycleState,
  context: GameplayExecutionContext): EffectLifecycleTransitionResult;
function removeEffectLifetime(lifecycle: EffectLifecycleState, effectInstanceId: string,
  reason: EffectRemovalReason): EffectLifecycleTransitionResult;
```

Initialization requires an empty EffectState; populated structural instances have
no history to infer. Foundation readExecutionTime supplies finite nonnegative
milliseconds, once per initialize/start/advance. No epoch assumption or default clock.
Removal uses observedAtMs without reading time.

There is one canonical embedded EffectState. Lifetimes contain IDs/timing only,
exactly one per instance in matching order. Active lifetime start <= observedAtMs;
timed expiry > start and > observedAtMs; persistent expiry is exactly null. All
records are closed own-data snapshots; sparse/extra/accessor/symbol/inherited
required fields, duplicate/orphaned IDs and wrong associations throw TypeError
without invoking getters. Inputs remain caller-owned and unfrozen.

Timed duration is positive finite milliseconds, including fractions. Expiry is
now + duration without rounding/clamping; overflow or representational loss that
makes expiry <= now throws. Persistent carries no durationMs. No instant mode.

Start validates the complete lifecycle, application, duration, Foundation context
and expiry arithmetic before rejection. Applied/none must have admitted/none and
a candidate ending in the exact validated request instance. Valid rejected EF09
results have rejected matching non-none admission reason and null state.
Candidate baseline comparison uses every ordered instance field/source field,
not references: same target, unchanged full prefix and exactly one appended ID.
Malformed result consistency throws; a valid candidate from another baseline
returns stale_application without merge. Inputs are assessments, not credentials.
Rejection priority after validation: time_regressed, lifecycle_not_advanced,
application_rejected, stale_application. Newer time requires explicit advance.

Advance requires now >= observedAtMs. Expiry <= now removes timed instances and
their lifetime metadata together. Events sort by actual deadline then lexical
instance ID (code-unit string comparison, no locale); atMs is deadline even when
observation is delayed. Survivors preserve input order. Persistent never expires;
same-time repeat returns applied/none with no repeated terminal events. D15:
future due periodic intent belongs before this expiration boundary; no ticks now.

Remove affects one exact ID only, with an explicit reason at observedAtMs.
Unknown/already removed/expired IDs reject effect_not_found, with no terminal
event. Source death never triggers cleanup; target defeat cleanup is requested by
L4. Events are returned values, never published. Successful results are detached
and deeply frozen; rejected results always state=null/events=[]. No resources,
life, stats, ranks, Skill or Combat state is changed. No scheduler/active store,
stack/refresh, modifiers, restrictions or periodic execution.

## v0.6.1 Effect Application & Admission (EF06–EF10)

Two root functions take the same complete, explicit context:

```ts
interface EffectApplyRequest {readonly instance: EffectInstanceState}
interface EffectApplyPolicy {
  readonly sourceEligible: boolean;
  readonly targetEligible: boolean;
  readonly allowedTargetLifeStatuses: readonly EntityLifeStatus[];
}
type EffectApplyAdmissionStatus = 'admitted' | 'rejected';
type EffectApplyAdmissionReason = 'none' | 'source_not_found' | 'target_not_found'
  | 'target_life_not_allowed' | 'source_ineligible' | 'target_ineligible'
  | 'instance_already_present';
interface EffectApplyAdmissionResult {
  readonly request: EffectApplyRequest;
  readonly status: EffectApplyAdmissionStatus;
  readonly reason: EffectApplyAdmissionReason;
}
type EffectApplyResult =
  | {readonly status: 'applied'; readonly reason: 'none';
      readonly admission: EffectApplyAdmissionResult; readonly state: EffectState}
  | {readonly status: 'rejected'; readonly reason: Exclude<EffectApplyAdmissionReason, 'none'>;
      readonly admission: EffectApplyAdmissionResult; readonly state: null};
function evaluateEffectApplyAdmission(definition: EffectDefinition, request: EffectApplyRequest,
  state: EffectState, entities: EntityCollection, targetLife: EntityLifeState,
  policy: EffectApplyPolicy): EffectApplyAdmissionResult;
function applyEffect(definition: EffectDefinition, request: EffectApplyRequest,
  state: EffectState, entities: EntityCollection, targetLife: EntityLifeState,
  policy: EffectApplyPolicy): EffectApplyResult;
```

All records are closed own-data contracts. Full structural validation and exact
Definition/Instance/State/Life identity binding precede ordinary rejection.
allowedTargetLifeStatuses must be nonempty, dense, unique alive/dead values; there
is no implicit alive policy. Malformed input throws TypeError without getters.
Entity sources and targets use canonical getEntity; systems never require a fake
Entity. Source life/permission and target relations remain caller eligibility.
Reason priority is the order above, with none last; admitted iff reason=none.

applyEffect reevaluates admission (no receipt input), appends an accepted instance
in supplied state order and returns a detached deeply frozen candidate. Rejection
always returns state=null; previous inputs stay unchanged/unfrozen. Duplicate IDs
are checked only in the supplied target state, including retries with conflicting
payloads. Different IDs for the same effect are allowed; no stacking is implied.

L3 supplies policies. L4 resolves current authoritative context and decides commit,
concurrency/freshness/retry semantics. Eligibility booleans and admission snapshots
are assertions, not credentials. Applied means admitted into a structural candidate;
it does not activate duration/modifiers/ticks, emit events or alter resources/life.
EF01–EF05 signatures remain unchanged. Earlier milestone sections are historical.

## v0.6.0 Effect Foundation (EF01–EF05)

Root-only additions, with readonly public records:

```ts
type EffectSourceReference =
  | {readonly kind: 'entity'; readonly sourceId: string; readonly sourceKey: string}
  | {readonly kind: 'system'; readonly sourceId: string; readonly sourceKey: string};
interface EffectDefinition {readonly effectId: string}
interface EffectInstanceInitialState {
  readonly effectInstanceId: string;
  readonly source: EffectSourceReference;
}
interface EffectInstanceState extends EffectInstanceInitialState {
  readonly effectId: string;
  readonly targetEntityId: string;
}
interface EffectState {
  readonly entityId: string;
  readonly instances: readonly EffectInstanceState[];
}
function createEffectDefinition(definition: EffectDefinition): EffectDefinition;
function createEffectInstance(definition: EffectDefinition, target: EntitySnapshot,
  initial: EffectInstanceInitialState): EffectInstanceState;
function createEffectState(target: EntitySnapshot): EffectState;
function validateEffectState(state: EffectState): EffectState;
```

All outputs are detached and deeply frozen. IDs are caller-supplied, nonblank,
opaque strings, preserved exactly. Closed own-data records reject missing/extra,
symbol, accessor and inherited required fields with TypeError without invoking
getters. Instance arrays must be dense own-data arrays without extra properties.
State validation preserves order, requires unique effectInstanceId per state and
exact targetEntityId === entityId; repeated effectId/sourceKey are allowed.
Factories reuse public createEntity for target validation. Sources are structural
references: entity/system only, with no lookup, life, authorization or ownership
checks. Equipment can use entity sourceId plus equipment-instance sourceKey.

```ts
const definition = createEffectDefinition({effectId: 'poison'});
const target = {id: 'monster-1', kind: 'monster'};
const instance = createEffectInstance(definition, target, {
  effectInstanceId: 'effect-instance-001',
  source: {kind: 'entity', sourceId: 'player-1', sourceKey: 'equipment/sword-instance-001'},
});
const state = validateEffectState({entityId: target.id, instances: [instance]});
```

This is immutable structural state, without applied/active semantics, insertion,
registry, duration, stacking, modifiers, restrictions or execution. L3 owns content;
L4 allocates/resolves identities and retains authoritative state. Existing APIs
remain unchanged. Historical milestone sections below retain their original scope.

# Public API — v0.5.6 (GF01–GF16, EC01–EC18, PG01–PG19, CB01–CB30, SK01–SK35)

Import types/functions only from `@rpg/gameplay`. Native ESM; deep exports closed.
Canonical owners: `src/foundation/modules/index.ts` (GF01–GF05),
`src/foundation/runtime/index.ts` (GF06–GF09), and
`src/foundation/messaging/index.ts` (GF10–GF13) and
`src/foundation/execution/index.ts` (GF14–GF16). No classes, Core numerical wrappers,
persistence or global gameplay state. Module contracts below remain unchanged.

## Contracts

```ts
interface GameplayModuleDefinition {
  readonly id: string;
  readonly optional: boolean;
  readonly dependencies: readonly string[];
}
interface ModuleRegistry {
  readonly definitions: readonly GameplayModuleDefinition[];
}
interface ModuleSelection {
  readonly enable?: readonly string[];
  readonly disable?: readonly string[];
}
interface ModuleConfiguration {
  readonly enabledModuleIds: readonly string[];
}
interface ModuleComposition {
  readonly moduleIds: readonly string[];
  readonly definitions: readonly GameplayModuleDefinition[];
}
```

Registry/configuration types describe public readonly snapshots, not internal
maps or stores. Use the functions below to create state. Function-produced state,
its arrays and definitions are frozen at runtime; definitions and selections are
detached from caller inputs. Unchanged immutable definitions can be shared across
registry versions. No hidden shared mutable state. No optional metadata beyond
the required identity/optional/dependency fields is needed in this version.

## Functions

| Function | Result and failure semantics |
| --- | --- |
| `validateModuleDefinition(value: unknown)` | Returns a detached frozen `GameplayModuleDefinition`; rejects malformed input with `TypeError` |
| `createModuleRegistry()` | New empty `ModuleRegistry` |
| `registerModule(registry, definition)` | New registry containing a validated snapshot, appended in registration order; invalid or duplicate ID throws `TypeError`, original unchanged |
| `getModule(registry, id)` | Exact lookup, frozen definition or `undefined`; creates nothing |
| `listModules(registry)` | Frozen definitions in registration order |
| `configureModules(registry, selection = {})` | New frozen `ModuleConfiguration`; invalid selection throws `TypeError` |
| `isModuleEnabled(configuration, id)` | Boolean selection query; unknown or unselected ID returns `false` |
| `resolveModuleDependencies(registry, configuration)` | Frozen dependency-first selected IDs; invalid configuration/selected graph throws `TypeError` |
| `composeModules(registry, configuration)` | Frozen `ModuleComposition`; calls the canonical resolver and adds corresponding frozen definitions |

IDs follow the existing Harness lowercase kebab-case convention:
`[a-z][a-z0-9]*(?:-[a-z0-9]+)*`, with no whitespace or normalization. `optional`
must be boolean; `dependencies` must be an array of valid unique IDs excluding
self. Missing required fields are rejected. Unknown extra definition properties
are omitted from the canonical snapshot. Dependency registration, cycles and
graph validity are not checked during registration; the resolver checks the
selected graph (GF04).

Selection lists must contain valid registered unique IDs. Omitted lists are
empty; malformed lists, unknown IDs, overlap between enable/disable and disabling
a required module throw `TypeError` with a diagnostic message. Optional modules
default disabled; required modules default enabled. Enabling a required module
is permitted. Each configuration starts from these defaults; disabling an
optional module keeps it unselected. Configurations are independent snapshots,
not runtime toggles. `enabledModuleIds` always follows registry registration
order, regardless of input selection/dependency order. Registering more modules
does not change prior configurations.

Dependency declarations never auto-enable or execute modules. A selected module
may have unregistered or unselected dependencies in a configuration. Selection expresses
intent, not a runnable graph. No feature module is included by default.

The consumer registry is separate from `harness/modules.json`, which describes
static repository source ownership/dependencies and retains its existing checks.

## Dependency resolution and composition (GF04–GF05)

Pass a registry created by the public registry functions. Configuration must be
an object with an array of valid, unique, registered `enabledModuleIds`, including
all required modules. A configuration predating a newly registered required
module is rejected. Malformed IDs, unknown IDs and missing required modules
throw `TypeError`.

Only selected modules are traversed. Each dependency must be registered and
selected; errors identify the dependent and dependency. Selected cycles throw
`TypeError` with a cycle path. Unknown dependencies/cycles confined to disabled
modules are ignored. Empty valid selections produce empty results.

The resolver returns exactly the selected IDs once each, dependencies first.
At every step it chooses the earliest registered currently ready module,
including modules that have just become ready. Selection array order and
dependency declaration order do not set this priority. Inputs and configuration
registration order remain unchanged. No partial result escapes a failure.

Composition calls this resolver and returns `moduleIds` plus corresponding
`definitions` in the same order. Both arrays and the object are frozen; sharing
already frozen registry definitions is safe. Results are detached from mutable
configuration arrays and unaffected by later registrations/calls. No cache,
auto-enablement, initialization, hooks or execution occurs.

## Runtime context and lifecycle (GF06–GF09)

Additional public functions (root export only):

| Function | Result |
| --- | --- |
| `createGameplayRuntime(composition, lifecycleBindings = {})` | Opaque frozen `GameplayRuntime`, initially created; no hooks run |
| `initializeGameplayRuntime(runtime)` | `LifecycleTransitionResult`, dependencies first |
| `startGameplayRuntime(runtime)` | `LifecycleTransitionResult`, dependencies first |
| `stopGameplayRuntime(runtime)` | `LifecycleTransitionResult`, reverse order |
| `disposeGameplayRuntime(runtime)` | `LifecycleTransitionResult`, eligible initialized modules in reverse order |
| `inspectGameplayRuntime(runtime)` | Frozen `GameplayRuntimeSnapshot`, deterministic and without hooks |

New public types: `GameplayRuntime`, `RuntimeStatus`, `LifecycleStage`,
`LifecycleFailure`, `ModuleLifecycleSnapshot`, `GameplayRuntimeSnapshot`,
`LifecycleContext`, `ModuleLifecycleBindings`, `LifecycleBindings`,
`LifecycleTransitionResult`. Private helpers/execution data are not exported.

```ts
type RuntimeStatus = 'created' | 'initialized' | 'running' | 'stopped' | 'disposed' | 'failed';
type LifecycleStage = 'initialize' | 'start' | 'stop' | 'dispose';
interface LifecycleFailure {
  readonly moduleId: string;
  readonly stage: LifecycleStage;
  readonly message: string;
}
interface ModuleLifecycleSnapshot {
  readonly id: string;
  readonly status: RuntimeStatus;
  readonly completedStages: readonly LifecycleStage[];
  readonly failure?: LifecycleFailure;
}
interface GameplayRuntimeSnapshot {
  readonly status: RuntimeStatus;
  readonly moduleIds: readonly string[]; // selected and resolved order
  readonly modules: readonly ModuleLifecycleSnapshot[]; // same order
  readonly failure?: LifecycleFailure;
}
interface LifecycleContext {
  readonly moduleId: string;
  readonly stage: LifecycleStage;
  readonly runtime: GameplayRuntimeSnapshot; // immediately before current hook
}
type ModuleLifecycleBindings = Readonly<Partial<Record<LifecycleStage, (context: LifecycleContext) => void>>>;
type LifecycleBindings = Readonly<Record<string, ModuleLifecycleBindings>>;
type LifecycleTransitionResult =
  | { readonly ok: true; readonly runtime: GameplayRuntime }
  | { readonly ok: false; readonly runtime: GameplayRuntime; readonly failure: LifecycleFailure };
```

Creation accepts GF05 composition data and defensively snapshots it. Canonical
`validateModuleDefinition` checks each definition; IDs/definitions must match
exactly, have no duplicates, and every dependency must already precede its
dependent. A single ordered scan checks these invariants without producing a
new order, calling registration/selection or duplicating GF04 graph resolution.
Malformed compositions throw `TypeError`; no runtime or hooks are created.

Bindings are caller-provided own properties keyed only by selected IDs. Unknown
IDs/stages, malformed binding objects and non-function hooks reject. Explicit
undefined hooks are absent. Binding tables are detached/frozen; callbacks and
their captured external resources remain caller-owned. Hook context contains
only module ID, stage and frozen lifecycle inspection data, with no implicit
clock, RNG, game state or application services. Absent hooks still complete a
stage. Disabled modules cannot be bound, invoked or inspected as selected.

| Operation | Allowed input status | Successful output status |
| --- | --- | --- |
| initialize | created | initialized |
| start | initialized | running |
| stop | running | stopped |
| dispose | created, initialized, stopped, failed | disposed |

Dispose while running is rejected; stop first. Created disposal invokes no
cleanup hooks, leaving never-initialized module statuses created. Disposing
initialized state does not require start. Empty compositions follow all normal
transitions without default modules. Restart/reinitialize are unsupported.

Malformed/forged runtimes and illegal transitions throw `TypeError` before hooks.
Each runtime snapshot is an execution capability that advances once. Always use
`result.runtime` for the next operation; replaying a consumed snapshot (including
reentrant calls from its hook) rejects before invoking hooks. Its inspection
snapshot stays unchanged forever. A small per-snapshot closure guards execution;
its record is associated privately by identity, never stored on the public object.
JavaScript reflection exposes no internal bindings or execution mutators. There
is no global gameplay store or singleton. Concurrent independent runtimes share no
framework progress, even when created from the same composition.

Hooks must return undefined synchronously. A throw, Promise/thenable, or other
return value stops that transition immediately and returns `ok:false` with a new
failed runtime, immutable module/stage/message diagnostic, and completed progress.
Later modules in that transition are not invoked; initialize/start cannot resume.
A native Promise rejection is observed to avoid an unhandled rejection, but is
never awaited or accepted as success. Arbitrary thenables are not executed.
Async effects already started by caller code cannot be canceled by L2. The void
callback type follows TypeScript conventions; runtime return validation is still
mandatory because TypeScript allows value-returning callbacks in void positions.

Explicit dispose after failure visits only modules that successfully completed
initialize and have not completed dispose. It does not call stop implicitly or
claim rollback of external side effects. Cleanup failure also returns failed
progress. A subsequent explicit dispose can retry outstanding cleanup; completed
hooks are skipped. There is no automatic retry. Successful cleanup returns
disposed, retaining historical failure diagnostics; modules that never initialized
retain their created/failed state. Top-level failure is the latest diagnostic;
per-module failures preserve relevant history. A failed cleanup never reports
disposed success.

Inspection is immutable data only: overall status, selected/resolved IDs, module
statuses/completed stages and diagnostics. No callbacks, timestamps, runtime
services or gameplay state are exposed. Old snapshots and hook-context views
stay stable. Callers deliberately sharing mutable closure resources across
bindings retain responsibility for that sharing; lifecycle isolation does not
clone external objects or undo their side effects.

## Command and event coordination (GF10–GF13)

One opt-in `GameplayMessaging` per validated selected composition. Creation checks
exact unique ID/definition alignment and dependency-first input order using the
canonical Module definition validator; it neither selects nor resolves a graph.
Selected identities are detached from caller input. Only selected modules can
own handlers/subscriptions; no default registrations or services are supplied.

| Function | Result and semantics |
| --- | --- |
| `createGameplayMessaging(composition)` | Opaque frozen context; private per-context tables |
| `registerCommandHandler(messaging, {moduleId, commandType, handler})` | void; one handler/type, duplicate/invalid registration throws without overwriting |
| `dispatchCommand(messaging, {type, payload})` | Frozen `CommandResult`; exactly one matching handler, never auto-publishes |
| `subscribeEvent(messaging, {moduleId, eventType, handler})` | Opaque frozen `EventSubscription` token; registration order |
| `publishEvent(messaging, {type, payload})` | Frozen `EventPublishResult`; snapshot fan-out, fail-fast |
| `unsubscribeEvent(messaging, token)` | true if removed, false if already removed; forged/foreign token throws |
| `unsubscribeModuleEvents(messaging, moduleId)` | Count removed across all event types for that selected owner; repeat returns 0 |

Eleven public types: `GameplayMessaging`, `GameplayCommand`, `CommandOutcome`,
`CommandHandlerRegistration`, `CommandFailure`, `CommandResult`, `GameplayEvent`,
`EventSubscription`, `EventSubscriptionRegistration`, `EventFailure`,
`EventPublishResult`. Through GF13: 22 functions, 26 types. No deep
exports, raw tables, execution guards or private helpers.

```ts
interface GameplayCommand { readonly type: string; readonly payload: unknown; }
interface GameplayEvent { readonly type: string; readonly payload: unknown; }
type CommandOutcome =
  | { readonly status: 'success'; readonly value?: unknown }
  | { readonly status: 'rejected'; readonly reason: string };
interface CommandHandlerRegistration {
  readonly moduleId: string;
  readonly commandType: string;
  readonly handler: (command: GameplayCommand) => CommandOutcome;
}
interface CommandFailure {
  readonly commandType: string; readonly moduleId: string; readonly message: string;
}
type CommandResult =
  | { readonly status: 'success'; readonly commandType: string; readonly moduleId: string; readonly value?: unknown }
  | { readonly status: 'rejected'; readonly commandType: string; readonly moduleId: string; readonly reason: string }
  | { readonly status: 'unhandled'; readonly commandType: string }
  | { readonly status: 'failed'; readonly failure: CommandFailure };
interface EventSubscriptionRegistration {
  readonly moduleId: string;
  readonly eventType: string;
  readonly handler: (event: GameplayEvent) => void;
}
interface EventFailure {
  readonly eventType: string; readonly moduleId: string;
  readonly subscription: EventSubscription; readonly message: string;
}
type EventPublishResult =
  | { readonly ok: true; readonly eventType: string; readonly completedDeliveries: number }
  | { readonly ok: false; readonly eventType: string; readonly completedDeliveries: number; readonly failure: EventFailure };
```

Command/event types follow lowercase kebab-case `[a-z][a-z0-9]*(?:-[a-z0-9]+)*`;
no normalization or implied owner routing. An envelope must supply `payload`
(explicit undefined is valid). Malformed envelopes, owners, registrations,
capabilities and tokens throw `TypeError`. Unknown valid command returns unhandled;
zero event subscribers succeeds with 0 deliveries. Tables retain detached frozen
registration metadata and original callbacks; caller replacements do not rewire them.
Command registrations last for the context's lifetime; event cleanup does not
unregister commands or dispose the context.

Handlers return explicit success/value or rejected/nonempty reason. Foundation
does not decide business rejection reasons. Throw, malformed outcome or unsupported
async result produces failed with command type/owner/message. Event listeners
must return undefined; throw, Promise/thenable or non-void return stops fan-out,
reports the failing token/owner/type and only counts previously completed listeners.
No later listener, retry or side-effect rollback. Native Promise rejections are
observed without awaiting; arbitrary thenables are not executed. Callback work
already started cannot be canceled. TypeScript permits value-returning callbacks
in void positions, so listener return validation is enforced at runtime.

Each publish snapshots matching active subscriptions in registration order at
entry to fan-out. Subscribe/unsubscribe/owner cleanup during callbacks affect the
next publish; even a removed listener still runs in the current snapshot unless
an earlier failure stops it. New listeners never join that current iteration.
Same-context nested dispatch/publish throws before executing anything. If uncaught
inside the callback, it becomes the outer structured failure; a caller catching
it has observed the rejection and may return normally. Other contexts can execute
independently. The guard is always released after return/failure; no nested queue.

Envelope and result/diagnostic metadata are detached/frozen. Payloads and success
values are unknown business data passed by reference, never cloned, mutated or
deep-frozen by Foundation. A listener/caller can mutate its business objects;
later listeners see the same reference. Caller remains responsible for validation,
sharing and external effects. Frozen opaque tokens/context expose no internal
collections, callbacks or execution mutators through reflection.

Lifecycle integration is **explicit caller wiring**, for example:

```ts
const messaging = createGameplayMessaging(composition);
const runtime = createGameplayRuntime(composition, {
  unit: {
    initialize() {
      subscribeEvent(messaging, {moduleId: 'unit', eventType: 'notice', handler() {}});
    },
    stop() { unsubscribeModuleEvents(messaging, 'unit'); },
    dispose() { unsubscribeModuleEvents(messaging, 'unit'); },
  },
});
```

This does not change GF07 transitions or automatically gate messaging by Runtime
status. A context can dispatch/publish before start or after disposal if the caller
keeps registrations. Historical runtime inspection is not live authority. No
implicit clock/RNG, gameplay state, async bus, implicit dependencies or automatic events.

## GF14–GF16: execution dependencies and conditional determinism

Canonical owner: `src/foundation/execution/index.ts`, exported only through the
package root. This independent capability can be captured by existing lifecycle,
command or event callbacks; those APIs and their failure handling are unchanged.

```ts
interface GameplayClock { now(): number; }
interface GameplayRandom { next(): number; }
interface GameplayIdProvider { next(): string; }
interface GameplayExecutionDependencies {
  readonly clock: GameplayClock;
  readonly random?: GameplayRandom;
  readonly ids?: GameplayIdProvider;
}
// GameplayExecutionContext is opaque, obtained only by creation.
```

| Function | Contract |
| --- | --- |
| `createExecutionContext(dependencies): GameplayExecutionContext` | Requires a clock and validates supplied ports/methods without invoking them. Returns frozen opaque capability. |
| `readExecutionTime(context): number` | Calls captured clock once; finite nonnegative milliseconds relative to caller origin. Backward movement and fractional values allowed. |
| `nextExecutionRandom(context): number` | Calls captured RNG once; finite [0,1). Missing RNG throws. |
| `nextExecutionId(context): string` | Calls captured ID provider once; nonblank string returned unchanged, no Module ID format or uniqueness restriction. Missing provider throws. |

Dependencies/providers must be non-null non-array objects, with callable `now` or
`next`. Creation captures each original method and its receiver: later replacing
a slot/method does not rebind the capability. Provider mutable state stays with
the caller and remains observable through those captured methods. No provider is
cloned, mutated or frozen. Intentionally sharing one provider shares caller
state; separate providers remain isolated. Reflection cannot reach callbacks or
records, and copying brands/properties cannot forge a valid identity.

Malformed dependencies, missing optional ports on access, invalid outputs and
forged contexts throw TypeError. Provider-thrown values propagate by identity;
there is no retry, wrapping, sequence rollback, caching or implicit increment.
When called inside existing callbacks, those owners convert errors according to
their existing command/event/lifecycle contracts. No request reads another port.
Creation/inspection/registration/dispatch/publication never read providers unless
caller code explicitly does so. Ports are synchronous; Promise outputs are invalid.

GF16 guarantees reproducible **Foundation semantic observations** for equivalent
inputs, selected composition, registration/call order and starting provider and
callback states. It does not make arbitrary external side effects deterministic.
No hidden time/RNG/ID source, default implementation, seeded algorithm, scheduler,
global gameplay store, rollback, persistence or replay service exists. Metadata
has no implicit timestamps/IDs. Snapshot semantics of the other owners remain
unchanged. Text/2D/2.5D evidence covers opaque data compatibility only; it does not
implement coordinates, direction processing, movement, combat or rendering.

## EC01–EC03: Entity identity and creation

Canonical owner: `src/modules/entity/index.ts`. Root additions:

```ts
interface EntityDefinition {
  readonly id: string;
  readonly kind: string;
}
type EntitySnapshot = EntityDefinition;
function createEntity(definition: EntityDefinition): EntitySnapshot;
```

Current root inventory: 46 functions / 49 public types. Existing Foundation APIs
and root-only exports are preserved. Both fields must be nonblank strings, stored
unchanged including whitespace/case/punctuation and arbitrary caller-defined kind.
No enum, module-ID format, default, coercion or ID generation. Same ID represents
the same logical identity under consumer rules; independent snapshots may share
an ID. Object reference equality does not replace ID equality.

The runtime definition is closed: exactly two own data properties id/kind on a
non-null non-array object. Missing/inherited fields, accessors and extra string,
symbol or nonenumerable keys throw TypeError. Accessors are not invoked.
Null-prototype data objects are supported. TypeScript is structural: excess-field
checks apply to fresh literals; runtime validation also rejects extra properties
on structurally typed variables. No private validator is exported.

Creation returns a fresh detached frozen scalar snapshot; input remains mutable
and unfrozen. No deep-cloning machinery, writable record or global state. Invalid
input creates no partial successful entity or framework side effect. Identical
valid inputs yield equal semantic data with distinct snapshot references.

Static ownership declares entity optional with no dependencies. Consumers register,
enable, resolve and compose it through GF01–GF05 explicitly; default disabled,
no actor auto-creation. Selection is composition intent and does not gate direct
creation. The caller may explicitly call nextExecutionId before passing that ID;
Entity constructs no context and calls no providers, hooks, events or Kernel
calculation. Attributes/stats/resources/life use separate states below;
EC18 integration uses these unchanged public APIs; see the final section below.

## EC04–EC06: Entity collection and snapshot updates

Same canonical Entity owner and root-only package exports:

```ts
interface EntityCollection {
  readonly entities: readonly EntitySnapshot[];
}
function createEntityCollection(): EntityCollection;
function addEntity(collection: EntityCollection, entity: EntityDefinition): EntityCollection;
function getEntity(collection: EntityCollection, entityId: string): EntitySnapshot | undefined;
function hasEntity(collection: EntityCollection, entityId: string): boolean;
function listEntities(collection: EntityCollection): readonly EntitySnapshot[];
function removeEntity(collection: EntityCollection, entityId: string): EntityCollection;
function replaceEntity(collection: EntityCollection, entity: EntityDefinition): EntityCollection;
```

Creation returns a fresh frozen empty collection. Add appends a canonical EC03
validated detached entity; duplicate exact ID throws TypeError even if kind differs.
Uniqueness is collection-local. Lookup compares nonblank string IDs exactly,
without normalization: unknown valid IDs return undefined/false. Malformed IDs
throw TypeError. List returns frozen snapshots in insertion order, without sorting.
Remove requires an existing ID and preserves remaining relative order; unknown
or malformed IDs throw TypeError. Readding a removed ID appends it at the end.

Replace requires an existing exact ID and a complete valid id/kind definition;
it preserves the position and can change kind explicitly. No upsert, implicit
rename, arbitrary partial patch or automatic behavior change. Every successful
add/remove/replace returns a new frozen collection and frozen membership/entity
data. All previous versions and branching updates stay independent; invalid
operations leave them unchanged. Caller inputs are never frozen or mutated.

Collections are structural data, not opaque live handles. Runtime input must be
exactly an own entities data property holding a dense array of own data entries,
with no extra collection/array keys. Entries go through createEntity; duplicates,
malformed entries, holes, inherited fields and accessors throw TypeError without
invoking getters. Valid structural caller inputs are accepted but detached on
each operation, including lookup/list. Snapshot reference reuse is not promised.
Boundary validation/copying is linear in collection size; no performance or
collection-size limit is imposed. Ordinary Proxy traps remain caller code.

Collection operations have no backing mutable map, singleton, implicit clock/RNG/
ID, runtime, event/hook or Kernel calculation. Entity's optional registry entry
and dependencies and GF01–GF16 contracts remain unchanged.

## EC07–EC09: Attributes and Kernel stats

Root-only exports, owned by `src/modules/entity/index.ts`:

```ts
import type {PreparedStatCalculationInput, NumericalModifier} from '@rpg/core/kernel';
interface EntityAttributeState {
  readonly entityId: string;
  readonly baseAttributes: Readonly<Record<string, number>>;
}
type EntityStatConfiguration = Omit<PreparedStatCalculationInput, 'attributeBases'> & {
  readonly modifiers: readonly NumericalModifier[];
};
interface EntityStatSnapshot {
  readonly entityId: string;
  readonly effectiveAttributes: Readonly<Record<string, number>>;
  readonly stats: Readonly<Record<string, number>>;
}
function createEntityAttributeState(entity: EntitySnapshot, baseAttributes: Readonly<Record<string, number>>): EntityAttributeState;
function getEntityBaseAttributes(state: EntityAttributeState): Readonly<Record<string, number>>;
function setEntityBaseAttribute(state: EntityAttributeState, attributeId: string, value: number): EntityAttributeState;
function calculateEntityStats(state: EntityAttributeState, configuration: EntityStatConfiguration): EntityStatSnapshot;
```

State is separate from closed Entity/collection data, with exact entityId association.
Creation reuses createEntity validation. State reads/updates validate structural
own entityId/baseAttributes data and detach it. Records accept ordinary or null
prototypes; custom inherited records, symbols, accessors, arrays and callable data
are rejected. Attribute keys are exact nonblank strings, including constructor and
__proto__; finite negatives/fractions and empty maps are valid. No normalization,
clamping or schema defaults. Keyed update rejects unknown keys and preserves the
identity/other values in a new frozen state. No calculation is triggered.

```ts
import {createEntity, createEntityAttributeState, setEntityBaseAttribute, calculateEntityStats} from '@rpg/gameplay';
const attributes = createEntityAttributeState(createEntity({id: 'actor-1', kind: 'any'}), {strength: 10});
const configuration = {
  attributeOrder: ['strength'], statOrder: ['power'],
  attributeRules: {strength: {default: 0, enabled: true, bounds: {}}},
  attributeBaselines: {strength: 0}, baseStats: {power: 5},
  rules: {power: {default: 5, enabled: true, bounds: {}, training: 0,
    scaling: [{attribute: 'strength', coefficient: 2, enabled: true}]}},
  flatContributions: {}, modifiers: [],
};
calculateEntityStats(attributes, configuration).stats.power; // 25
calculateEntityStats(setEntityBaseAttribute(attributes, 'strength', 12), configuration).stats.power; // 29
```

Configuration is captured before Kernel/callback execution, without freezing or
mutating caller-owned rules, modifiers, arrays or callbacks. All required maps and
orders must be supplied explicitly, including empty modifiers. Order arrays must
be dense own data, with unique nonblank IDs. Attribute maps/base state must match
attributeOrder exactly; rules match statOrder exactly. Attribute/stat targets must
not collide. baseStats/flatContributions/transforms can omit ordered stat keys,
but cannot introduce unordered keys. Scaling references must name ordered
attributes, including disabled terms. Rule defaults, bounds, coefficients,
training, baselines, contributions and modifiers are finite; enabled is boolean.
Bounds are optional finite min/max with min <= max; optional precision requires
integer decimalPlaces 0–100, the Kernel's JS rounding domain. Explicit undefined,
unknown fields and incomplete rules are rejected, never silently filled.

Modifiers require own identity source/sourceInstanceId/id, ordered target,
enabled, finite value and one Kernel operation: add_flat, add_percent or
add_percentage_points. L2 validates/copies them; Kernel alone performs canonical
deduplication, conflict detection, aggregation and arithmetic. No-modifier calls
use the same resolver/stat path. Kernel owns attribute/stat order, baselines,
default stat bases, scaling, disabled rules, bounds and precision. training is
passed through, with no extra training arithmetic in L2.

Optional transforms are captured functions called by Kernel once per ordered
stat, including disabled rules. They must synchronously return a finite number;
invalid return types/nonfinite values throw TypeError, without coercion/repair.
Caller throws and Kernel errors propagate. Valid values are projected verbatim
from Kernel attributes/values into frozen detached numeric maps; mutable diagnostic
details/modifier references are not exposed. No arithmetic runs while projecting.

Recalculation explicitly calls calculateEntityStats again with new state/modifiers/
configuration. No live binding, cache, events, provider injection or automatic
resource synchronization. Old snapshots remain intact, even if caller inputs
later change. Collection removal/replacement neither deletes nor rewrites attribute
states; membership checks remain caller responsibility. Determinism requires equal
inputs/order and deterministic caller callbacks. Ordinary JS Proxy traps and
callback closure state remain caller code; no runtime/IO isolation is promised.

Attributes/stats expose no generic arbitrary state bag or future-milestone placeholder.

## EC10–EC13: Resources and transitions

Same Entity owner and root-only exports. Kernel types are imported from
`@rpg/core/kernel`; public options compose them without resource/current overrides.

```ts
interface EntityResourceState {
  readonly entityId: string;
  readonly current: Readonly<Record<string, number>>;
}
type EntityResourceDefinition = Omit<ResourceNormalizationInput, 'resource'>;
type EntityResourceBounds = Omit<ResourceNormalizationInput, 'resource' | 'current'>;
type EntityResourceTransitionInput = Omit<ResourceTransitionInput, 'resource' | 'current'>;
type EntityResourceRegenerationInput = Omit<ResourceRegenerationInput, 'resource' | 'current'>;
interface EntityResourceNormalizationResult {
  readonly state: EntityResourceState;
  readonly calculation: Readonly<ResourceNormalizationResult>;
}
interface EntityResourceTransitionResult {
  readonly state: EntityResourceState;
  readonly transition: Readonly<ResourceTransitionResult>;
}
function createEntityResourceState(entity: EntitySnapshot, definitions: Readonly<Record<string, EntityResourceDefinition>>): EntityResourceState;
function getEntityResourceCurrent(state: EntityResourceState, resourceId: string): number | undefined;
function normalizeEntityResource(state: EntityResourceState, resourceId: string, bounds: EntityResourceBounds): EntityResourceNormalizationResult;
function transitionEntityResource(state: EntityResourceState, resourceId: string, options: EntityResourceTransitionInput): EntityResourceTransitionResult;
function regenerateEntityResource(state: EntityResourceState, resourceId: string, options: EntityResourceRegenerationInput): EntityResourceTransitionResult;
```

Creation validates Entity using EC03 and captures the entire definition map before
normalization. Definitions require finite minimum/maximum with minimum <= maximum;
optional current must be finite if present (explicit undefined is rejected).
Out-of-bounds normalization inputs are valid. Each value comes from Kernel
normalizeResource, including omitted-current initialization; L2 supplies no fallback.
Empty maps are valid. Resource IDs are exact nonblank strings, including whitespace,
case, constructor and __proto__, without a fixed vocabulary. The key set is fixed
at creation; mutation operations require an existing key. Valid unknown inspection
returns undefined and invokes no Kernel; malformed IDs throw TypeError.

Resource state is separate from Entity, collections, attributes and stats. Runtime
structural input must contain exactly own entityId/current data; numeric maps and
active configuration accept plain/null prototypes, own string data fields, no
accessors, symbols, custom inherited records, extras or coercion. State current
values must be finite. Old states and caller objects remain unchanged/unfrozen;
all returned state/maps/envelopes/diagnostics are detached and frozen. TypeError
rejects malformed inputs, and Kernel errors propagate without partial publication.
Proxy traps remain caller code; no IO isolation is promised.

Explicit normalization supplies finite ordered bounds and returns the authoritative
resource/before/after/initialized calculation. Maximum changes never trigger an
implicit update: current100 with new maximum80 becomes80 only on explicit request.
Increasing maximum never automatically refills current.

Transition requires operation increase/decrease, finite nonnegative amount, finite
ordered rule.minimum/maximum, current >= minimum, complete rule with
currentAboveMaximum allow/reject and boolean allowIncreaseFromMinimum. Kernel owns
above-maximum rejection/clamping, recovery and all arithmetic. Diagnostics preserve
resource/before/after/applied/reachedMinimum exactly: with current120/max100 and
allow, increase10 returns after100/applied-20; decrease10 returns after100/applied10.
Applied is not reconstructed from state delta. ReachedMinimum is not a life state.

Eligible regeneration requires finite ordered bounds, current within those bounds,
finite nonnegative ratePerSecond/elapsedSeconds and integer precision.decimalPlaces
0–100. Caller explicitly supplies eligibility and time; no hidden clock read or
precision/rate default. The entire active input is captured before Kernel execution.
With eligible=false, only state/ID, options shape/known keys and own boolean eligible
are checked: ignored bounds/rate/time/precision are never read, normalized or
validated, including accessors. Kernel receives its early no-op input and returns
unchanged current/applied0/reachedMinimum false even if current is outside new bounds.
The TypeScript signature still requires the complete canonical options contract.
No fabricated numeric defaults or retry are used in that no-op path.

Caller may pass an EC08 stat as maximum explicitly. Resource state stores no bound,
stat snapshot or live binding. No policy infers HP/death/revive, performs schema
updates, emits events, accesses Runtime/Messaging, or schedules automatic recovery.
EC10–EC13 added five functions/seven types; current inventory including EC14–EC17
is 46 functions/49 public types.

## EC14–EC17: Life State & Death

Root-only exports, same canonical Entity owner:

```ts
type EntityLifeStatus = 'alive' | 'dead';
interface EntityLifeState {
  readonly entityId: string;
  readonly status: EntityLifeStatus;
}
interface EntityLifeResourcePolicy extends EntityResourceBounds {
  readonly resourceId: string;
}
type EntityLifeTransitionOutcome = 'defeated' | 'revived' | 'unchanged';
interface EntityLifeTransitionResult {
  readonly entityId: string;
  readonly before: EntityLifeStatus;
  readonly after: EntityLifeStatus;
  readonly outcome: EntityLifeTransitionOutcome;
  readonly state: EntityLifeState;
}
function createEntityLifeState(entity: EntitySnapshot, options: {readonly status: EntityLifeStatus}): EntityLifeState;
function resolveEntityDefeat(life: EntityLifeState, resources: EntityResourceState, policy: EntityLifeResourcePolicy): EntityLifeTransitionResult;
function reviveEntity(life: EntityLifeState, resources: EntityResourceState, policy: EntityLifeResourcePolicy): EntityLifeTransitionResult;
```

Creation reuses EC03, requires explicit status and neither reads resources nor
infers status from kind. Life state is independent from identity, membership,
attributes, stats and resources. Any actor kind may opt in; no status default,
coercion, provider, runtime, ID generation, numerical call or implicit event.

Life/state/options/policy boundaries require closed own string data fields on
plain/null-prototype records, without getters, symbols, extras or inherited
records. Status is exactly alive/dead; IDs remain exact nonblank strings.
Resource validation reuses the full EC10 boundary, including all finite current
entries. Life/resource entityId must match exactly; selected own resource key
must exist. Bounds are finite and ordered, including negative/nonzero minima.
All inputs validate before any no-op. Malformed/inconsistent inputs throw
TypeError, produce no successful result and mutate no caller data.

| Operation | Valid current | Life before | Result |
| --- | --- | --- | --- |
| Defeat | current == minimum | alive | dead / defeated |
| Defeat | current > minimum (including above maximum) | alive | alive / unchanged |
| Defeat | current >= minimum | dead | dead / unchanged |
| Revival | minimum < current <= maximum | dead | alive / revived |
| Revival | minimum <= current <= maximum | alive | alive / unchanged |

Current below minimum rejects for both operations. Revival above maximum always
rejects; dead at minimum also rejects. Zero-width bounds cannot revive dead life.
Alive at minimum may remain unchanged under revival evaluation pending explicit
defeat. Defeat accepts stale above-max resources without normalizing them; caller
can explicitly normalize through EC11. Life operations never change resource
values or duplicate Kernel arithmetic. EC12 reachedMinimum is only a diagnostic;
resource recovery and revival are separate operations, without joint atomicity.

Every result (including unchanged) and nested state is freshly detached/frozen.
Results contain only scalar diagnostics and the life snapshot, no resource alias,
callback, binding or event history. Old snapshots remain valid; replaying the same
old inputs can repeat the same transition. Sequential callers retain the newest
snapshot to obtain unchanged on repeats. There is no global authority/replay guard.

Caller may publish a changed result via GF12 using caller-defined event names and
payloads. Entity neither registers listeners nor publishes events. GF13 preserves
subscription order/snapshot fan-out/fail-fast delivery, without a queue. A listener
failure after transition does not roll back the life result or retry publication.
No resource synchronization, respawn or kill/reward/loot policy is added.

## EC18: integration evidence, no additional public API

`tests/consumers/entity-integration.mjs` runs the root-only installed package.
Caller configuration yields max-life 25, explicit attribute update yields 29,
and explicit flat modifier yields 32. Caller selects maximum 25, normalizes
health 30 to 25, decreases to 20 then 0, resolves defeat, explicitly regenerates
to 10 and revives. GF10/GF12 command/event publication and lifecycle cleanup are
explicit caller wiring. Two isolated sessions match the independent literal
trace; invalid association/revival/transition and listener failure preserve
previous immutable state. Public inventory remains 46 functions / 49 types.
No transaction, store, scheduler or implicit state synchronization is provided.
See [phase evidence](reports/v0.2.5-entity-integration-closure.md).
Three functions/five types added; current root inventory: 46 functions/49 types.

## PG01–PG03 Progression Foundation

Canonical owner: `src/modules/progression/index.ts`. Root-only exports add one
function and two types (47 functions / 51 public types total).

```ts
interface ProgressionInitialState {
  readonly level: number;
  readonly experience: number;
}
interface ProgressionState {
  readonly entityId: string;
  readonly level: number;
  readonly experience: number;
}
function createProgressionState(
  entity: EntitySnapshot,
  initialState: ProgressionInitialState,
): ProgressionState;
```

Entity input passes canonical createEntity validation; exact id/kind strings are
preserved without normalization. Initial input must have exactly own data fields
level/experience. Null, arrays, wrong types, missing/extra fields (including symbol
and nonenumerable extras), inherited required fields and accessors throw TypeError
without invoking getters. Null-prototype data input is valid. Level is a positive
safe integer, including MAX_SAFE_INTEGER; no game cap. EXP is finite nonnegative,
including fractions and -0, preserved exactly as a JavaScript number. No coercion,
clamping, defaults or relation between level and EXP is inferred. Creation alone
does not select EXP semantics; advancement requires explicit mode policy.

The result is a fresh frozen three-scalar object. Caller input/Entity is untouched;
independent snapshots can share an Entity ID. No collection membership or authority
is checked/updated, including after Entity removal. Existing attribute/resource/
life snapshots remain independent. No clock/RNG/Kernel call, event or hook occurs.
Progression is optional: explicit registry definitions and selection of both entity
and progression compose dependency-first. Missing selected Entity fails using the
existing resolver. Creation itself requires no registry/runtime. No transitions,
EXP curves/caps, points/ranks or extra state bags are exposed at v0.3.0.

## PG04–PG06 recorded Experience transitions

Same canonical Progression owner. Additive root exports: gainExperience and
adjustExperience; three readonly types. v0.3.1 inventory: 49 functions/54 types.
No redundant EXP getter: read ProgressionState.experience.

```ts
interface ExperienceAdjustment {
  readonly delta: number;
  readonly maximumExperience?: number;
}
interface ExperienceTransition {
  readonly entityId: string;
  readonly before: number;
  readonly after: number;
  readonly requestedDelta: number;
  readonly appliedDelta: number;
  readonly limited: boolean;
}
interface ExperienceTransitionResult {
  readonly state: ProgressionState;
  readonly transition: ExperienceTransition;
}
function adjustExperience(state: ProgressionState,
  adjustment: ExperienceAdjustment): ExperienceTransitionResult;
function gainExperience(state: ProgressionState, amount: number,
  policy?: Omit<ExperienceAdjustment, 'delta'>): ExperienceTransitionResult;
```

Both validate a closed own-data entityId/level/experience state on every call,
including no-ops. Identity is a nonblank string preserved exactly; PG03 level/EXP
numeric validation is shared unchanged. Structural data need not be pre-frozen or
created by this package. Required inherited/accessor fields and any own unknown
string/symbol/nonenumerable field reject without calling getters. Null-prototype
data remains valid. Adjustment has exactly delta and optional maximumExperience;
gain policy allows only maximumExperience. Inherited optional maximum rejects.
An own maximum with value undefined is invalid; omit the property instead.

Delta must be finite; gain additionally requires nonnegative amount, including 0.
Optional maximum must be finite/nonnegative and at least current EXP, even if the
requested change would reduce EXP. Invalid inputs and uncapped nonfinite results
throw TypeError before returning anything; caller objects stay unchanged.
One canonical update adds delta using JavaScript number semantics, floors below 0
and caps above explicit maximum. A finite valid cap also handles intermediate
positive overflow. No implicit MAX_SAFE_INTEGER bound or decimal/precision policy.

Result, next state and diagnostic are frozen detached objects. entityId/level stay
unchanged; maximum is not stored. appliedDelta is exactly after-before, signed;
limited means floor/cap clipped the requested sum. Reaching a bound exactly or a
zero-delta no-op is not limited. Native number rounding alone does not set limited:
for example 1e20+1 remains 1e20, appliedDelta 0, limited false. No automatic advancement,
EXP representation conversion, event, provider read or Entity-domain update.
EXP remains a recorded scalar, not implicitly cumulative or level-local.

## PG07–PG10 explicit Level & Advancement

Root adds two functions and six readonly types (51 functions/60 types total):

```ts
type ExperienceMode = 'cumulative' | 'level-local';
interface LevelRequirement {
  readonly toLevel: number;
  readonly requiredExperience: number;
  readonly eligible: boolean;
}
interface LevelAdvancementPolicy {
  readonly experienceMode: ExperienceMode;
  readonly maxLevel: number;
  readonly targetLevel: number;
  readonly requirements: readonly LevelRequirement[];
}
type LevelAdvancementBlockReason = 'none' | 'target_reached' | 'max_level'
  | 'insufficient_experience' | 'condition_not_met';
interface LevelAdvancementAssessment {
  readonly entityId: string;
  readonly beforeLevel: number;
  readonly projectedLevel: number;
  readonly targetLevel: number;
  readonly beforeExperience: number;
  readonly projectedExperience: number;
  readonly levelsGained: number;
  readonly experienceConsumed: number;
  readonly advancedLevels: readonly number[];
  readonly blockedAtLevel?: number;
  readonly reason: LevelAdvancementBlockReason;
}
interface LevelAdvancementResult {
  readonly state: ProgressionState;
  readonly transition: LevelAdvancementAssessment;
}
function evaluateLevelAdvancement(state: ProgressionState,
  policy: LevelAdvancementPolicy): LevelAdvancementAssessment;
function advanceProgressionLevel(state: ProgressionState,
  policy: LevelAdvancementPolicy): LevelAdvancementResult;
```

Both use the same private resolver once per call. All state fields use existing
PG02/PG06 closed own-data validation. Mode/max/target/requirements are mandatory
own data; unknown string/symbol/nonenumerable properties, missing/inherited fields
and accessors reject with TypeError without evaluating getters. Null-prototype
records remain valid. All levels are positive safe integers and must satisfy
current <= target <= max. No level-down or implicit default.

Requirements must be a dense own-data array, without extras, with exactly one
closed requirement per step current+1 through target in that order. No duplicate,
missing, skipped, extra or reordered step; no sparse/accessor entry. requiredExperience
is finite nonnegative (fractions and zero allowed); eligible is boolean, never a
callback. Cumulative thresholds must be nondecreasing. Local costs may decrease.
The entire policy/list validates before evaluation, including no-op, at-max and
requests with an early blocker. Malformed input rejects the whole operation.

Cumulative compares recorded EXP against absolute thresholds and retains EXP.
Level-local compares remaining EXP to each cost then subtracts only successful
costs. Eligibility false wins over insufficient EXP. A blocker stops at that step
without skipping, preserving the successful prefix in the returned state.
maxLevel never caps EXP. The target ends this call even if more EXP remains.

Reason none means all requested steps completed (also when reaching max in this
call). target_reached means target was already current; max_level takes precedence
when current was already max. Blockers give condition_not_met or
insufficient_experience and include blockedAtLevel; otherwise that property is
absent. levelsGained = projectedLevel-beforeLevel; experienceConsumed =
beforeExperience-projectedExperience, reflecting native JavaScript arithmetic.
No epsilon/rounding/decimal policy. Invalid results reject rather than returning
partial data; ordinary blocker results are valid partial advancements.

Result, nested state, assessment and detached advancedLevels array are frozen.
Evaluate is semantically equal to advance.transition for equivalent inputs.
Exact entityId survives; caller state/policy/requirements and all other domains
remain untouched. No callbacks, time/RNG, events, auto rewards or stored mode/cap.
Caller maintains consistent EXP mode throughout a lifecycle; no mode conversion.
PG05/PG06 retain their independent behavior, including unchanged level after gain
or EXP loss. PG11–PG19 remain outside this checkpoint.

## PG11–PG13 Attribute Points

Root adds three functions and six readonly types (54 functions/66 types total):

```ts
createAttributePointState(state: ProgressionState, initial: AttributePointInitialState): EntityAttributePointState;
grantAttributePointRewards(points: EntityAttributePointState, advancement: LevelAdvancementResult, policy: AttributePointRewardPolicy): AttributePointRewardResult;
allocateAttributePoints(points: EntityAttributePointState, attributes: EntityAttributeState, allocation: AttributePointAllocation): AttributePointAllocationResult;
```

- `AttributePointInitialState`: explicit `unspentPoints`, `spentPoints`,
  `rewardedThroughLevel`. Balances and their sum are nonnegative safe integers;
  cursor is a positive safe integer <= initial progression level.
- `EntityAttributePointState`: initial fields plus exact `entityId` and required
  readonly `pointKind: 'attribute'`. Separate from
  ProgressionState. All creation/transition results are frozen detached snapshots.
- `AttributePointRewardPolicy`: `pointsByLevel: Readonly<Record<number, number>>`,
  plain/null-prototype own-data map with exactly canonical completed-level keys.
  No missing/extra keys, aliases, getters, negative/fractional/unsafe values.
- `AttributePointRewardResult`: `{state, transition}`. Transition has `entityId`,
  frozen `rewardedLevels`, `pointsGranted`, `beforeUnspent`, `afterUnspent`.
- `AttributePointAllocation`: closed `{attributeId, pointCost, newBaseValue}`.
  Cost positive safe integer within available balance; existing exact attribute
  key; finite strictly increased value. No point-to-attribute conversion formula.
- `AttributePointAllocationResult`: `{points, attributes, transition}`. Transition
  has `entityId`, `attributeId`, `beforeValue`, `afterValue`, `pointsSpent`,
  `beforeUnspent`, `afterUnspent`. Canonical Entity setter owns attribute updates.

Reward input is the actual PG09 result, structurally validated for identity,
state/diagnostic consistency, contiguous completed levels, consumption and blocker.
Cursor must equal `beforeLevel`; only completed levels receive caller rewards.
Zero rewards advance cursor; no-level receipts preserve cursor and balances.
Updated cursor rejects repeated successful receipts. Stale snapshots can branch;
structural receipts do not authenticate provenance. No global exactly-once ledger.
Allocation builds both snapshots atomically in memory, not a database transaction.
Caller owns economics/restrictions, joint persistence, events and explicit stat
recalculation. No EXP/level/resource changes, respec or Skill Point/Rank system.

## PG14–PG18 Skill Progression

Root adds six functions and eleven readonly types (60 functions/77 types total):

```ts
createSkillRankState(entity: EntitySnapshot, ranks: Readonly<Record<string, number>>): EntitySkillRankState;
getSkillRank(state: EntitySkillRankState, skillId: string): number | undefined;
createSkillPointState(state: ProgressionState, initial: SkillPointInitialState): EntitySkillPointState;
grantSkillPointRewards(points: EntitySkillPointState, advancement: LevelAdvancementResult, policy: SkillPointRewardPolicy): SkillPointRewardResult;
evaluateSkillUpgrade(progression: ProgressionState, ranks: EntitySkillRankState, points: EntitySkillPointState, requirement: SkillUpgradeRequirement): SkillUpgradeAssessment;
upgradeSkillRank(progression: ProgressionState, ranks: EntitySkillRankState, points: EntitySkillPointState, requirement: SkillUpgradeRequirement): SkillUpgradeResult;
```

- `EntitySkillRankState`: `{entityId, ranks: Readonly<Record<string, number>>}`.
  Empty map allowed; nonblank exact own string keys and nonnegative safe integer
  ranks. Rank0 means registered/unlearned; unknown keys stay unknown. No catalog
  registration/removal during upgrade. Ordinary/null-prototype data maps only,
  no getters/symbol keys/inherited ranks; `__proto__` is safe own data.
- `SkillPointInitialState`: required `unspentPoints`, `spentPoints`,
  `rewardedThroughLevel`. `EntitySkillPointState` adds exact `entityId` and required
  readonly `pointKind: 'skill'`. Balances
  and total nonnegative safe integers; cursor positive safe integer <= supplied
  level at creation. Independent pool/cursor from Attribute Points.
- `SkillPointRewardPolicy`: `{pointsByLevel: Readonly<Record<number, number>>}`.
  Same complete actual-PG09 receipt consistency and exact completed-level reward
  map rules as PG12. Partial rewards cover completed prefix only; zero advances
  cursor; no-level preserves balances/cursor. Updated cursor rejects replay.
- `SkillPointRewardResult`: `{state, transition}`; transition has `entityId`,
  `rewardedLevels`, `pointsGranted`, `beforeUnspent`, `afterUnspent`.
- `SkillRankPrerequisite`: closed `{skillId, minimumRank}`. Exact registered
  nonblank ID, positive safe minimum; no duplicates or self-reference.
- `SkillUpgradeRequirement`: closed `{skillId, expectedRank, maxRank, pointCost,
  requiredCharacterLevel, prerequisites, eligible}`. Target must exist. Expected
  rank is nonnegative safe and must equal actual; cap positive safe and >= actual.
  Cost nonnegative safe (explicit0 valid); required level positive safe; boolean
  eligibility only; complete dense own-data prerequisite list.
- `SkillUpgradeOutcome`: `'upgraded' | 'blocked'`.
- `SkillUpgradeBlockReason`: `'none' | 'max_rank' | 'character_level_too_low' |
  'prerequisite_not_met' | 'condition_not_met' | 'insufficient_points'`.
- `SkillUpgradeAssessment`: `{entityId, skillId, beforeRank, projectedRank,
  beforeUnspent, projectedUnspent, pointsSpent, outcome, reason}`.
- `SkillUpgradeResult`: `{ranks, points, transition: SkillUpgradeAssessment}`.

Three state identities must match. Complete validation precedes blockers; invalid
policy/state, unknown prerequisite, rank above cap or stale expectedRank throws
TypeError. Valid blockers use priority max rank -> character level -> prerequisites
-> eligibility -> points. Blocked result preserves rank/point values with zero
spending; success increments only target by one and transfers exact cost from
unspent to spent. Other ranks, cursor, level/EXP/Attributes/Resources stay intact.
Evaluate equals actual transition by semantic deep equality, using one resolver.
All results/nested maps/lists frozen and detached, including blocked results;
caller inputs untouched. latest snapshots required for cursor/expectedRank guards.
Stale snapshots can branch; structural discriminants separate domains but do not
authenticate data or receipt provenance. Caller jointly stores next snapshots; no persistent transaction
or global exactly-once guarantee. No Skill execution/effects/catalog, respec,
automatic reward/event/level change, time/RNG or generic prerequisite graph.


## PG19 installed integration (no new API)

The root remains exactly 60 runtime functions / 77 public types, including the
14 Progression functions / 28 types above. No integration facade or deep export.
Existing strict consumers cover every Progression declaration; the additional
progression-integration.ts proves cross-domain result assignability, readonly
outputs, actual receipt requirements and closed root-only package exports.
Caller sequences PG01-PG18 with Entity and opt-in GF10-GF13. Actual level results
can feed both reward operations independently. Allocation returns points and
attributes together; upgrade returns ranks and points together. Caller applies
both next snapshots, recalculates stats and publishes events explicitly.
Updated cursors/expectedRank reject sequential replay; old immutable snapshots
can branch. Structural receipts/pool types do not authenticate provenance/domain.
No persistent exactly-once, global transaction, lock, automatic rewards/events,
EXP mode conversion or Skill execution. Phase REVIEW_PENDING; acceptance PENDING.

## F-001: Point Pool type isolation (pre-merge v0.3.5 correction)

Attribute and Skill Point snapshots now require own data `pointKind` with the
exact literal `attribute` and `skill`, respectively. Initial inputs remain the
closed three-field balances/cursor records; factories attach the kind and reject
caller-supplied initial pointKind. Both reward APIs, Attribute Allocation and
Skill Evaluation/Upgrade validate the expected kind selected by their own code
path before granting/spending or evaluating valid gameplay blockers. Missing,
unknown, wrong-case, inherited/accessor kinds and extra state fields throw
TypeError; getters are not invoked. All next states preserve their exact kind.

TypeScript rejects cross-pool arguments/assignments and untagged snapshots. Public
returns stay precise, not unions; no added public function/type export. The only
approved snapshot delta is pointKind; numeric balances/cursors/results unchanged.
Consumers constructing/exact-matching snapshots must include it. Untagged legacy
objects are rejected with no inference, normalization or migration. pointKind is
a structural domain discriminator, not authentication/provenance or an exactly-once
authority; stale immutable snapshots can still branch. Package stays0.3.5.

## CB01–CB05 Combat Foundation

Canonical owner: `src/modules/combat/index.ts`. One new runtime function and three
readonly types, exported only through the package root. Current root inventory:
61 functions / 80 public types; accepted Group A exports remain unchanged.

```ts
interface CombatEntityTarget {
  readonly kind: 'entity';
  readonly entityId: string;
}
interface CombatActionRequest {
  readonly actionId: string;
  readonly actionType: string;
  readonly sourceEntityId: string;
  readonly target: CombatEntityTarget;
}
type CombatActionContext = CombatActionRequest;
function createCombatActionContext(request: CombatActionRequest): CombatActionContext;
```

The factory synchronously validates exactly four own data fields and exactly two
own target data fields. All IDs and actionType must be primitive nonblank strings;
trim checks blankness only, preserving the original string including whitespace
and case. Target kind must be exactly `entity`. Null, arrays, functions, missing,
unknown (including nonenumerable/symbol), inherited required fields and accessors
throw TypeError without invoking getters or returning a partial snapshot. Plain
and null-prototype own-data records are supported using existing boundary semantics.
No coercion, defaults, ID generation or fake Entity validation.

Each call returns a fresh frozen root with a fresh frozen target. Original inputs
stay mutable and detached. Equal requests produce semantically equal independent
snapshots; duplicate actionId is permitted. Source/target are opaque references:
self-target, swapped actor roles and unknown references are accepted. No collection
lookup, supported-action catalog, trusted receipt, admission or execution is implied.

Static module combat is optional and declares only entity. Consumer module
registration/selection is explicit; combat alone fails dependency resolution without
auto-enabling Entity. Progression remains independently selectable with Entity.
The factory requires neither runtime registration nor Entity objects, Foundation
execution providers or Kernel calls. No event, domain-state mutation, persistent
session, numerical operation, Skill integration or game-mode/time/spatial policy.

## CB06–CB10 Combat Action Admission

Same Combat owner; one new root function and four types. At the v0.4.1 checkpoint:
62 runtime functions /84 public types. CB01–CB05 contracts remain unchanged.

```ts
interface CombatActorEligibilityPolicy { readonly eligible: boolean; }
type CombatAdmissionStatus = 'admitted' | 'rejected';
type CombatAdmissionReason = 'none' | 'source_not_found' | 'source_dead' | 'source_ineligible';
interface CombatAdmissionResult {
  readonly context: CombatActionContext;
  readonly status: CombatAdmissionStatus;
  readonly reason: CombatAdmissionReason;
}
function evaluateCombatActionAdmission(
  context: CombatActionContext, entities: EntityCollection,
  sourceLife: EntityLifeState, policy: CombatActorEligibilityPolicy,
): CombatAdmissionResult;
```

Synchronous pure evaluation: canonical createCombatActionContext validates and
captures context; public Entity getEntity validates collection/looks up only
source; Life must have exactly own data entityId/status, nonblank exact ID and
alive/dead; source ID must match; policy must have exactly own boolean eligible.
All validation completes before gameplay rejection. Missing/invalid records,
extra/symbol/inherited/accessor fields, invalid life status, mismatched IDs,
missing boolean or callback policy throw TypeError without invoking getters.
Plain/null-prototype records retain accepted own-data semantics. No default Life
or eligible, coercion, HP inference or implicit policy evaluation.

| Valid inputs | status | reason |
| --- | --- | --- |
| Source absent (even dead/ineligible) | rejected | source_not_found |
| Source present, dead (even ineligible) | rejected | source_dead |
| Source present/alive, eligible false | rejected | source_ineligible |
| Source present/alive, eligible true | admitted | none |

Every result and its context/target are freshly detached/frozen, including rejected
results. Original inputs remain untouched. Player/Monster/custom actor kinds share
semantics. Unknown target and self-target are actor-stage admissible; no target
lookup/relations/life/range or supported-action catalog is evaluated. Admitted does
not mean executed or fully authorized. No state writes/events/time/RNG/ID allocation,
resource/death/numerical operations or persistent reservation. Caller provides
current authoritative state; stale snapshots can be evaluated again and results
supply no concurrency or transaction authority. No additional function/deep export.

## CB11–CB15 Combat Target Validation

Package0.4.2 adds one root function and five types (63 functions/89 types total).

```ts
type CombatTargetRelation = 'self' | 'ally' | 'enemy' | 'neutral';
interface CombatTargetPolicy {
  readonly relation: CombatTargetRelation;
  readonly allowedRelations: readonly CombatTargetRelation[];
  readonly allowedLifeStatuses: readonly EntityLifeStatus[];
}
type CombatTargetValidationStatus = 'accepted' | 'rejected';
type CombatTargetRejectionReason = 'none' | 'target_not_found'
  | 'relation_not_allowed' | 'target_life_not_allowed';
interface CombatTargetValidationResult {
  readonly context: CombatActionContext;
  readonly targetEntityId: string;
  readonly relation: CombatTargetRelation;
  readonly targetLifeStatus: EntityLifeStatus;
  readonly status: CombatTargetValidationStatus;
  readonly reason: CombatTargetRejectionReason;
}
function evaluateCombatTargetValidation(
  admission: CombatAdmissionResult, entities: EntityCollection,
  targetLife: EntityLifeState, policy: CombatTargetPolicy,
): CombatTargetValidationResult;
```

Admission must be exactly own data context/status/reason with admitted/none;
rejected or malformed receipts throw TypeError before target inputs are evaluated.
The nested context uses the canonical factory. This validates structure only, not
receipt provenance, freshness or authority. Source life/eligibility is never rerun.

Target lookup uses public getEntity. Life requires own data entityId/status,
alive/dead and exact target ID even if target is absent. Policy requires exactly
own data relation/allowedRelations/allowedLifeStatuses, exact literals and nonempty
dense arrays of unique own data entries without extra/symbol/accessor fields.
Missing/inherited required fields, unknown literals, duplicates, holes, accessors,
wrong identities or same-ID/non-self and different-ID/self inconsistencies throw
TypeError without calling getters. No coercion/defaults/callbacks. Own-data plain
and null-prototype records follow the existing Combat contract.

All validation precedes selection: missing target -> rejected/target_not_found;
otherwise disallowed relation -> rejected/relation_not_allowed; otherwise
disallowed life -> rejected/target_life_not_allowed; otherwise accepted/none.
Ally/enemy/neutral truth belongs to caller. Dead is valid if explicitly allowed;
no HP inference/revival. Original inputs stay untouched/unfrozen; result and its
fresh context/target are frozen/detached. No mutable policy aliases survive.
No attack/range/Skill check, numerical call, execution token, state mutation,
global relationship/target store, event or time/RNG. Caller supplies current
snapshots and sequences stages; structural accepted results are replayable data.

## CB16–CB20 Combat Attack Resolution

Package0.4.3 adds one root function and three types (64 functions/92 types total).

```ts
function resolveCombatAttack(
  admission: CombatAdmissionResult,
  targetValidation: CombatTargetValidationResult,
  attackInput: CombatAttackInput,
  executionContext: GameplayExecutionContext,
): CombatAttackResolutionResult;
type CombatAttackOutcome = 'dodged' | 'landed';
```

CombatAttackInput composes public Kernel types, with no callbacks/RNG in numerical
data: hit requires dodgeChance/eligible/rule; critical requires chance/bonus/
eligible/rule. damage requires base/rank/perRank, explicit ordered scaling entries
{source,value,coefficient}, flat {definition,additional,resolved} and explicit
already-effective ResolvedDamageBonus[] bonuses (id/source/eligible/reason/value/
contributions). mitigation requires ruleKey/rating/rule; optional sourceLevel and
targetLevel follow Kernel. Rule requires enabled/bounds/levelScalingEnabled;
baseK/levelPenalty can be omitted while disabled. Enabled mitigation requires
positive baseK and nonnegative levelPenalty, plus levels when scaling is enabled.

All records are closed own-data; arrays are dense own-data without extra fields.
Finite numeric fields, positive safe-integer rank, nonblank IDs, unique scaling
source IDs and finite non-inverted bounds are mandatory. No defaults/coercion or
inherited/accessor fields; explicit undefined is invalid. All stage/numerical
validation precedes RNG. Receipts require admitted/none and accepted/none, exact
actionId/actionType/sourceEntityId/target.kind/target.entityId agreement and
targetEntityId/self-relation/Life consistency. They are structural, not fresh or
authenticated authority. Admission/existence/policies are never rerun.

Hit -> Critical -> B0 -> B1 -> Mitigation delegates actual public Kernel calls.
Lazy Foundation nextExecutionRandom supplies rolls: zero/disabled/ineligible
dodge draws0; enabled eligible critical draws1 even at chance0. Dodge draws at
most1, never Critical. Invalid/missing/throwing RNG propagates without retries or
rollback. Already-effective bonus eligibility is not resolved again. Actual
critical.bonus is added once in B1; multiplier is diagnostic only. Missing enabled
mitigation config and nonfinite Kernel diagnostics throw TypeError.

Result is a deeply frozen detached discriminated union. Both outcomes include
context, outcome, actual hit diagnostics and finalDamage. dodged has finalDamage0
and no critical/b0/b1/mitigation properties. landed includes actual critical, b0
(including ordered scaling), b1 and mitigation (including missing diagnostics);
finalDamage is mitigation.finalDamage. Disabled mitigation preserves status and
missing fields. Original inputs/Kernel results are never frozen or mutated.
No HP/Life writes, automatic events, clock access, global store, Skill/Effect
execution or supported-action catalog. Caller explicitly invokes resolution and
owns current state, numerical snapshots and execution dependencies.

## CB21–CB25 Combat Damage Application

Package0.4.4 adds one root function and three types (65 functions/95 types total).

```ts
interface CombatDamageApplicationPolicy extends EntityLifeResourcePolicy {
  readonly currentAboveMaximum: EntityResourceTransitionInput['rule']['currentAboveMaximum'];
}
type CombatDamageApplicationOutcome = 'dodged' | 'zero_damage' | 'processed';
function applyCombatAttackDamage(
  attack: CombatAttackResolutionResult, resources: EntityResourceState,
  life: EntityLifeState, policy: CombatDamageApplicationPolicy,
): CombatDamageApplicationResult;
```

Policy requires resourceId/minimum/maximum/currentAboveMaximum with no default
health key, rounding, minimum damage or multiplier. Attack is the complete actual
CB20 dodged/landed shape with finite nonnegative finalDamage, canonical context,
closed own-data records/dense arrays and valid nested diagnostics. Redundant
hit/outcome, Critical/B1 and B1/mitigation/finalDamage links must agree. Numerical
stages are never recalculated. Validation is structural, not receipt authentication.

Exact target IDs must match Resource/Life IDs. Canonical Entity resource read
validates every map entry; Life schema/prototype/identity and explicit finite
ordered policy bounds/resource selection validate before no-op. Unknown IDs,
current below minimum, getters, inherited required/unknown fields, malformed
states/receipts/policy throw TypeError without invoking getters. Positive damage
with above-max reject propagates the canonical Entity/Core error.

CombatDamageApplicationResult is a readonly discriminated union. Both variants
include detached frozen context and calculatedDamage/appliedDamage. dodged or
zero_damage has both damage fields0 and resourceResult/lifeResult:null; caller
keeps its current snapshots. These paths do not transition, normalize above-max
resources or evaluate defeat, even at minimum. Above-max behavior applies only
when an actual positive resource transition runs.

processed contains exact EntityResourceTransitionResult and EntityLifeTransitionResult.
One transitionEntityResource decrease uses finalDamage, selected bounds/above-max
and allowIncreaseFromMinimum:false. One resolveEntityDefeat uses its UPDATED
resource state and the same resourceId/minimum/maximum. appliedDamage is exactly
transition.applied, never HP delta (140->100/request20 gives applied20/delta40).
Positive damage at minimum is processed even if applied0; alive may be defeated,
while already dead remains unchanged. Life outcome, not reachedMinimum/final dead
status alone, identifies a new defeat. All nested canonical results are frozen;
caller originals remain untouched/unfrozen, without mutable aliases.

No damage recalculation, blanket dead-target ban, automatic events/rewards,
Skill/Effect/Encounter feature, healing/revival, ledger or global state. Caller
owns trusted/current snapshots, authorization, durable writes, replay/exactly-once
and concurrent consistency. A receipt can be reused on independent state branches.

## CB26–CB30 installed composition (v0.4.5)

No public API/type additions or signature changes:65 root functions/95 types.
Root-only exports remain closed. Caller creates contexts, evaluates admission and
target, explicitly stops on rejection, resolves through Kernel with Foundation RNG,
then calls applyCombatAttackDamage. For processed outcomes, retain both
resourceResult.state and lifeResult.state together for the next attempt; no-op
outcomes retain caller states. resourceResult/lifeResult are canonical Entity
results, not Combat-specific state. Strict external combat-integration.ts verifies
this continuation, discriminated nulls, readonly snapshots and absence of facades.

The same calculated75 can apply75 to HP100, then25 to HP25. Caller must not infer
applied magnitude from HP delta (above-max140->100/request20 still applied20).
Structural receipts are not authenticated/fresh authorization. Reusing old state
branches again; no persistent exactly-once, transaction or concurrency authority.
No Skill/Effect/AI/Encounter integration is provided. See closure report.

## SK01–SK05 Skill Foundation (v0.5.0)

Two additive root functions and three readonly types: 67 runtime functions and
98 exported types total. No existing signatures or package export paths change.

```ts
interface SkillDefinition { readonly skillId: string; }
interface SkillInstanceInitialState { readonly instanceId: string; }
interface SkillInstanceState {
  readonly instanceId: string;
  readonly skillId: string;
  readonly entityId: string;
}
function createSkillDefinition(definition: SkillDefinition): SkillDefinition;
function createSkillInstance(definition: SkillDefinition, entity: EntitySnapshot,
  initial: SkillInstanceInitialState): SkillInstanceState;
```

Both factories capture detached frozen data. Skill/instance IDs are nonblank,
case-sensitive strings preserved exactly, without trimming, normalization or
generation. Definition and initial records contain exactly one own data property;
unknown/non-enumerable extra fields, symbols, getters, inherited required fields,
null/arrays and malformed IDs throw TypeError without invoking getters. Entity
validation delegates to public createEntity. The instance stores no definition or
Entity object reference; callers may supply structurally valid records directly.

Same skillId may bind multiple actors or instances. Repeated instanceId inputs
are structurally valid: uniqueness, idempotency, membership and authorization are
caller-owned. Creation does not imply learned/unlocked/equipped/available/alive,
admitted or activated. No rank/resources/cooldown/execution fields or lifecycle
operations are present. L3 explicitly projects rich content to {skillId}.

Static optional skill -> entity requires explicit selection of both. Progression
and Combat remain independent siblings. No implicit runtime, events, providers,
Core calculation or registry/catalog is created. All Skill deep imports stay closed.

## SK06–SK10 Skill Availability & Admission (v0.5.1)

One added root function and five types; current total **68 functions/103 types**.
SK01–SK05 schemas and all previous signatures remain unchanged. Deep exports closed.

```ts
type SkillRankAdmissionPolicy =
  | {readonly mode: 'not_required'}
  | {readonly mode: 'required'; readonly currentRank: number | null; readonly minimumRank: number};
interface SkillAdmissionPolicy {
  readonly owned: boolean;
  readonly eligible: boolean;
  readonly rank: SkillRankAdmissionPolicy;
}
type SkillAdmissionStatus = 'admitted' | 'rejected';
type SkillAdmissionReason = 'none' | 'actor_not_found' | 'actor_dead' | 'skill_not_owned'
  | 'skill_rank_unregistered' | 'skill_rank_too_low' | 'actor_ineligible';
interface SkillAdmissionResult {
  readonly instanceId: string;
  readonly skillId: string;
  readonly actorEntityId: string;
  readonly status: SkillAdmissionStatus;
  readonly reason: SkillAdmissionReason;
}
function evaluateSkillActivationAdmission(definition: SkillDefinition,
  instance: SkillInstanceState, actorEntityId: string, entities: EntityCollection,
  actorLife: EntityLifeState, policy: SkillAdmissionPolicy): SkillAdmissionResult;
```

Closed own-data records are mandatory: missing/unknown/nonenumerable extra/symbol/
accessor fields, inherited required fields, malformed identities, life status,
policy booleans or rank configuration throw TypeError without invoking getters.
Life snapshots follow Entity's ordinary/null prototype contract. IDs remain exact.
Definition/instance skill mismatch or life/actor mismatch throws TypeError even
when actor lookup misses. Instance/actor mismatch is valid skill_not_owned.
Entity lookup delegates to getEntity, including full collection validation.

Required ranks: currentRank is null for unregistered, otherwise a nonnegative safe
integer (0 is registered/unlearned); minimumRank is a positive safe integer.
No coercion/default/undefined fallback. Rankless policy has only mode and requires
no Progression. Caller reads canonical getSkillRank for the correct Entity/Skill
and explicitly maps undefined to null; Skill neither authenticates freshness/
provenance nor imports Progression. L3 owns rank requirements and both booleans;
owned:true cannot override exact actor binding. No Entity kind policy is inferred.

Every supplied contract validates before choosing this fixed rejection priority:
actor_not_found > actor_dead > skill_not_owned > skill_rank_unregistered >
skill_rank_too_low > actor_ineligible > none. Only none is admitted; all others
are ordinary structured rejections. Results contain exactly the five fields
shown, detached/frozen scalar data. Caller inputs remain unchanged/unfrozen.

Admitted means Skill-stage availability at evaluation only. It does not establish
resource sufficiency, cooldown readiness, target/Combat admission, activation,
execution or committed state. Assessment is not an authorization token/execution
receipt. No spending, scheduling, event, ID, Clock/RNG, rank/Life mutation, cache
or global store occurs. L4 supplies authoritative current snapshots and coordinates
later checks/persistence/concurrency. Optional skill -> entity remains unchanged;
Combat stays independent. Resource costs are added below in v0.5.2; later Skill mechanisms remain unimplemented.

## SK11–SK15 Skill resource costs (v0.5.2)

Root adds evaluateSkillResourceCosts(admission: SkillAdmissionResult,
resources: EntityResourceState, request: SkillResourceCostRequest): SkillResourceCostAssessment
and applySkillResourceCosts with the same arguments returning SkillResourceCostApplicationResult.

```ts
interface SkillResourceCost {readonly resourceId: string; readonly amount: number}
interface SkillResourceCostBounds {
  readonly resourceId: string;
  readonly minimum: number;
  readonly maximum: number;
  readonly currentAboveMaximum: 'allow' | 'reject';
}
interface SkillResourceCostRequest {
  readonly costs: readonly SkillResourceCost[];
  readonly bounds: readonly SkillResourceCostBounds[];
}
type SkillResourceCostStatus = 'payable' | 'rejected';
type SkillResourceCostRejectionReason = 'none' | 'resource_not_found' | 'insufficient_resource';
interface SkillResourceCostAssessment {
  readonly instanceId: string;
  readonly skillId: string;
  readonly entityId: string;
  readonly status: SkillResourceCostStatus;
  readonly reason: SkillResourceCostRejectionReason;
  readonly rejectedResourceId: string | null;
}
type SkillResourceCostApplicationResult =
  | {readonly status: 'applied'; readonly reason: 'none'; readonly assessment: SkillResourceCostAssessment;
      readonly state: EntityResourceState;
      readonly transitions: readonly EntityResourceTransitionResult['transition'][]}
  | {readonly status: 'rejected'; readonly reason: 'resource_not_found' | 'insufficient_resource';
      readonly assessment: SkillResourceCostAssessment; readonly state: null; readonly transitions: readonly []};
```

Admission must be exact own-data admitted/none with nonblank identities and match
resources.entityId. All request records/arrays are closed own-data; no unknown,
symbol/accessor/inherited required fields, sparse/extra array fields or coercion.
Amounts finite >=0, fractions accepted, IDs exact case/whitespace-sensitive.
Cost/bounds IDs unique and matched one-to-one; finite minimum<=maximum and explicit
policy required. Entire request and canonical resource state validate before an
ordinary rejection. Malformed data/preconditions throw TypeError; canonical
Entity/Core errors propagate, including positive cost with above-max reject.

Presence uses getEntityResourceCurrent. Each positive amount calls canonical
transitionEntityResource(decrease) and succeeds only when its applied exactly
equals cost. Fixed allowIncreaseFromMinimum:false; no numerical math/rounding/
epsilon. Caller order controls first missing/insufficient rejection. Above-max
allow may yield140->100 for cost20 with canonical applied20; diagnostics remain
unchanged. Zero requires presence but does not transition/normalize even above
maximum; free/all-zero returns detached equivalent state and empty transitions.

Success exposes only final candidate plus scalar canonical diagnostics, no interim
state. Failure exposes state:null/transitions:[]/rejectedResourceId. Every output
is detached/frozen; input remains unchanged/unfrozen. Evaluation exposes no state
or reservation; application resolves again against supplied current state. Bounds,
amounts and policies belong to L3; authoritative commits/concurrency belong to L4.
HP reaching minimum never changes Life or emits events. No activation/cooldown/
execution or new store/engine. skill->[entity] only; root70 functions/110 types.

## SK16–SK20 Skill cooldown (v0.5.3)

Root-only additions (73 functions/116 types total):

```ts
interface SkillCooldownState {
  readonly instanceId: string;
  readonly skillId: string;
  readonly entityId: string;
  readonly startedAtMs: number | null;
  readonly readyAtMs: number | null;
}
interface SkillCooldownConfiguration {
  readonly baseDurationMs: number;
  readonly effectiveCdr: number;
}
type SkillCooldownStatus = 'ready' | 'active';
type SkillCooldownReason = 'none' | 'cooldown_active';
interface SkillCooldownAssessment {
  readonly instanceId: string;
  readonly skillId: string;
  readonly entityId: string;
  readonly observedAtMs: number;
  readonly readyAtMs: number | null;
  readonly remainingMs: number;
  readonly status: SkillCooldownStatus;
  readonly reason: SkillCooldownReason;
}
type SkillCooldownStartResult =
  | {readonly status: 'started'; readonly reason: 'none'; readonly assessment: SkillCooldownAssessment;
      readonly durationMs: number; readonly state: SkillCooldownState}
  | {readonly status: 'rejected'; readonly reason: 'cooldown_active'; readonly assessment: SkillCooldownAssessment;
      readonly durationMs: null; readonly state: null};
function createSkillCooldownState(instance: SkillInstanceState): SkillCooldownState;
function evaluateSkillCooldownReady(instance: SkillInstanceState, state: SkillCooldownState,
  context: GameplayExecutionContext): SkillCooldownAssessment;
function startSkillCooldown(instance: SkillInstanceState, state: SkillCooldownState,
  context: GameplayExecutionContext, config: SkillCooldownConfiguration): SkillCooldownStartResult;
```

Instance/state/config are closed own-data records: reject missing/unknown/symbol/
accessor/inherited required fields without invoking accessors. IDs are exact
nonblank strings and all three state identities must match the instance. State
timestamps are both null or finite >=0 with readyAtMs>=startedAtMs. Factory captures
identity as null/null without time, RNG or IDs. Configuration requires finite
baseDurationMs>=0 and finite effectiveCdr in [0,1]; no defaults/coercion/clamping.
Malformed records throw TypeError before provider access or ordinary rejection.

Readiness/start each read readExecutionTime(context) exactly once after validation.
Foundation rejects invalid/nonfinite/negative clock values; provider errors
propagate. now<startedAtMs throws TypeError. Never-started and now>=readyAtMs are
ready/none/remaining0. Otherwise active/cooldown_active with remaining=readyAtMs-now.
Readiness does not mutate expired timestamps. Start's assessment describes the
preattempt snapshot. Active reuse returns rejected, durationMs:null/state:null,
without calculating duration, refreshing or applying changed configuration.

Ready start delegates to pinned calculateCooldownDurationMs(baseDurationMs,
effectiveCdr) from @rpg/core/kernel and uses the returned duration unchanged.
readyAtMs=now+durationMs must be finite and strictly later for positive duration,
otherwise TypeError; no epsilon/rounding/double reduction. Zero duration permits
same-time repeated starts. Successful state captures the current observation,
not the old deadline. All output objects/nested assessments are detached/frozen;
caller-owned data/providers are neither frozen nor mutated.

Cooldown is independent of cost/admission/Combat/rank. Readiness or a successful
candidate is not activation or authority. L3 supplies resolved effective CDR/base
duration. L4 owns clock origin/monotonic policy, snapshot freshness, authoritative
commit and coordinating later activation. No cross-call rewind history, timer,
scheduler, store, events, refunds or implicit global state. Optional skill->[entity]
unchanged; shared Foundation execution is not an optional-module dependency.

## SK21–SK25 Skill activation and execution (v0.5.4)

Root-only additions:2 functions/9 types; total75 functions/125 types.

```ts
export interface SkillExecutionIntent {
  readonly attemptId: string;
  readonly dispatch:
    | {readonly kind: 'combat'; readonly actionId: string; readonly actionType: string; readonly targetEntityId: string}
    | {readonly kind: 'caller'};
}
/** Explicit caller assertion; canonical Combat preflight remains caller-mediated. */
export type SkillExecutionPreflight =
  | {readonly kind: 'combat'; readonly status: 'accepted' | 'rejected'}
  | {readonly kind: 'caller'; readonly status: 'accepted' | 'rejected'};
export interface SkillActivationInput {
  readonly instance: SkillInstanceState;
  readonly admission: SkillAdmissionResult;
  readonly resourceState: EntityResourceState;
  readonly resourceCosts: SkillResourceCostRequest;
  readonly cooldownState: SkillCooldownState;
  readonly cooldownConfig: SkillCooldownConfiguration;
  readonly executionContext: GameplayExecutionContext;
  readonly intent: SkillExecutionIntent;
  readonly executionPreflight: SkillExecutionPreflight;
}
export type SkillActivationRejectionReason = 'skill_admission_rejected' | 'execution_preflight_rejected'
  | 'resource_cost_rejected' | 'cooldown_active';
export interface SkillExecutionRequest {
  readonly attemptId: string;
  readonly instanceId: string;
  readonly skillId: string;
  readonly actorEntityId: string;
  readonly dispatch: SkillExecutionIntent['dispatch'];
}
export type SkillActivationResult =
  | {readonly status: 'accepted'; readonly reason: 'none'; readonly request: SkillExecutionRequest;
      readonly resources: EntityResourceState; readonly cooldown: SkillCooldownState}
  | {readonly status: 'rejected'; readonly reason: SkillActivationRejectionReason;
      readonly request: null; readonly resources: null; readonly cooldown: null};
export type SkillExecutionStatus = 'completed' | 'failed';
export interface SkillExecutionReport {readonly status: SkillExecutionStatus}
export interface SkillExecutionOutcome {
  readonly attemptId: string;
  readonly instanceId: string;
  readonly skillId: string;
  readonly actorEntityId: string;
  readonly dispatchKind: 'combat' | 'caller';
  readonly status: SkillExecutionStatus;
}
function activateSkill(input: SkillActivationInput): SkillActivationResult;
function reportSkillExecutionOutcome(request: SkillExecutionRequest,
  report: SkillExecutionReport): SkillExecutionOutcome;
```

Every supplied Skill data record is closed own-data: no missing/unknown/symbol/
accessor/inherited required fields. IDs are nonblank, exact strings. Instance,
admission, Resource and Cooldown identities must match; preflight kind must match
dispatch. Shared private validation captures complete configuration before
ordinary rejection; Resource state validation remains canonical Entity. No
transitions or time observation during admission/preflight rejection.
Opaque Foundation executionContext is passed unchanged: nonobject/array inputs
fail structurally; capability identity and provider validation occur canonically
when startSkillCooldown is reached. Skill does not inspect its bindings or invent
a second validator. Invalid supplied data throws TypeError; canonical numerical
and provider errors propagate without conversion to ordinary rejection.

Gate priority: skill_admission_rejected > execution_preflight_rejected >
resource_cost_rejected > cooldown_active > accepted. Resource application reuses
applySkillResourceCosts; a failed payment never reads time. Cooldown start reuses
startSkillCooldown once after successful payment, reads exactly once, and returns
its canonical candidate unchanged. A cooldown rejection discards the payment
candidate. Every ordinary rejection exposes exactly status/reason and three null
request/resources/cooldown fields. Acceptance exposes one immutable request,
one detached Resource candidate and one immutable Cooldown candidate. No input
is mutated or frozen. Literal example: mana100/cost25 ->75, now1000,
base1000/CDR.25 -> ready1750. Free/zero-duration activation remains explicit.

Preflight is a caller assertion, not authorization/provenance or a Combat receipt.
For combat, L4 creates the canonical context from actor+intent, runs actual Combat
admission/target validation, and derives preflight before activation. After
acceptance L4 decides whether/how to commit candidates and reconstructs Combat
context from request.actorEntityId + dispatch.actionId/actionType/targetEntityId,
then calls canonical Combat attack/application. Skill never imports Combat.
L3 owns policy/configuration and eligibility. No request generation implies
execution, hit, damage, life transition or events.

Outcome reporting captures caller assertions only: completed includes a finished
dodge, failed records external execution failure. It does not execute, refund,
rollback, retry or prove success. Reports are detached scalar immutable snapshots;
caller reports/requests remain untouched. Duplicate attemptId is accepted: no
exactly-once ledger, reservation, concurrency protection or authoritative runtime
commit. These remain L4 concerns. No Effect System or complete game runtime.

## SK26–SK30 Skill Slots & Loadout (v0.5.5)

Root-only additions:5 functions/8 types; total80 functions/133 types.

```ts
export interface SkillLoadoutLayout {
  readonly loadoutId: string;
  readonly slotIds: readonly string[];
}
export interface SkillLoadoutSlot {
  readonly slotId: string;
  readonly instanceId: string | null;
}
/** References only; instance resolution, active selection and persistence belong to L4. */
export interface SkillLoadoutState {
  readonly entityId: string;
  readonly loadoutId: string;
  readonly slots: readonly SkillLoadoutSlot[];
}
export interface SkillSlotAssignmentPolicy {
  readonly eligible: boolean;
  readonly allowDuplicateInstance: boolean;
}
export interface SkillSlotRemovalPolicy {readonly eligible: boolean}
export type SkillLoadoutMutationOperation = 'assign' | 'replace' | 'remove';
export type SkillLoadoutMutationReason = 'none' | 'slot_not_found' | 'slot_ineligible'
  | 'slot_occupied' | 'slot_empty' | 'same_instance' | 'instance_already_assigned';
export type SkillLoadoutMutationResult =
  | {readonly status: 'applied'; readonly reason: 'none'; readonly operation: SkillLoadoutMutationOperation;
      readonly slotId: string; readonly beforeInstanceId: string | null; readonly afterInstanceId: string | null;
      readonly state: SkillLoadoutState}
  | {readonly status: 'rejected'; readonly reason: Exclude<SkillLoadoutMutationReason, 'none'>;
      readonly operation: SkillLoadoutMutationOperation; readonly slotId: string;
      readonly beforeInstanceId: string | null; readonly afterInstanceId: null; readonly state: null};
function createSkillLoadoutState(entity: EntitySnapshot, layout: SkillLoadoutLayout): SkillLoadoutState;
function validateSkillLoadoutState(state: SkillLoadoutState): SkillLoadoutState;
function assignSkillLoadoutSlot(state: SkillLoadoutState, slotId: string, instance: SkillInstanceState,
  policy: SkillSlotAssignmentPolicy): SkillLoadoutMutationResult;
function replaceSkillLoadoutSlot(state: SkillLoadoutState, slotId: string, instance: SkillInstanceState,
  policy: SkillSlotAssignmentPolicy): SkillLoadoutMutationResult;
function removeSkillLoadoutSlot(state: SkillLoadoutState, slotId: string,
  policy: SkillSlotRemovalPolicy): SkillLoadoutMutationResult;
```

Factory validates Entity through createEntity and returns ordered empty slots from
L3 layout. Empty layout is valid; no default/minimum/maximum count or slot types.
All IDs are exact nonblank, case-sensitive strings, preserved without generation
or normalization. Slot IDs must be unique within the loadout. entityId+loadoutId
uniqueness across independent snapshots belongs to L4. Special identifiers such
as __proto__/constructor/toString use safe ordered-array references.

Canonical validateSkillLoadoutState validates complete closed own-data records
and dense own-data arrays, rejecting missing/extra/symbol/accessor/inherited
required fields without invoking getters, duplicate slot IDs and invalid nullable
instance references. It returns a detached frozen snapshot, including every slot.
Duplicate nonnull instance IDs and stale external references are structurally
valid; it does not consult a catalog or prove referential integrity.

Assign/replace reuse accepted private Skill Instance validation; entityId must
match loadout or TypeError. Policies require actual booleans and exact fields.
All supplied state/instance/slot ID/policy contracts validate before ordinary
rejection. Priority: slot_not_found > slot_ineligible > operation-specific state
reason > instance_already_assigned > none. Assign rejects occupied; replace
rejects empty then same_instance; remove rejects empty. Duplicate restrictions
apply only to assign/replace and exclude the target slot. same_instance wins even
when the instance also exists elsewhere. allowDuplicateInstance:true permits
shared references without copying the instance or creating per-slot cooldown.

Applied results expose the exact operation, slot ID, before/after references and
one immutable final Loadout candidate. Rejected results expose state:null and
afterInstanceId:null, with current target reference as beforeInstanceId (null if
missing/empty). No partial candidate is exposed. Unchanged slots retain order;
removal clears exactly the target reference, never every duplicate. All outputs
are frozen/detached; original caller inputs remain unchanged and unfrozen.

Example primary [null,null,null]: assign fireball to slot1, assign heal to slot2,
replace slot1 with lightning, remove slot2 -> [lightning-instance,null,null].
Each transition preserves earlier snapshots. Multiple loadouts remain independent.
Eligibility is a caller assertion, not proof of learning/admission or authority.
Loadout never calls admission, activation, costs, cooldown, Combat, providers or
events. Rank/Resource/Cooldown/Skill Instances stay in their canonical owners.
L3 owns layout/restrictions/duplicate policy; L4 owns active selection, reference
resolution, persistence and authoritative commit. No active-loadout manager,
Skill Instance registry/inventory, automatic activation, UI or move/swap/reorder.

## SK31–SK35 Skill installed integration (v0.5.6)

No new runtime functions/types or signature changes: root 80 functions/133 types
retained exactly from0.5.5. Installed skill-integration.mjs/.ts composes Foundation,
Entity, Progression, Skill and actual Combat public APIs. L3 supplies content/
layout/policies; L4 resolves references, preflights, checks current local inputs,
commits candidates and dispatches. Consumers are verification, not a production
facade. No new authorization, exactly-once, rollback/refund or concurrency promise.
See reports/v0.5.6-skill-final-review.md for current-artifact evidence.

## EN01–EN05 Encounter Foundation (v0.8.0)

Root-only runtime exports:

- createEncounterDefinitionReference(input: EncounterDefinitionReference): EncounterDefinitionReference
- createEncounterSide(input: EncounterSide): EncounterSide
- createEncounterParticipant(input: EncounterParticipant): EncounterParticipant
- createEncounterState(reference: EncounterDefinitionReference, initial: EncounterInitialState, entities: EntityCollection): EncounterState
- validateEncounterState(state: EncounterState, entities: EntityCollection): EncounterState

Types: EncounterDefinitionReference {readonly definitionId: string}; EncounterSide
{readonly sideId: string}; EncounterParticipant {readonly entityId: string;
readonly sideId: string}; EncounterStatus = prepared | active | resolved | closed |
cancelled (string literals). EncounterInitialState has readonly encounterId, sides
and participants. EncounterState has exactly readonly encounterId, definitionId,
status, sides and participants; arrays/records are readonly and deeply frozen.

Factories/validator capture detached snapshots, never freeze caller inputs, and
throw TypeError on malformed/extra/symbol/inherited/accessor fields, unsafe arrays,
blank IDs, duplicate sides/participants, unknown side or missing canonical Entity.
Factory always produces prepared, including empty rosters. Structural validator
recaptures all five statuses but proves no transition, Life admission or authority.
No package subpaths. Public inventory adds exactly five functions/six types;
existing APIs and signatures remain unchanged. See approved Encounter task.

## EN06–EN10 Encounter activation (v0.8.1)

Root-only additive functions:

- createEncounterActivationPolicy(input: EncounterActivationPolicy): EncounterActivationPolicy
- createEncounterActivationObservation(input: EncounterActivationObservation): EncounterActivationObservation
- evaluateEncounterActivationAdmission(state: EncounterState, entities: EntityCollection, policy: EncounterActivationPolicy, observation: EncounterActivationObservation): EncounterActivationAdmissionResult
- activateEncounter(state: EncounterState, entities: EntityCollection, policy: EncounterActivationPolicy, observation: EncounterActivationObservation): EncounterActivationTransitionResult

All data is readonly. EncounterActivationPolicy requires exactly
requiredOccupiedSideIds: readonly string[] (unique opaque nonblank IDs; empty
allowed), minimumParticipants/minimumOccupiedSides: positive safe integers,
allowedLifeStatuses: nonempty unique readonly EntityLifeStatus[], and
requireWorldReady: boolean. There are no defaults.
EncounterParticipantActivationFact has exactly entityId: string,
life: EntityLifeState (canonical entityId + alive/dead status), worldReady: boolean.
EncounterActivationObservation has exactly encounterId and readonly participants.
Duplicate facts, extra/missing/accessor fields, unsafe arrays, Life ID mismatch,
foreign participants and mismatched Encounter identity throw TypeError. Fact
absence is a domain rejection. Factories deeply copy/freeze and do not freeze
caller input. Observation factory cannot check a roster; evaluation does so.

Validation order is structural state/current collection → policy → observation
→ matching Encounter ID → no foreign facts, even for terminal states. Domain
first-match order: not_prepared → insufficient_participants →
insufficient_occupied_sides → required_side_unoccupied (policy order) →
participant_fact_missing → participant_life_not_allowed →
participant_world_not_ready. Participant stages each traverse roster order,
independent of observation order. Occupied sides come from participants.

EncounterActivationRejectionReason is exactly those seven string literals.
EncounterActivationAdmissionResult always has exactly status, reason,
encounterId, sideId, entityId: admitted/none has null diagnostic IDs; nonparticipant
rejections have null IDs except required_side_unoccupied names its side;
participant rejections name both roster side and Entity.
EncounterActivationTransitionResult always has status, reason, encounterId,
state: activated/none contains a deeply frozen detached active candidate;
rejected contains the same first-match reason and state:null. No diagnostic ID
fields or partial candidate. Only candidate status changes; original inputs,
Entity/Life and all prior snapshots remain unchanged. It revalidates original
inputs, accepts no admission token and does not reopen active/terminal state.

No spawn, catalog resolution, Life mutation, execution, event, time/RNG provider,
commit, cross-encounter exclusivity or exactly-once guarantee. L3 owns rules;
L4 owns current facts and authoritative CAS. Canonical Entity remains the owner.
Runtime root inventory is exactly139 functions; no package subpaths are added.

## EN11–EN15 Encounter membership (v0.8.2)

Five additive root functions / seven types; prior EN01–EN10 unchanged:

- createEncounterMembershipPolicy(input: EncounterMembershipPolicy): EncounterMembershipPolicy
- createEncounterMembershipRequest(input: EncounterMembershipRequest): EncounterMembershipRequest
- getEncounterParticipant(state: EncounterState, entities: EntityCollection, entityId: string): EncounterParticipant | null
- evaluateEncounterMembershipAdmission(state: EncounterState, entities: EntityCollection, policy: EncounterMembershipPolicy, request: EncounterMembershipRequest): EncounterMembershipAdmissionResult
- applyEncounterMembershipChange(state: EncounterState, entities: EntityCollection, policy: EncounterMembershipPolicy, request: EncounterMembershipRequest): EncounterMembershipTransitionResult

EncounterMembershipOperation = join | leave | change_side. EncounterMembershipOpenStatus
= prepared | active. EncounterMembershipPolicy requires joinAllowedStatuses,
leaveAllowedStatuses, changeSideAllowedStatuses (ordered unique open statuses;
empty denies), allowedJoinLifeStatuses (nonempty unique canonical alive/dead),
requireWorldReadyOnJoin:boolean. No defaults/coercion.
EncounterMembershipRequest is a closed readonly union: join has operation,
encounterId, entityId, sideId, readiness:EncounterParticipantActivationFact;
leave has only operation, encounterId, entityId; change_side adds only sideId.
Readiness and nested Life IDs must match entityId; request binds state.encounterId.
Complete state/current collection, policy and request validate before domain rejection,
including terminal inputs. Structural/correlation errors throw TypeError.

EncounterMembershipRejectionReason is encounter_not_open | operation_not_allowed |
side_not_found | entity_not_found | already_participating | participant_not_found |
already_on_side | join_life_not_allowed | join_world_not_ready.
Join priority: open → operation → declared destination → duplicate → canonical new
Entity → Life → World. Leave: open → operation → existing member. Transfer:
open → operation → existing member → declared destination → different side.

EncounterMembershipAdmissionResult contains exactly status(admitted/rejected),
reason(none/rejection), operation, encounterId, entityId, previousSideId, sideId.
previousSideId is current member's side or null, including rejection. sideId is
requested join/transfer destination (even nonexistent) or null for leave.
EncounterMembershipTransitionResult carries the same diagnostics and state:
applied/none has EncounterState; rejected has null. The transition recomputes all
inputs and accepts no admission token. Root runtime inventory is exactly144 names.

Join appends; leave removes only the member; transfer replaces sideId in place.
Every snapshot/read result is deeply frozen and detached; caller data stays mutable.
Identity, definition, status and declared side universe are preserved. Last-member
leave retains empty active/prepared state; no victory, cleanup or implicit activation.
No Life/Resource/Combat/AI mutation. Advisory facts and same-input replay do not prove
freshness, authorization, cross-Encounter exclusivity or exactly-once commit.
L4 must check current Entity/World/Encounter authority and commit atomically.
See the v0.8.2 task for exact unions and literal output oracle.

## v0.8.3 — EN16–EN20 Encounter action scope

Additive root-only functions (native ESM):

- createEncounterActionScopePolicy(input: EncounterActionScopePolicy): EncounterActionScopePolicy
- createEncounterActionScopeRequest(input: EncounterActionScopeRequest): EncounterActionScopeRequest
- evaluateEncounterActionScope(state: EncounterState, entities: EntityCollection, policy: EncounterActionScopePolicy, request: EncounterActionScopeRequest): EncounterActionScopeResult

Six types: EncounterActionTargetMode (none|participant),
EncounterSideMembershipRelation (self|same_side|other_side),
EncounterActionScopePolicy, EncounterActionScopeRequest,
EncounterActionScopeRejectionReason, EncounterActionScopeResult.
Policy has readonly targetMode and readonly allowedSideRelations array.
None requires an empty relation list; participant requires a nonempty unique list.
Request has exact readonly encounterId/actionId/sourceEntityId/targetEntityId;
target is null or an opaque nonblank ID. No normalization or inferred defaults.

Result has exact readonly status/reason and all request fields plus sourceSideId,
targetSideId, sideRelation. Eligible discriminates reason none and non-null source
side; rejected uses one of six reasons with nullable diagnostics. Targetless results
have null target side/relation. Structural validation of state/entities/full policy/
full request precedes domain outcomes; mismatched encounter identity throws TypeError.
Closed own-data objects/dense arrays only; getters are never evaluated. Factories and
results are detached and frozen without freezing input. No stored action counter.

First reason wins: encounter_not_active, source_not_participant, target_required,
unexpected_target, target_not_participant, side_relation_not_allowed, then eligible.
Source side remains null until source membership is established. Disallowed existing
target returns actual target side and relation. Self precedes same-side comparison;
other_side is never Combat enemy. Dead roster members can satisfy membership only.

ActionId is an opaque caller correlation value, no L2 ledger/authorization receipt.
Every call rereads only the supplied validated roster. L4 owns snapshot freshness,
canonical admission, execution, side-policy interpretation and authoritative commit.
No Combat/Skill/Effect/AI production import; encounter -> [entity] unchanged.
No cross-Encounter targeted actions, World, result/closure, spawning or scheduler.
