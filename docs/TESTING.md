## v0.6.5 status/restriction evidence

Eight installed effect-restrictions.mjs contracts group S01–S37 by invariant:

| Contract group | Independent evidence |
| --- | --- |
| Capture (S01–S06/S10–S12/S31–S32) | Explicit empty/independent arrays, exact custom/case/special IDs, literal snapshots, detached deep freeze |
| Provenance (S09/S20–S22) | Literal ordered views, two matching sources, one removal leaves other blocking |
| Cleanup (S14–S19) | Both refresh paths retain capture, replacement TypeError, exact-N selection, group isolation, persistent and exact expiry |
| Validation (S07–S08/S28–S30) | Closed own-data records, dense arrays, duplicates/getters0, wrong Entity/order/time, unresolved expiry fails closed |
| Transitions (S13/S29–S30) | Missing capture/null, canonical rejected receipts, forged deltas/events, stale baseline and joint-commit refusal |
| Admissions (S02–S03/S23–S24/S27–S28) | Actual Skill/Combat calls, ownership/rank/life/existence/eligibility retained, actor binding, target relation still independent |
| Immunity (S04/S25–S26) | Actual EF08 rejection, unrelated Effect policy accepted, all independent gates, multiple immunity identities |
| Replay (S33–S35) | Two independent literal traces, shared modifier lifecycle, actual Entity source death, unchanged resources/ranks/stats/cooldown, blocked implicit providers |
| Artifact/types/regression (S36–S37) | Physical tarballs, strict external NodeNext, all prior consumers |

Six installed JS faults plus real caller admission-bypass faults must fail the
same consumer. Skip/no-assertion/missing fixture/export/wrong version/Core/TAP/TS
controls remain mandatory. Previous expected values and fixtures are unchanged;
old modifier fault anchors alone follow the extracted private validator metadata.
Test counts describe observed execution, not a quota. No full gameplay profile
acceptance, periodic behavior, runtime scheduler or automatic events are claimed.

## v0.6.4 modifier contract evidence

Seven installed effect-modifiers.mjs contracts cover classification/snapshot/identity;
actual Entity/Core math, attributes, disabled/points, collision and target ownership;
stack/consume/refresh; expiry/removal/group/persistence/pending expiry; complete
closed-data/membership/capture validation; forged transition/action/event deltas;
and independent literal replays with implicit time/RNG/timers blocked and three
source origins. Strict effect-modifiers.ts checks six types, three signatures,
Core operation/output reuse, readonly nesting and result discrimination. Assertion
counters fail empty contracts; emitted markers follow real assertions. All prior
fixtures/oracles remain unchanged. New negative controls exercise wrong numerical
expected, stale expiry, consumed contribution, overwritten refresh payload,
unsupported-op acceptance, skipped test and no assertions. Existing missing fixture,
export/version/Core-integrity/TS/TAP controls remain mandatory. No count quota or
gameplay-profile acceptance is claimed.

## v0.6.3 stacking contract evidence

Seven installed tests cover distinct contracts: exact derived grouping/source
isolation; admission/baseline/capacity/priority; anchor-preserving nonshortening
renewal/independent expiry/persistent rules; exact-N/group removal/order; explicit
pending-expiry boundary; malformed closed records/getters/arithmetic/isolation;
and two independent literal replays with implicit providers blocked. S01–S29 map
to these observable assertions; S30 uses all prior consumers; S31 is the installed
tarball and strict NodeNext gate. No historical fixtures or expected values change.
Compiler evidence checks all nine types/six signatures, discriminants, readonly
nesting and closed private/deep exports. Real installed JS fault injections prove
overflow, partial consume and identity-replacement regressions cannot pass.
No numerical modifier/periodic or gameplay-profile PASS is implied.

## v0.6.2 lifecycle contract evidence

Seven installed runtime tests prove distinct EF11–EF15 invariants: empty/timed/
persistent/fractional starts and EF09 value binding; exact/delayed expiration and
lexical tie order; timeline/stale application rejections; all explicit removal
reasons/terminal uniqueness; malformed schemas/clock/overflow/getter rejection;
two independent literal replay histories with implicit providers blocked; real
Entity death and caller cleanup with sibling snapshots unchanged and optional
Entity+Effect composition. S01–S32 map to these tests; S33 uses all prior consumers.
Strict NodeNext companion proves all seven new types/four signatures, discriminated
duration/results/events, nested readonly state, null/empty rejection, no any and
closed private/deep exports. Runtime negative controls deliberately corrupt expected
expiry/order in the installed consumer; unchanged prior fixtures/oracles remain
mandatory. No simulator, gameplay-profile claim or test-count quota.

