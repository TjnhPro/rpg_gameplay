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

EC07–EC09 adds `entity-stats.mjs`/`.ts` to that external package
installation. Five behavior scenarios cover immutable arbitrary base state and
collection-independent identity; malformed boundaries and no getter execution;
the independent 25/29/32 stat oracle plus explicit recalculation; real Kernel
modifier/ordering/bounds/precision semantics; and empty/special-key schemas plus
captured callback inputs and invalid callback returns. Strict declarations reuse
public Kernel types and enforce readonly maps, separate Entity state and no
attributeBases override. Old Foundation/Entity/Collection fixtures stay intact.
Source review supplements runtime evidence for canonical numerical ownership;
the v0.2.2 report maps R01–R23 without a test-count quota.

- **Unit/function**: public function, success/rejection, result and ownership.
- **Contract**: boundary, adapter interface, valid/invalid data, invariants.
- **Integration at function level**: composition of multiple exported functions with direct inputs/outputs; still no game loop/app.
- **Determinism when relevant**: clock/RNG supplied by caller, repeatable outcomes, no hidden global state.
- **Regression**: capture real failure, independent expected result, then fix and keep one focused regression.

No UI tests, rendering, asset pipelines, Godot, network server, browser E2E or three mini-games in L2 test suite. 'Turn-based' is a supported future mechanism, not a compulsory fourth profile yet.

## Test evidence format

Use table in [task template](tasks/TASK_TEMPLATE.md). Give exact command, files, pass/fail, expected behavior source, limitations. State `NOT_EVALUATED` for missing tests, not `PASS`.

A useful test should fail if the behavior is broken: avoid asserting only 'does not throw', blind snapshots or rewriting goldens to make tests green. Mutation/negative tests only where they prove a meaningful edge.

EC10–EC13 adds entity-resources.mjs/.ts through the same installed package.
Five scenarios group distinct contracts: arbitrary/empty/special-key initialization
and normalization; authoritative transitions/above-max/minimum recovery; explicit
regeneration and ignored-field no-op; atomic validation and accessor boundaries;
and deterministic actor isolation with EC08 explicit maximum handoff. Literal
oracles80/50/55/70,100→80,applied-20/10 and regen35 are independent of L2/Kernel
calls. Fractional applied retains the IEEE-754 difference of independently specified
before/after literals. Strict declarations prove composed Kernel compatibility,
readonly state/diagnostics, complete options and absence of implicit life state.
Old GF01–GF16/EC01–EC09 fixtures are unchanged. The v0.2.3 report maps R01–R25;
source review confirms canonical resource ownership, without a game/scheduler.

## EC14–EC17 installed life evidence

entity-life.mjs/.ts adds five grouped scenarios to the same external tarball
consumer: explicit10→0 defeat/0→30 recovery/revival and repeat no-ops; creation,
detachment and actor isolation; exact arbitrary keys/nonzero or negative minimum,
zero-width bounds/stale maximum and determinism with implicit time/RNG disabled;
closed malformed life/policy/forged-resource rejection before no-op; caller GF12
publication with GF13 order/snapshot/fail-fast and no rollback/retry. Expectations
are literal states/diagnostics/traces, not calls into implementation to derive
oracles. Full R01–R29 mapping is in the v0.2.4 report. Strict NodeNext verifies
five public types, readonly nested state/result/policy and closed inputs.
Old consumer fixtures remain unchanged. All 50 installed contracts and both outer
tests must run with zero skips. No gameplay profile/application evidence is claimed.

## EC18 installed integration and phase closure evidence

entity-integration.mjs adds one end-to-end contract, executed explicitly from an
external installed @rpg/gameplay@0.2.5 tarball with the real pinned Core. Two
sessions create separate providers, callbacks, messaging and immutable states;
each matches a literal expected trace before comparison with the other session.
The scenario covers shared actors/collection, stats 25/29/32, selected maximum,
health 30 to 25 to 20 to 0 to 10, explicit defeat/revival/publication, command and
listener failures, identity rejection, previous snapshots and actor isolation.
Runtime cleanup removes eight subscriptions; later delivery count is zero.
The new .ts consumer checks cross-domain typed wiring and readonly projections.
All 50 prior installed contracts remain unchanged: 51 total plus 2 outer tests,
zero skips. No count target drove this test; one scenario supplies R01-R30
integration evidence together with existing targeted contracts and source audit.
See reports/v0.2.5-entity-integration-closure.md for the full mapping and CI.

