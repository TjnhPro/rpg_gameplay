# Module Registry Contract

`harness/modules.json` declares optional Entity, Progression, Combat and Skill; the latter three depend only on Entity. Add entries **only with an approved implementation task**. Default convention is `src/modules/<id>`; changing conventions requires reviewing architecture checks.

Example (documentation only, **not an implemented module**):

```json
{
  "schemaVersion": 1,
  "modules": [
    {"id": "inventory", "optional": true, "dependencies": []},
    {"id": "equipment", "optional": true, "dependencies": ["inventory"]}
  ]
}
```

Rules:
- Each module has one canonical owner and dependency list. `dependencies` are module IDs, not file paths.
- Consumers may enable optional modules independently subject to their **declared** dependencies.
- Cross-module source imports must target sibling public `index.*`, not internal private paths.
- `src/shared` and `src/contracts` are lower-level; cannot import modules. `src/index.ts` may re-export public modules.
- Production `src/` is headless; no UI/renderers/engine package or Node built-ins for gameplay.
- Core numerical computation is delegated to `@rpg/core/kernel` only.
- No module added to registry simply to satisfy catalog count; no empty placeholders.
- The architecture registry declares optional entity and progression in v0.3.0. GF01–GF05 infrastructure has
  one owner at `src/foundation/modules/`; root exports its public functions/types.
  GF06–GF09 lifecycle coordination has a separate canonical owner at
  `src/foundation/runtime/`, consuming the Module public entrypoint. GF10–GF13
  command/event coordination has one owner at `src/foundation/messaging/`, also
  consuming only Module's public entrypoint. GF14–GF16 execution dependencies
  have one independent owner at `src/foundation/execution/`. All four are
  separate from the static registry. EC01–EC18 has one canonical owner at
  `src/modules/entity/index.ts`, optional with no module dependencies.
  Root re-exports follow the same public-entrypoint
  boundary as sibling imports. Core is the only approved runtime package;
  dependency declarations and external source imports are checked.

EC04–EC06 collection membership/ordered snapshots remain inside Entity, not a new
module/store. Collection operations call canonical EC03 creation/validation and
return frozen detached data. No Foundation dependency, implicit provider or
numerical Kernel call is needed; the static Entity entry remains unchanged.

EC07–EC09 extends Entity with separate typed immutable base state and explicit
Kernel-stat orchestration. Entity imports only `@rpg/core/kernel` for numerical
work. No attributes/stats module, dependency entry, Foundation coupling, numerical
fallback or duplicate owner is introduced. Entity remains optional/dependencies[].

The script is a **minimum static enforcement**. Semantic independence, registration/disable behavior and duplicate implementations require tests/review once modules exist.

EC10–EC13 adds current-only frozen Resource State to that same owner. Only public
Kernel normalization/transition/regeneration owns resource arithmetic. Explicit
caller bounds/policy/time and stat maximum handoff create no Foundation/module
dependency, global store, scheduler or new registry entry. EC01–EC09 and GF01–GF16
owners/contracts stay intact; EC14–EC17 life state is described below.

EC14–EC17 also belongs to src/modules/entity/index.ts. Separate life snapshots
associate by exact entityId, not collection membership. Private shared resource
validation is reused; no new module/dependency, resource calculator or engine.
Caller may wire returned life outcomes into GF12; Entity imports no Foundation
messaging/runtime owner and performs no implicit publication or lifecycle work.

## v0.2.5 phase review

EC18 adds installed consumer fixtures only, no production owner/API or module.
Entity remains optional, dependencies [], under src/modules/entity/index.ts.
The root surface remains 46 functions and 49 types; deep imports stay blocked.
Foundation sources are byte-for-byte unchanged from the accepted phase baseline.
Caller wiring, including event publication and cleanup, lives in test consumers.

## PG01–PG03 ownership

Optional progression has one owner `src/modules/progression/index.ts` and one
static dependency, entity. Its only sibling import is `../entity/index.js` for
createEntity/EntitySnapshot, with no private helpers or duplicate EC03 validator.
Root re-exports only the public entrypoint. Both modules must be explicitly
selected for composition; Foundation resolver behavior remains unchanged.
No new Foundation owner, numerical calculator, runtime package or global store.

## PG04–PG06 same canonical transition owner