## v0.6.1 Effect application evidence

Six installed runtime tests in effect-application.mjs prove literal source/life
outcomes, overlapping rejection priority, ordered candidates/retry conflicts,
complete closed/nested validation before rejection, replay/isolation with guarded
time/RNG/timers, and actual accepted Skill execution plus equipment/environment
handoffs. Entity HP/mana/stats/life, Progression ranks, Skill and Combat snapshots
stay unchanged by Effect. Actual Entity+Effect composition excludes sibling modules.
Strict effect-application.ts verifies all six new types, both function signatures,
readonly nesting, explicit policies, result discrimination, null rejected state,
reason narrowing and closed/private exports. Existing fixtures remain unchanged.
The same installed runner requires this group and rejects missing exports and
deliberately changed installed artifact bytes. Test totals are observed in the
report; no simulator, test-count target or full gameplay-profile claim is added.

## v0.6.0 Effect contract evidence

Required installed consumers: effect-foundation.mjs (five substantive runtime
tests) and effect-foundation.ts (strict NodeNext, skipLibCheck:false). They are
registered in tests/foundation.test.mjs against the real npm tarball, never source
imports or symlinks. Literal expected snapshots are independent of implementation.
Tests cover exact identities/sourceKey, equipment/system origins, canonical target
rejection, dense ordered closed state, duplicate IDs, mismatched binding, zero
getter invocation, detached deep freeze, mutable caller inputs, two independent
replays and actual registry composition. No hidden time/random/scheduler calls;
Entity resource/life/attributes, Skill and Progression snapshots remain unchanged.
Full suite retains every previous consumer/oracle. See report for observed totals.

# Function-First Testing Policy — evidence over count

## v0.5.6 Skill integration evidence

Installed skill-integration.mjs exercises ranked Combat, rankless caller dispatch
and multi-resource rejection/recovery through public APIs. Two independent
sessions each assert the same literal clock/Combat oracle and provider calls;
immutable histories remain isolated. Its strict NodeNext companion verifies
public typing. These are function-level consumer flows, not gameplay apps.
Shared runner guards reject missing fixtures/tests, wrong versions, invalid Core
integrity, nonzero commands and failing/skipped/cancelled/todo TAP evidence.
Actual TypeScript and missing-export negative controls must fail. Existing
GF/EC/PR/CB/SK fixtures remain required; counts are observed evidence, not goals.


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


## CB11-CB15 installed target evidence (v0.4.2)

combat-target.mjs adds four cohesive groups, not one test per requirement:
T1 self/ally/enemy/neutral, role independence and explicit alive/dead allowances;
T2 missing/relation/life priority, rejected admission short-circuit, target-only
collection and structurally valid receipt limitation; T3 malformed receipt,
collection, Life, policy/lists, getters/holes/duplicates/unknowns and validation
before rejection even when target missing; T4 two independent sessions matching
literal accepted oracle, caller mutation/detachment, frozen accepted/rejected
results and unchanged domain state. HP0 is separate from supplied alive Life.
No hidden clock/RNG; source inspection proves no event/numerical execution.
combat-target.ts checks exact unions, mandatory inputs, canonical Life, readonly
arrays/result/context, no any/callback/deep import. Existing79 contracts remain
unchanged; total83 plus2 outer gates, zero skips. Actual installed0.4.2/Core tarballs
and strict NodeNext skipLibCheck:false are used. R01-R30 mapping is in the report.

## CB16–CB20 installed attack evidence (v0.4.3)

combat-attack.mjs adds seven cohesive groups: literal full oracle/public Kernel
agreement; ordered scaling/rank/flat/bonuses; lazy RNG/dodge short-circuit; stage
preconditions/identity; malformed numerical own-data contracts before RNG;
invalid RNG/nonfinite outputs; immutable independent replay and actor parity.
Actual installed gameplay/Core artifacts run in an external temporary consumer,
without mocks. Literal oracle: B0=100, B1=150, mitigation reduction0.5, final75;
critical without defense=150, never225. Scaling90, rank120 and ordered flat129
are independent expectations. HP80/Life alive remain unchanged.