## PG01–PG03 installed creation evidence

The external tarball runner executes `progression.mjs` with three grouped contracts:
shared actors/exact numeric values/immutable detachment; closed validation and
canonical malformed Entity rejection without getters; collection/domain isolation,
determinism and explicit optional-module dependency composition. Literal states
are independent expected values. Fractional EXP, numeric extrema, -0 preservation,
unsafe levels, symbol/nonenumerable extras and reflection mutation are covered.
`progression.ts` verifies readonly types, closed input, root-only imports and strict
NodeNext usage. No simulator or additional gameplay behavior is introduced.
All 51 old GF/EC contracts remain unchanged; total 54 installed contracts plus
2 outer tests, zero skips. R01–R24 mapping is in the v0.3.0 checkpoint report.

## PG04–PG06 installed transition evidence

experience.mjs adds three grouped external installed-package contracts: literal
signed numeric/zero/floor/cap/fraction/overflow outcomes and frozen results; closed
state/options validation including no-op boundaries and getter non-evaluation,
atomic failure and detachment; actor/domain isolation, unchanged level and two
independent sessions matching the literal 100->350->250->300 oracle with implicit
time/RNG disabled. Each group proves distinct behavior; no profile duplication.
experience.ts checks root-only strict NodeNext exports and readonly result/input/
diagnostic contracts. Existing GF/EC/PG01–PG03 consumer bodies remain unchanged.
Total 57 installed contracts, 2 outer tests, zero skips; R01–R24 mapping in v0.3.1 report.
Source review supplements no-automatic-effects and single-update-path evidence.

## PG07–PG10 installed advancement evidence

advancement.mjs executes three grouped contracts in the fresh installed tarball
consumer: literal numeric/reason projections, whole-request fail-closed validation,
and immutable isolation/replay. Task scenarios A-L cover cumulative 3/260 and local
3/10/consumed250, partial prefix/eligibility/target/max, native fractions/zero/finite
boundaries, no auto-level-down, no implicit clock/RNG and independent actors/domains.
Each replay separately matches a literal oracle before the sessions are compared.
advancement.ts checks all six types, readonly structures, mandatory policy and
closed root-only exports under external strict NodeNext. No old fixture changed.
60 installed contracts total (29 GF, 22 EC, 9 PG), 2 outer tests, zero skips.
See v0.3.2 report for R01-R28 mapping. Game-profile behavior remains NOT_EVALUATED.

## PG11–PG13 installed point evidence

`tests/consumers/attribute-points.mjs` runs four grouped contracts through the real
packed/installed package: explicit state/actual receipts/rewards/cursor; malformed
inputs and overflow; canonical allocation and atomic rejection; independent
actors/domains plus literal deterministic replay and real Kernel integration.
Two sessions independently expect rewards5+5=10, spend3, final7/3/cursor3,
base20->23 and explicitly recalculated power45->51. Zero rewards, partial/no-level
advancement, updated-cursor replay, stale snapshot branching, frozen detachment,
exact unusual attribute keys and getter-free rejection are covered.
`attribute-points.ts` compiles strict external NodeNext root-only readonly types.
All 60 previous installed contracts retained:64 total (29GF+22EC+13PG),2 outer,
zero skips. R01–R30 mapping is in the v0.3.3 report. Game profiles NOT_EVALUATED.

## PG14–PG18 installed Skill evidence

Five grouped `skill-progression.mjs` contracts cover rank keys/zero/unknown/shape/
immutability; explicit pool/real receipts/rewards/independent cursors; upgrade/
learning/free/prerequisites/all blocker priorities/stale requests; malformed
state/policy rejection before blockers and safe integer boundaries; two independent
literal handoff sessions with other domains/actors unchanged and implicit clock/RNG
disabled. Expected level12,rank3,unspent1,spent2,cursor12 comes directly from task
scenario O (rewards1+2,cost2). Scenario D separately expects3/5->1/7,rank2->3.
Strict external NodeNext `skill-progression.ts` proves eleven public types,
readonly/required/closed shapes, optional lookup and root-only imports.
All64 previous installed contracts unchanged:69 total (29GF+22EC+18PG),2 outer,
zero skips. R01–R35 mapping in v0.3.4 report. No fake Skill Engine/game simulator.