Experience remains in progression/index.ts, with no new registry/module/dependency.
Shared private PG03 shape/numeric helpers validate creation and transitions;
adjustExperience owns the only EXP update path, gainExperience delegates. No second
EXP store, Foundation dependency or Entity private import. Only task-approved
scalar addition/floor/cap/after-before diagnostics are performed at L2; no curve,
modifier, rounding algorithm or fabricated Kernel resource policy is introduced.
Core and Entity ownership/delegation are unchanged.

## PG07–PG10 advancement ownership

Level stays in ProgressionState; no Level owner/store/module is added.
src/modules/progression/index.ts owns one shared dry-run/advance resolver and
reuses existing state/level validation. Static optional progression -> entity is
unchanged; there is no Foundation/runtime/messaging import or execution binding.
Caller supplies complete policy, external eligibility and EXP mode consistency.
No Entity/Foundation/Core changes, hidden event, formula or second engine.

## PG11–PG13 point ownership

Progression owns only its separate point pool/cursor/reward/allocation bookkeeping.
It consumes PG09 results and public Entity `getEntityBaseAttributes` /
`setEntityBaseAttribute`; no copied attribute validation, new owner or calculator.
Optional progression -> entity dependency and static registry remain unchanged.
No Foundation/Core changes, global store or automatic events.

## PG14–PG18 Skill ownership

Skill ranks/point pool/rewards/upgrade requirements belong to Progression, not a
Skill Engine or second point authority. Small private point helpers shared with
PG11–PG13 preserve semantics; independent public typed pools/cursors remain.
One private resolver serves evaluate/upgrade. Only public Entity identity creation
is needed; no new sibling/module/dependency or Core/Foundation/Entity changes.
No graph/condition engine, runtime Skill catalog or module-global state.


## PG19 closure audit

No new module or production export. The full Progression phase adds only the
canonical progression/index.ts owner and root exports. Entity/Foundation and CI
sources are unchanged from the merged Entity baseline; the phase registry delta
is only optional progression -> entity, introduced by v0.3.0 and unchanged since.
PG19's consumer composes both explicitly; selecting progression alone still
rejects. No copied Entity setter/validator, Kernel calculator, Skill Engine,
Foundation event bus, hidden synchronization or global reward authority.

## CB01–CB05 ownership (v0.4.0)

Current registry: optional entity -> [], progression -> [entity], combat -> [entity].
Existing metadata/entries are preserved. Combat has one owner at
src/modules/combat/index.ts (no imports at v0.4.0); opaque references need no fake Entity
or full Entity validator. No progression/skill/effect/encounter dependency.
Root adds only createCombatActionContext and CombatEntityTarget/CombatActionRequest/
CombatActionContext (61 runtime functions / 80 types total). No deep exports.
Explicit selection entity+combat resolves entity then combat; combat-only rejects.
Progression can be omitted or selected independently with its existing dependency.
No Foundation/Entity/Progression source semantics, Core pin or dependency changes.
No new registry placeholders, execution binding, state store or numerical owner.

## CB06–CB10 admission boundary (v0.4.1)

combat -> entity remains the only Combat module dependency; registry unchanged.
Combat now consumes public getEntity and EntityCollection/EntityLifeState from
../entity/index.js. CB03 creation stays provider/lookup-free; admission reuses
that factory then canonical lookup instead of scanning collection.entities.
Life boundary checks schema/identity only, never death/revival logic. No other
production source changes except root exports: evaluateCombatActionAdmission,
CombatActorEligibilityPolicy/CombatAdmissionStatus/CombatAdmissionReason/
CombatAdmissionResult (62 functions /84 types total). No new module/deep export,
Skill/Effect/Progression coupling, Kernel call or runtime binding.


## CB11-CB15 target boundary (v0.4.2)

Combat -> Entity remains unchanged. Public getEntity owns target lookup and
collection validation. Canonical EntityLifeState/EntityLifeStatus are reused;
private readLife shares the prior admission schema/identity checks. No Group A
production, Core, static registry or dependency delta. Root adds only
 evaluateCombatTargetValidation and CombatTargetRelation/CombatTargetPolicy/
CombatTargetValidationStatus/CombatTargetRejectionReason/CombatTargetValidationResult
(63 functions/89 types). No deep exports or private helpers escape. No Faction,
Target Store, targeting engine, Skill owner, numerical work or source re-admission.

## CB16–CB20 attack boundary (v0.4.3)