combat-attack.ts proves Kernel type composition, discriminated outcomes, deeply
readonly diagnostics, mandatory stage/execution inputs, no any and closed deep
exports with strict NodeNext/skipLibCheck:false. Existing83 contracts/oracles stay
unchanged; current total90 installed contracts plus2 outer gates, zero skips.
See v0.4.3 report for A–T/R01–R33 evidence and CI delivery references.

## CB21–CB25 installed application evidence (v0.4.4)

combat-damage.mjs adds eight cohesive groups, always using actual CB03/CB09/CB15/
CB20 for positive integration. Independent literal oracles:100->70/applied30;
100->0/request150/applied100/defeated;10->0/request25/applied10; above-max140->100/
request20/applied20/delta40; vitality80->50; mana50/stamina30 unchanged. Positive
attempt at minimum can defeat alive with applied0; already dead remains unchanged.
Dodge/zero no-op has null transitions, preserves above-max140 and HP0/alive.
Malformed nested receipts, target states/identity and explicit policies fail with
getter_calls0, including before no-op. Canonical above-max reject propagates.
Deep immutability and two independent lethal replay sessions match literal
calculated75/applied60; reverse actor kinds agree. No mocks/source imports.
combat-damage.ts checks exact Entity type reuse, readonly diagnostics, null no-op
fields/discrimination, required inputs/policy, no any/deep imports with strict
NodeNext/skipLibCheck:false. Existing90 contracts/oracles unchanged; total98
installed contracts plus2 outer gates, no skips. Report maps scenarios A–R/R01–R35.

## CB26–CB30 Combat closure evidence (v0.4.5)

combat-integration.mjs adds3 cohesive installed tests: (1) two actual attacks,
independent sessions each matching literal75/75 calculated,75/25 applied and
HP100->25->0; role parity, mode-neutral labels, optional composition, no events
and unchanged domains; (2) rejection-stage trace, wrong receipts/numerical policy,
dodge with overflow poison downstream input, invalid/missing/throwing RNG;
(3) actual CB20 final20 with authoritative above-max applied20/delta40,
zero/minimum/dead edges and mutable detached handoffs. No previous oracle changes.
Dropped groups lose distinct continuation, failure boundary or accounting evidence.
combat-integration.ts checks actual cross-stage root signatures under strict
NodeNext/skipLibCheck:false, readonly Entity results and discriminated nulls.
101 installed contracts (98 retained +3) and2 outer gate tests, zero skips.
R01–R40/N01–N20 mapping and source audit are in the closure report. Text/Realtime/
TurnBased labels assert identical shared APIs, not renderer/scheduler/game execution.

## SK01–SK05 Skill Foundation evidence (v0.5.0)

skill-foundation.mjs adds three cohesive installed tests: T1 exact definition/
instance identities, two actor kinds/same actor distinct instances, mutable input
isolation, freeze/reflection, case/whitespace and deterministic duplicate creation
with implicit Date.now/Math.random forbidden; T2 closed malformed records and
canonical Entity rejection, no getter invocation or mutation; T3 actual copied
registry dependency composition, missing Entity rejection without auto-enable,
Progression/Combat independent siblings and structural creation without learning.
Literal expected records come from the approved task, not implementation output.
Dropping T1/T2/T3 loses positive ownership, negative validation or dependency evidence.

skill-foundation.ts checks root factory signatures, required string identities,
readonly fields, no any, no unauthorized state and closed deep declarations with
strict external NodeNext/skipLibCheck:false. Runner requires both fixtures, exact
three passing runtime tests/zero skips and all diagnostic markers; marker text
never replaces assertions. Every previous101 runtime contracts retained unchanged:
104 installed contracts +2 outer gates. No profile-specific matrix is needed for
scalar structural identities; concrete gameplay profiles remain NOT_EVALUATED.

## SK06–SK10 installed availability evidence (v0.5.1)

skill-admission.mjs adds four cohesive external installed-package tests: outcomes
including canonical Progression 3/0/undefined handoff and entity+skill composition;
literal overlapping rejection priorities; malformed six-input validation before
rejections without getters; detached immutable exact IDs, two independently built
sessions each checked against a literal oracle, and unchanged domain snapshots.
Expected results come from approved S01–S18, never another evaluation. The strict
NodeNext skill-admission.ts fixture checks the six-argument signature/five new
types, required closed readonly policy/result shapes, rank union and no any/deep
imports. All104 previous runtime contracts remain unchanged; actual current108
installed contracts +2 outer gates, zero skips. No game/simulator/profile matrix.
See the v0.5.1 report for requirement mapping and limitations.

