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
  separate from the static registry. EC01–EC03 has one canonical owner at
  `src/modules/entity/index.ts`, optional with no module dependencies.
  Root re-exports follow the same public-entrypoint
  boundary as sibling imports. Core is the only approved runtime package;
  dependency declarations and external source imports are checked.

The script is a **minimum static enforcement**. Semantic independence, registration/disable behavior and duplicate implementations require tests/review once modules exist.