Combat imports only the public @rpg/core/kernel numerical entry point and existing
Foundation execution nextExecutionRandom. It reuses actual admission/target
result types; neither admission nor target existence/policy is rerun. Full action
identity must match. Structural receipts are not authenticated reservations.
No production delta in Foundation/Entity/Progression, Core, registry or dependencies.
Root adds resolveCombatAttack and CombatAttackInput/CombatAttackOutcome/
CombatAttackResolutionResult (64 functions/92 types). No deep exports or helper
exports. Combat never writes resource/Life state or publishes events. Kernel
owns Hit, Critical, B0, B1 and Mitigation; caller owns numerical snapshots/policy.

## CB21–CB25 damage/death boundary (v0.4.4)

Same Combat owner reuses public Entity getEntityResourceCurrent (full snapshot
validation without mutation), transitionEntityResource and resolveEntityDefeat.
It reuses the existing private Life shape/identity helper plus canonical Life
prototype validation. No Entity/Foundation/Progression, Core, registry/dependency
or CI changes. Root adds applyCombatAttackDamage and CombatDamageApplicationPolicy/
CombatDamageApplicationOutcome/CombatDamageApplicationResult:65 functions/95 types.
No new modules/deep exports or validators exported. Damage/Life calculations are
not duplicated; no automatic publish, Skill/Effect/Encounter or reward coupling.

## CB26–CB30 closure boundary (v0.4.5)

No production changes in this milestone. Full phase audit: Combat owner/root
exports only; Group A owners byte-identical to merged PR #8 baseline. Registry
adds only optional combat depending on entity; progression remains optional and
independent. Static owner checks cover3 modules/8 sources. Installed tests select
entity+combat without progression; combat-only fails without auto-enablement.
Canonical numerical/resource/life delegation and absence of stores/formulas/events
are reviewed in reports/v0.4.5-combat-integration-closure.md. Lexical checks alone
are not architectural proof; source review plus installed behavior supply evidence.

## SK01–SK05 Skill boundary (v0.5.0)

Canonical owner src/modules/skill/index.ts imports only public createEntity and
EntitySnapshot from ../entity/index.js. Static optional skill depends only on
entity; no Progression/Combat/Effect or Foundation coupling. Identity-only local
own-data validation does not duplicate Entity validation. Root adds exactly
createSkillDefinition/createSkillInstance and SkillDefinition/
SkillInstanceInitialState/SkillInstanceState. No helper/deep exports, catalog,
rank/point/Resource/Life state, numerical calculator, runtime or global authority.
Current root67 functions/98 types, registry4 modules/9 sources. Accepted owners,
Core pin and runtime dependencies unchanged. Actual registry composition and
source review supplement lexical boundary checks.

## SK06–SK10 admission boundary (v0.5.1)

Same Skill owner adds evaluateSkillActivationAdmission; imports public getEntity
and EntityCollection/EntityLifeState types. Existence and collection validation
reuse canonical getEntity. Life shape/status/actor association are validated with
no HP inference or Entity transition. Rank is an explicit scalar snapshot; caller
reads canonical Progression getSkillRank. No Skill production Progression/Combat
imports or static dependency changes. skill -> [entity] remains optional; sibling
owners/Core pin are untouched. No second ownership/rank/Life store, calculator,
generic admission engine, cache or execution session. L3 supplies booleans and rank
requirements; L4 supplies freshness/authority and coordinates later execution.
Current root68 functions/103 types; registry4 modules/9 sources unchanged.

## SK11–SK15 resource-cost boundary (v0.5.2)

Skill imports getEntityResourceCurrent/transitionEntityResource and Resource types
from public Entity only. Full-state validation stays canonical Entity; copied
validated data supports detached free snapshots without normalization. Positive
amounts delegate to Entity->Core; Skill only compares canonical applied to cost.
No resource arithmetic, direct Core import, interim state authority or new store.
Optional skill->[entity] unchanged. Protected owners/registry/Core pin/deps remain
unchanged. Root adds two functions/seven types:70 functions/110 types total.

## SK16–SK20 cooldown boundary (v0.5.3)

Skill imports only calculateCooldownDurationMs from @rpg/core/kernel for duration,
and readExecutionTime/GameplayExecutionContext from shared Foundation execution.
No provider access or copied CDR math. Private validation, identity matching,
timestamp bookkeeping and immutable ready/start candidate orchestration stay in
Skill; Foundation owns execution bindings/clock validation. No Foundation, Entity,
Progression, Combat, Core/pin or registry changes. skill->[entity] unchanged;
Foundation is shared infrastructure, not a declared optional-module dependency.
Root adds3 functions/6 types:73/116 total. No global state, second engine,
activation, automatic timers/events or authoritative commit.