## v0.5.2 installed resource-cost evidence

Five coherent skill-resource-costs.mjs tests cover numerical literal oracles and
actual Core diagnostics; all-or-nothing/order/missing/stale state; zero/free no-op;
full malformed matrix before rejection without getters; immutable replay and
caller ownership. S01–S20 are mapped in the checkpoint report, including health
minimum without Life mutation and all old regressions. Expectations are literal
contract values, never regenerated using the implementation under test.
skill-resource-costs.ts checks seven types, signatures/readonly/canonical diagnostic
integration, discriminated outcomes and invalid/missing/deep imports. Runner packs
actual0.5.2, installs independently with real pinned Core, requires5 pass/0 skips,
and compiles strict NodeNext/skipLibCheck:false. No simulator or count KPI.

## v0.5.3 installed cooldown evidence

Five skill-cooldown.mjs groups cover approved S01–S24: state/literal real-Kernel
duration oracles; boundary/reuse/exactly-one-read; full closed malformed records
before providers, invalid/error/rewound/unrepresentable time; immutable instance/
actor isolation and selected entity+skill composition; two independent literal
replay sessions with Date.now/Math.random disabled. Expected constants come from
the approved contract, not the implementation or session A. No Core mocks.
skill-cooldown.ts proves all6 types/3 signatures, readonly snapshots, discriminated
result narrowing, opaque Foundation context, required configuration and root-only
exports without any. Runner packs actual0.5.3 and independently installs with
real pinned Core, checks5 pass/0 fail/0 skips and all5 markers; strict NodeNext
uses skipLibCheck:false. S25 retains all113 prior runtime tests:118 installed
runtime contracts +2 outer tests. Count is observed evidence, not a test KPI.

## v0.5.4 installed activation evidence

skill-activation.mjs has5 contract groups: literal candidates/multi-cost/free
caller-only composition; ordered rejection/no partial exposure/no downstream
clock reads; complete malformed contracts/identity binding/getter avoidance;
immutable completed/failed assertions without refund; two independent literal
replay sessions with hidden time/RNG disabled, duplicate IDs and snapshot isolation.
skill-combat-handoff.mjs adds2 groups using actual installed Combat context,
admission, target validation, attack and damage APIs. Enemy preflight passes,
ally fails relation_not_allowed; dodge is completed, landed damage75 leaves HP25.
Both retain paid mana75/cooldown1750. No mock numerical owners or simulator.

skill-activation.ts checks all9 types,2 signatures, result narrowing, readonly
nested data, invalid/missing/extra contracts and blocked deep imports. Installed
strict NodeNext uses skipLibCheck:false with no any. Runner requires exact5+2
passes, zero fail/cancel/skip/todo and all7 markers. All118 prior runtime tests
remain: observed125 installed runtime tests +2 outer tests. Tests prove framework
contracts; game profile behavior remains NOT_EVALUATED.

## v0.5.5 installed Loadout evidence

skill-loadout.mjs has five distinct contract groups: ordered assign/replace/remove
with two independently created literal replay histories; deterministic rejection
priority and explicit duplicate policies; complete malformed state/Entity/Instance/
layout/policy/array contracts before ordinary rejection with getters0; stale and
duplicate structural references, independent loadouts, empty layout, admission
independence and no cascade; opaque special IDs and detached frozen snapshots
without freezing caller inputs. These cover S01–S27; S28 retains earlier consumers.
No numerical work, simulator, external catalog mock or count KPI.

skill-loadout.ts checks all8 types/5 function signatures, readonly nested slots/
policies/layout/results, union narrowing, missing/extra/invalid contracts and
blocked deep imports. Actual0.5.5 tarball installs independently with pinned Core;
runner requires5 passes/5 markers, fail/cancel/skip/todo0 and strict external
NodeNext/skipLibCheck:false. Counts are observed evidence, not acceptance quotas.
Game profiles remain NOT_EVALUATED.

Observed v0.5.5 total:130 installed runtime tests (125 retained +5 Loadout),
2 outer tests; zero failures/skips.
