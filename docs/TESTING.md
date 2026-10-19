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
failure propagation plus installed-package GF01–GF05 contracts. The consumer
fixtures under `tests/consumers/` are copied into the external installation and
run there; they never import repository source. They contain no game or gameplay profile
evidence. Build before running `npm run test:functional` directly; `verify` builds
first. Expected values and requirement mapping are in the implementation report.

- **Unit/function**: public function, success/rejection, result and ownership.
- **Contract**: boundary, adapter interface, valid/invalid data, invariants.
- **Integration at function level**: composition of multiple exported functions with direct inputs/outputs; still no game loop/app.
- **Determinism when relevant**: clock/RNG supplied by caller, repeatable outcomes, no hidden global state.
- **Regression**: capture real failure, independent expected result, then fix and keep one focused regression.

No UI tests, rendering, asset pipelines, Godot, network server, browser E2E or three mini-games in L2 test suite. 'Turn-based' is a supported future mechanism, not a compulsory fourth profile yet.

## Test evidence format

Use table in [task template](tasks/TASK_TEMPLATE.md). Give exact command, files, pass/fail, expected behavior source, limitations. State `NOT_EVALUATED` for missing tests, not `PASS`.

A useful test should fail if the behavior is broken: avoid asserting only 'does not throw', blind snapshots or rewriting goldens to make tests green. Mutation/negative tests only where they prove a meaningful edge.
