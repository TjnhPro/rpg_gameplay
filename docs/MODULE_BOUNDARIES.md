# Module Registry Contract

`harness/modules.json` starts empty. Add entries **only with an approved implementation task**. Default convention is `src/modules/<id>`; changing conventions requires reviewing architecture checks.

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
- The architecture registry declares only optional entity in v0.2.0. GF01–GF05 infrastructure has
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
