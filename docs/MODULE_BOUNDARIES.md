# Module Registry Contract

`harness/modules.json` declares optional Entity and optional Progression (dependent on Entity). Add entries **only with an approved implementation task**. Default convention is `src/modules/<id>`; changing conventions requires reviewing architecture checks.

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