## PG19 full Progression integration

progression-integration.mjs adds one cross-domain contract, not a second engine.
Both independent sessions create all snapshots/policies/contexts anew and each
matches literal final state/trace before comparing sessions. Actual PG09 receipts
feed AP and SP separately; real Entity/Kernel calculates45 ->51. Cumulative/local
projections, valid blockers, malformed later requirements, reward/upgrade replay,
unknown IDs, failed command/listener, immutable detachment, actor/resource/life
isolation and explicit GF12 publication/cleanup are observed. Date.now/Math.random
throw throughout sessions. GF providers remain unread. Existing milestone tests
supply exhaustive numeric/shape edge coverage without duplicating those suites.
External strict progression-integration.ts joins every old consumer. All69 prior
contracts remain unchanged:70 installed contracts,2 outer tests,zero skips.
R01-R36 and N01-N16 mappings are in the v0.3.5 report.

## F-001 pool isolation regression

One additional installed progression-integration.mjs test groups F01-F16:
all five cross-pool API calls (valid matching actors, sufficient/insufficient
points), malformed/missing/case/accessor/inherited kinds, closed initial/state
shapes, correct-kind grant/allocation/upgrade/blocked preservation and immutable
detachment. Getter/coercion calls remain0. Existing literal snapshots change only
by pointKind; PG19 numeric oracle unchanged. progression-integration.ts adds strict
negative calls/assignments/missing-kind assertions and exact literal return checks;
unused @ts-expect-error fails compilation. No any/cast bypass or config change.
Current total71 installed contracts +2 outer, zero skips; prior70 retained with
only authorized snapshot additions. Focused evidence and before/after installed
reproduction are in reports/v0.3.5-f001-point-pool-isolation-fix.md.

## CB01–CB05 installed Combat evidence (v0.4.0)

combat.mjs adds four distinct contract groups: exact/frozen/detached/role-neutral
intent; closed invalid-shape/primitive/accessor rejection; optional dependency
composition; two independent literal-oracle sessions and mode-neutral caller data
with unchanged Entity/Progression/resource/life snapshots. Each covers approved
R01–R25 invariants mapped in the checkpoint report, without execution tests.
combat.ts proves required readonly root/nested fields, exact target literal,
string-only IDs, no accidental any, absent execution data and root-only imports.
The existing runner packs actual gameplay0.4.0, installs alongside pinned real
Core into an independent temporary consumer, and runs both runtime and strict
NodeNext evidence (skipLibCheck:false). No source import/link or Core mock.

75 installed contracts = 71 retained Group A + 4 Combat; 2 outer gate tests,
zero skips. Existing fixture oracles stay unchanged; runner inventory changes
only add the approved files/export/version/consumer. Static boundary checks and
source review supplement functional evidence for no state, engines or hidden
providers. Mode labels exercise the same structural contract, not three games
or gameplay execution. Report: reports/v0.4.0-combat-foundation.md.

## CB06–CB10 admission evidence (v0.4.1)

combat-admission.mjs adds four installed groups: positive/parity/target independence;
rejection priority and identity isolation; malformed-before-rejection/accessor
safety; immutable deterministic sessions and domain independence. Literal context
and admitted/none or named rejection outputs derive from approved scenarios A–L.
Dropped groups would lose distinct boundary evidence. No simulator or duplicated
Entity suite; a small malformed collection probe confirms canonical validation.
combat-admission.ts checks required explicit Life/policy, boolean-only policy,
readonly result/nested data, exact reason/status unions, no any and root-only API.
Existing75 installed contracts stay unchanged; current total79 plus2 outer tests,
zero skips. Strict NodeNext directives are active (unused expect-error fails).
Actual installed0.4.1/Core tarballs run in the existing independent temp consumer.
