# Function-First Testing Policy — evidence over count

`rpg_gameplay` is **code/library**, not a game. No full Text RPG, 2D or 2.5D sample application is needed or permitted just to test L2.

## Principle

Prove public function behavior and cross-function contracts with minimal, independent evidence. One test can cover multiple invariants **if each is observable**; conversely split scenarios when they prove distinct semantics. There is no fixed count or coverage-percentage KPI. Do not fill matrix Cartesian products without behavior difference.

## Test justification checklist (mandatory for additions)

1. Which approved requirement/invariant does this test prove?
2. What observable input, output/state transition or event trace demonstrates it?
3. Where does the expected result come from (contract, independently computed value, independent fixture, approved oracle)? **Do not copy the current output into the expected value as a shortcut.**
4. Would dropping this test lose any distinct evidence? If not, merge/remove it.
5. On which profile(s) does the behavior materially differ? If none, test once as a shared function.

### Three *functional profiles*, not consumer applications

| Profile | Functional differentiation |
| --- | --- |
| Text RPG | Action-only/no coordinate; ensure spatial/renderer not required |
| RPG 2D | Coordinate/range/collision inputs **only for modules supporting them** |
| RPG 2.5D | Direction/delivery/alignment metadata **only for modules supporting them**; no renderer |

Avoid forcing Inventory/Item/Progression through three duplicate fixtures unless rules differ. 2D and 2.5D profiles must **actually probe different behavior** if both tested.

## Layers of tests

The package uses Node's built-in test runner (`tests/*.test.mjs`). The functional gate
proves installed package/declaration/Kernel integration contracts and verification
failure propagation plus installed-package GF01–GF16 contracts. Lifecycle probes record explicit hook order, progress and failure/cleanup
without concrete gameplay modules. Runtime snapshots and replay/reentrancy controls
are tested alongside independent instances. Messaging probes additionally prove
exact routing/results, registration-order
fan-out, publish snapshots, fail-fast completed deliveries, unsubscribe/owner
cleanup, explicit lifecycle wiring, isolation and reflection/reentrancy boundaries.
Payload/value ownership and strict public types are checked without game rules.
The consumer fixtures under `tests/consumers/` are copied into the external installation and
run there; they never import repository source. Execution probes prove explicit
clock/RNG/ID reads, output validation, ownership and reflection/isolation. Two
independent scripted sessions compare full Foundation semantic traces against a
literal contract oracle, including changed providers and deterministic failures.
One shared integration flow covers all owners; small Text/2D/2.5D probes verify
action-only and opaque position/direction payloads. This is Foundation data
compatibility evidence; gameplay behavior remains NOT_EVALUATED.
Build before running `npm run test:functional` directly; `verify` builds
first. Expected values and requirement mapping are in the implementation report.

EC01–EC03 uses `tests/consumers/entity.mjs` and `entity.ts` through that same
external tarball installation. Three scenarios prove shared actor types/exact
strings/immutable detached snapshots, closed malformed-input rejection without
accessor invocation or partial state, and optional module composition with an
explicit caller ID provider. Strict declarations prove readonly/string-only
fields and reject premature state. No game runtime or duplicate profile matrix.
Expected data is specified from the task contract; old Foundation fixtures remain
unchanged. See the v0.2.0 report for R01–R15 evidence and limits.

EC04–EC06 adds `entity-collection.mjs`/`.ts` to the same external installation.
Three scenarios prove ordered operations/exact collection-local identity and
determinism under forbidden implicit time/RNG, immutable branching/input ownership,
and atomic duplicate/unknown/malformed rejection including canonical EC03
accessor/extra-field checks. Strict types cover readonly membership/enumeration,
optional lookup and complete replacements, with no generic state/numerical fields.
Existing Entity/Foundation fixtures stay unchanged. The v0.2.1 report maps R01–R18
to independent literal expectations, installed evidence and source review.

- **Unit/function**: public function, success/rejection, result and ownership.
- **Contract**: boundary, adapter interface, valid/invalid data, invariants.
- **Integration at function level**: composition of multiple exported functions with direct inputs/outputs; still no game loop/app.
- **Determinism when relevant**: clock/RNG supplied by caller, repeatable outcomes, no hidden global state.
- **Regression**: capture real failure, independent expected result, then fix and keep one focused regression.

No UI tests, rendering, asset pipelines, Godot, network server, browser E2E or three mini-games in L2 test suite. 'Turn-based' is a supported future mechanism, not a compulsory fourth profile yet.

## Test evidence format

Use table in [task template](tasks/TASK_TEMPLATE.md). Give exact command, files, pass/fail, expected behavior source, limitations. State `NOT_EVALUATED` for missing tests, not `PASS`.

A useful test should fail if the behavior is broken: avoid asserting only 'does not throw', blind snapshots or rewriting goldens to make tests green. Mutation/negative tests only where they prove a meaningful edge.
