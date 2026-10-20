## v0.6.4 checkpoint gates

Fresh core:prepare and npm ci --ignore-scripts; harness:check, harness:selftest,
build, typecheck, test:functional and full verify must pass. Installed EF01–EF25
and all prior GF/EC/PG/CB/SK, strict NodeNext, byte provenance, required exports and
negative controls run with zero skips. Audit exact three-function/six-type delta,
unchanged EF01–EF20 declarations/helpers and protected owners/Core/graph/dependency
pins, version-only package metadata and git diff --check. Both exact-head events
require Windows/Ubuntu Node22/24 (eight jobs). Final SHA/CI supplements the committed
pre-push report in existing Draft PR #11. Pending CI is not CHECKPOINT_COMPLETE.
Stop at0.6.4; no Ready/merge/tag/publish/0.6.5. Earlier gates are historical.

## v0.6.3 checkpoint gates

Fresh core:prepare and npm ci --ignore-scripts; harness:check, harness:selftest,
build, typecheck, test:functional and full verify are required. Actual installed
EF01–EF20/GF/EC/PG/CB/SK, strict NodeNext, byte provenance and runner fault controls
must pass with zero skips. Audit six-function/nine-type delta, protected paths,
unchanged Core/graph/dependency pins, version-only metadata and git diff --check.
Both exact-head events require Windows/Ubuntu Node22/24 (eight jobs). Record final
SHA/CI in Draft PR #11 as the supplement to the committed pre-push report.
Pending CI is not completion. Stop at0.6.3; no Ready/merge/tag/publish/0.6.4.
Earlier checkpoint gates are historical.

## v0.6.2 checkpoint gates

Run fresh core:prepare/install, harness:check, harness:selftest, build, typecheck,
test:functional and full npm run verify with installed EF01–EF15 and every prior
GF/EC/PG/CB/SK consumer. Require strict NodeNext, byte provenance, all four new
root exports, actual wrong-expiry/order negative controls and zero skipped tests.
Audit exact four-function/seven-type API delta, unchanged EF01–EF10/protected
owners/Core/registry/dependency versions, version-only metadata, git diff --check.
Same Draft PR #11 must pass Windows/Ubuntu Node22/24 for push and pull_request at
the exact delivered SHA (8 jobs). Final CI/SHA supplements the tracked pre-push
[report](reports/v0.6.2-effect-duration-lifecycle.md) in that PR's body. Pending CI
is not completion. Stop at 0.6.2; no Ready/merge/tag/publish/automatic 0.6.3.
Earlier checkpoint gates below describe historical requirements.

## v0.6.1 checkpoint gates

Fresh core:prepare and npm ci --ignore-scripts precede harness:check,
harness:selftest, build, typecheck, test:functional and full verify. Required
consumers now include EF01–EF10 alongside unchanged GF01–GF16/EC01–EC18/PG01–PG19/
CB01–CB30/SK01–SK35. Installed source/declaration byte provenance, required exports,
strict NodeNext and runner rejection controls must pass with zero skipped tests.
Audit EF01–EF05 preservation, two-function/six-type delta, version-only metadata,
unchanged graph/Core/protected owners, and git diff --check before commit/push.
Existing Draft PR #11 requires exact-head Windows/Linux × Node22/24 for both push
and pull_request (eight jobs). Final SHA/CI evidence supplements the pre-push
[report](reports/v0.6.1-effect-application-admission.md) in that same PR body.
Do not declare completion while CI is pending; no Ready/merge/tag/publish/0.6.2.

## v0.6.0 checkpoint gates

Run core:prepare, npm ci --ignore-scripts, harness:check, harness:selftest, build,
typecheck, test:functional, full verify and git diff --check. verify includes the
required EF01–EF05 installed group plus all previous GF01–GF16, EC01–EC18,
PG01–PG19, CB01–CB30 and SK01–SK35 consumers. Required TAP counts, markers,
strict installed TypeScript and runner negative controls must pass without skips.
The unchanged CI matrix must pass at the delivered SHA for both push and
pull_request: Windows/Linux × Node22/24 (eight jobs). Pending CI is not completion.
Draft PR only; no Ready/merge/tag/publish or next milestone. Delivery SHA and final
CI links are recorded in the same PR after the report's pre-push snapshot.

# Verification gates — v0.5.6

## Current release candidate — v0.5.6

npm run verify requires production source and every gate: boundaries, harness
self-tests, build, strict typecheck and installed functional consumers. It now
includes SK31–SK35 integration and runner negative controls. The runner checks
actual package/Core versions, tarball integrity, required TAP execution and zero
failed/cancelled/skipped/todo results. Required consumers cannot silently vanish.
See [final review](reports/v0.5.6-skill-final-review.md) for actual local counts and
artifact provenance; PR #10 carries final exact-head Windows/Ubuntu Node22/24
push+PR evidence. Developer acceptance is PENDING. Historical checkpoint sections
below retain their original scope and do not establish current acceptance.


Prepare the pinned Core artifact with `npm run core:prepare`, then install using
`npm ci --ignore-scripts`. See CORE_INTEGRATION.md for tool versions and pin.

| Command | Evidence | Limits |
| --- | --- | --- |
| `npm run build` | Clean JS/declaration emit from strict native ESM/NodeNext source | GF01–GF16, EC01–EC18, PG01–PG18; no game loop |
| `npm run typecheck` | Strict source typecheck, no emit | No gameplay semantics |
| `npm run harness:check` | Registry, literal import/dependency direction, runtime package policy, obvious hidden RNG/time | Lexical, not full TS AST/semantic analysis |
| `npm run harness:selftest` | Positive/negative boundary controls | No runtime module enable/disable |
| `npm run test:functional` | External installed GF01–GF16/EC01–EC18/PG01–PG19, full Foundation flow and payloads, ESM/declarations/closed exports/real Kernel; gate failures | Build first; no gameplay profile behavior evidence |
| `npm run verify` | Boundaries, self-tests, required build, typecheck and functional contracts, in that order | Automated evidence is not Developer acceptance |

`verify` checks that all three production scripts exist before running any of
them, and fails on a nonzero result, spawn error or termination signal. Node and
npm CLI subprocesses use argument arrays with `shell:false`. The regression test
records gate execution order, fails each gate individually, rejects missing
scripts and uses a Node executable path containing spaces. It also rejects a
missing `src/index.ts`, an empty `src/`, and an absent `src/`, even with stale
build output present.

CI reconstructs Core from the pinned SHA, verifies artifact integrity, installs
locked packages and runs full verification on Windows/Linux with Node 22/24 and
npm 12.2.0. Results apply only to the exact tested commit. macOS is not in this
matrix. The implementation report records actual commands/results.

## Honest scope

GF01–GF16 tests execute from an external installed tarball, with independent
expected values for registration, validation, selection, dependency order/errors, composition and
state isolation, synchronous lifecycle order/transitions, partial failure and
cleanup progress, runtime replay protection and read-only inspection.
Messaging adds command routing/outcomes, subscription-order snapshot fan-out,
fail-fast delivery progress, unsubscribe/owner cleanup and explicit lifecycle
integration, plus context isolation, hidden internals and nested execution guards.
Strict NodeNext consumer checks public types/readonly contracts. Missing consumer
fixtures fail on file copy; missing required test files fail the explicit Node
test command. Existing packaging, Kernel and fail-closed gate controls remain.
Execution adds injected clock/RNG/IDs, boundary validation, ownership/identity,
and two independently created full-flow sessions with literal expected semantic
traces. Changed-provider and failure traces prove dependency sensitivity and
partial cleanup. Text/2D/2.5D probes prove Foundation data-shape compatibility
only. EC01–EC03 additionally proves Entity creation/validation/immutability and
explicit optional module composition. Gameplay profile behavior remains
**NOT_EVALUATED**. Foundation is the accepted baseline; Entity phase acceptance
is PENDING final v0.2.5 review. No fake passing scripts or placeholder APIs.

EC04–EC06 adds installed immutable ordered collections, exact collection-local
identity, lookup and full replacement/removal, isolated old versions/branches and
malformed/duplicate/unknown rejection. EC03 validation remains canonical. Root
inventory/declarations include seven new functions and EntityCollection, with
deep exports closed and private helpers absent from public declarations.

EC07–EC09 adds installed typed immutable attributes, explicit Kernel stats and
recalculation, malformed input rejection, independent 25/29/32 oracle, canonical
modifier/precision/order edge cases and input/snapshot isolation. Root inventory
is now 46 functions/49 types after EC14–EC17. The four EC07–EC09 functions
and three types remain root-only;
no new registry module, Core pin change or numerical duplicate implementation.
Source audit and old unchanged GF/EC fixtures supplement these contract tests.

`src/index.ts` remains mandatory. If it is absent, verification fails with
`VERIFY_FAIL` and exit code 1; there is no scaffold-success fallback. Build,
typecheck and functional gates are mandatory for successful verification.
Later approved gameplay tasks must
add real function/profile evidence and update this scope statement.

Report `PASS`, `FAIL`, `NOT_RUN`, `NOT_EVALUATED` or `BLOCKED_WITH_EVIDENCE` truthfully.
Semantic duplication, game policy and global gameplay state need source review;
static import checks alone cannot prove their absence.

EC10–EC13 adds five installed resource scenarios and strict public types. Fifty
installed contracts now cover Foundation29, identity3, collection3, stats5,
resources5 and life5; both outer test gates still run with zero skips. Resource diagnostics
include negative applied and above-max decrease magnitude, ineligible no-op getter
non-evaluation, detached snapshots and explicit EC08 maximum handoff. All three
public Kernel calls run against the pinned real package; source review confirms
that L2 performs no arithmetic. Current root inventory is 46 functions/49 types,
without adding a registry module, Core dependency or gameplay engine.

EC14–EC17 adds installed life5 contracts, strict readonly declarations and
LIFE_TRACE_PASS/LIFE_EVENTS_PASS markers. Full verification requires all existing
gates and all 50 installed contracts, zero skips. Source review verifies reuse of
EC10 validation, no new numerical Kernel call, automatic event, time/RNG/global
store, Core/registry/dependency or old body change. CI verifies this same package
on Windows/Linux Node22/24 for push and PR events at the exact delivered head.
See reports/v0.2.4-life-state-death.md for checkpoint evidence and limitations.

## EC18 final phase gate

The installed runner additionally requires entity-integration.mjs/.ts, one
successful integration contract, zero skips, ENTITY_INTEGRATION_TRACE_PASS and
ENTITY_PROFILE_DATA_PASS. Missing files, test failure or type errors fail the
gate. Total installed contracts: 51, with 2 outer tests; prior 50 retained.
Two sessions independently match a literal trace with real Kernel diagnostics,
explicit dependencies/lifecycle/commands/events, negative paths and cleanup.
Foundation/Entity profile compatibility is EVALUATED; concrete gameplay profile
behavior is NOT_EVALUATED. See reports/v0.2.5-entity-integration-closure.md.
Phase is REVIEW_PENDING; only Developer can accept/close it.

## PG01–PG03 current milestone gate

`npm run test:functional` executes the targeted installed progression consumer
(three contracts, zero skips), strict progression.ts and every existing GF/EC
consumer. `npm run verify` requires boundary/self-tests/build/typecheck/functional
gates; no skip path added. The runner requires the packaged Progression JS and
declaration, exact additive root surface, closed deep exports and marker
`INSTALLED_PROGRESSION_CONTRACTS_PASS PG01–PG03; consumer_tests=3 skipped=0`.
Current total: 54 installed contracts (29 GF + 22 EC + 3 PG), 2 outer tests,
zero skips. Historical milestone totals above describe their original checkpoints.
Gameplay profile behavior stays NOT_EVALUATED; Progression IN_PROGRESS, acceptance
PENDING final v0.3.5. Exact-head push and PR CI must pass Windows/Linux Node22/24.

## PG04–PG06 current milestone gate

npm run test:functional executes targeted experience.mjs from a fresh packed,
installed @rpg/gameplay@0.3.1 consumer (three contracts, zero skips), then strict
external NodeNext including experience.ts. The runner requires the marker
INSTALLED_EXPERIENCE_CONTRACTS_PASS and literal EXPERIENCE_TRACE_PASS; test/type/
missing-fixture failure propagates. All prior 54 installed contracts retained:
57 total, 2 outer tests, zero skips. Current full npm run verify still requires
boundaries,self-tests,build,typecheck,functional and fail-closed gate regression.
Earlier counts describe historical milestones. Exact-head push and PR CI must
both pass Windows/Linux Node22/24. Gameplay profiles remain NOT_EVALUATED;
Progression IN_PROGRESS, Developer acceptance PENDING final v0.3.5 review.

## PG07–PG10 current milestone gate

The installed runner requires advancement.mjs/.ts, three successful contracts,
zero skips and ADVANCEMENT_TRACE_PASS. Its package identity is @rpg/gameplay0.3.2;
strict external NodeNext, exact public root surface and closed deep exports remain
mandatory. All 57 prior installed contracts are retained unchanged: 60 total,
2 outer tests, zero skips. Full verify requires every existing gate and failure
controls; no skip path was added. Both push and PR exact-head Windows/Linux Node22/24
matrices must pass before CHECKPOINT_COMPLETE. Phase IN_PROGRESS, acceptance PENDING.

## PG11–PG13 current milestone gate

Runner requires installed @rpg/gameplay0.3.3 attribute-points.mjs4 PASS,zero skips,
ATTRIBUTE_POINTS_TRACE_PASS and INSTALLED_ATTRIBUTE_POINTS_CONTRACTS_PASS markers.
Strict external NodeNext attribute-points.ts plus closed root exports/declarations
remain mandatory. All60 old contracts retained:64 installed,2 outer,zero skips.
Full verify runs harness checks/self-tests, clean build,typecheck and installed
functional tests; missing source or selected failures fail closed. Exact-head
push and PR Ubuntu/Windows Node22/24 evidence belongs in the checkpoint report.

## PG14–PG18 current milestone gate

Actual packed/installed @rpg/gameplay0.3.4 must execute skill-progression.mjs:5 PASS,
zero skips, INSTALLED_SKILL_PROGRESSION_CONTRACTS_PASS and SKILL_PROGRESSION_TRACE_PASS.
External strict NodeNext skill-progression.ts, exact root surface and private
helper/deep-export closure stay mandatory. All64 old contracts unchanged:69 total,
2 outer tests,zero skips. Full verify still runs every harness/build/typecheck/
functional gate, including fail-closed missing source/spaced Node path controls.
Exact-head push+PR Ubuntu/Windows Node22/24 must pass; macOS NOT_RUN.


## PG19 final Progression gate

Runner requires actual packed/installed @rpg/gameplay0.3.5 and the mandatory
progression-integration.mjs/.ts fixtures. One successful integration contract,
zero skips, PROGRESSION_INTEGRATION_TRACE_PASS and
PROGRESSION_INTEGRATION_SESSIONS_PASS are required. Missing fixtures/markers,
failed contracts or strict external NodeNext errors fail verification. The runner
prints INSTALLED_PROGRESSION_INTEGRATION_PASS only after all assertions succeed.
All69 prior contracts retained:70 installed,2 outer,zero skips. No gate removed
or bypassed. Exact final-head push AND PR matrices must pass Ubuntu/Windows
Node22/24. Tracked closure report records pre-commit results with CI pending;
ignored final review handoff records actual head/CI, without a follow-up commit.
Phase REVIEW_PENDING; Developer acceptance PENDING. macOS NOT_RUN; concrete
Text/2D/2.5D gameplay profiles NOT_EVALUATED.

## F-001 remediation gate

The installed integration fixture now requires two passing contracts (PG19 plus
F-001), zero skips, and POINT_POOL_ISOLATION_PASS in addition to both prior PG19
markers. Strict NodeNext verifies pointKind literals and negative pool boundaries.
Full verify retains every existing gate:71 installed contracts +2 outer, zero
skips. Both final-head CI matrices must be observed again after the fix; old
41c3d3d results do not certify remediation. Package remains0.3.5; Core unchanged.
Final fix SHA/CI are recorded in PR #8 and the same ignored single-file handoff.
macOS NOT_RUN; gameplay profile behavior NOT_EVALUATED.

## v0.4.0 checkpoint verification scope

Current artifact @rpg/gameplay0.4.0 adds CB01–CB05 to the merged Group A baseline.
Run harness:check, harness:selftest, build, typecheck, test:functional and verify;
verify requires all steps and propagates failures. Current inventory is 3 static
modules / 8 source files, 61 root runtime functions / 80 types, 75 installed
contracts and 2 outer gate tests, zero skips. Strict external NodeNext includes
combat.ts with skipLibCheck:false; deep imports fail at runtime and type boundaries.
Actual installed gameplay/Core tarballs, Core SHA-512 and GF/EC/PG regression
oracles remain mandatory. CB evidence covers closed exact intent/freeze/getter
safety/self-target/unknown refs/duplicate IDs/composition and deterministic
independent sessions. No admission or execution evidence is claimed.

Use checkpoint report and PR for current results/exact-head push + PR CI on
Ubuntu/Windows Node22/24. Earlier counts/statuses are historical milestone records.
Combat phase IN_PROGRESS, Developer acceptance PENDING; gameplay profile behavior
NOT_EVALUATED and v0.4.1+ NOT_STARTED. No gate is silently skipped.

## v0.4.1 checkpoint verification scope

Current artifact0.4.1: GF01–GF16, EC01–EC18, PG01–PG19 and CB01–CB10.
Unchanged3 modules/8 source files; root62 functions/84 types; installed79 contracts
(75 prior +4 admission), 2 outer tests, zero skips. Full verify runs all gates;
strict external NodeNext/deep exports and real pinned Core integrity remain required.
Admission proves source-only evaluation, deterministic priority, malformed policy
before rejection, Life ID consistency/getter safety and detached frozen result.
No target validation/execution proof is claimed; gameplay profiles NOT_EVALUATED.
Exact-head push/PR Ubuntu/Windows Node22/24 CI is required for checkpoint completion.
See v0.4.1 report and PR #9 final delivery evidence; prior counts are historical.
Phase IN_PROGRESS, PR DRAFT, Developer acceptance PENDING; v0.4.2+ NOT_STARTED.


## v0.4.2 current verification scope

Artifact0.4.2: GF01-GF16, EC01-EC18, PG01-PG19 and CB01-CB15. Registry3 modules,
8 source files unchanged; root63 functions/89 types. Installed83 contracts
(79 retained +4 target) and2 outer gate tests, no skips. Targeted harness:check,
harness:selftest, build, typecheck, test:functional and full verify must pass.
Package tarball external install, pinned Core integrity, closed exports and strict
NodeNext remain mandatory. Target evaluation only; no gameplay execution/profile
PASS claim. Exact-head push and PR jobs must each pass Windows/Ubuntu Node22/24;
prior CI is not current evidence. See v0.4.2 report and PR #9 delivery evidence.
macOS NOT_RUN; gameplay profiles NOT_EVALUATED; Developer acceptance PENDING.

## v0.4.3 current verification scope

Artifact0.4.3: GF01–GF16, EC01–EC18, PG01–PG19 and CB01–CB20. Registry3 modules,
8 source files unchanged; root64 functions/92 types. Installed90 contracts
(83 retained +7 attack) and2 outer gates, zero skips. Required commands remain
harness:check, harness:selftest, build, typecheck, test:functional and full verify.
Real tarball installation, pinned Core SHA-512 and strict external NodeNext remain
mandatory. CB16–CB20 proves numerical resolution, not damage application or death.
Exact-head push and PR CI each require Windows/Ubuntu Node22/24. Final evidence
is attached to PR #9; the tracked report records its pre-push snapshot.
macOS NOT_RUN; gameplay profiles NOT_EVALUATED. Phase IN_PROGRESS, PR DRAFT,
Developer acceptance PENDING. v0.4.4/v0.4.5 NOT_STARTED. Historical scopes above
remain records of their own checkpoints, not current feature limitations.

## v0.4.4 current verification scope

Artifact0.4.4: GF01–GF16, EC01–EC18, PG01–PG19 and CB01–CB25. Registry3 modules/
8 sources unchanged; root65 functions/95 types. Total98 installed contracts
(90 retained +8) plus2 outer gates; zero skips. All targeted gates and full verify
must run, with real tarball installation, strict external NodeNext and pinned
Core integrity. CB21–CB25 proves explicit damage application/canonical defeat,
not a completed game/Combat phase. Exact-head push and PR Windows/Ubuntu Node22/24
CI evidence is attached to PR #9; tracked report records the pre-push snapshot.
macOS NOT_RUN; profiles NOT_EVALUATED. Phase IN_PROGRESS, PR DRAFT, Developer
acceptance PENDING; v0.4.5 NOT_STARTED. Earlier scopes are historical records.

## v0.4.5 current verification scope

Actual installed0.4.5: GF01–GF16, EC01–EC18, PG01–PG19 and CB01–CB30.
101 installed runtime contracts +2 outer gates, zero failures/skips. Run
harness:check, harness:selftest, build, typecheck, test:functional, full verify and
git diff --check. Root65 functions/95 types,3 registered modules/8 sources.
Strict external NodeNext/closed exports, tarball install and pinned Core integrity
remain mandatory. No production delta in0.4.5; full phase diff audit required.
Exact-head push+PR Windows/Ubuntu Node22/24 must PASS before PR readiness. Final
results go into ignored .artifacts/combat-v0.4-final-review.md and PR #9, avoiding
a post-CI tracked commit. Phase REVIEW_PENDING/acceptance PENDING after gates;
macOS NOT_RUN, concrete game-mode integrations/gameplay profiles NOT_EVALUATED.

## v0.5.0 current Skill checkpoint verification

Actual packed/installed @rpg/gameplay@0.5.0 must include the Skill JS/declaration,
execute skill-foundation.mjs (3 PASS, zero skips) and compile skill-foundation.ts
under strict NodeNext/skipLibCheck:false. Exact root67 runtime functions, root-only
exports, canonical Core tarball SHA-512 and all prior101 contracts remain gates.
Current104 installed runtime contracts +2 outer gate tests; registry4 modules/
9 sources. Required commands: harness:check, harness:selftest, build, typecheck,
test:functional, full verify and git diff --check. Missing fixture/tests, failed
assertion/typecheck or required source/gate failure propagates; no skip path added.

Exact-head push AND PR Windows/Ubuntu Node22/24 must PASS for CHECKPOINT_COMPLETE.
Tracked report records local results and pre-push CI pending; final exact SHA,
workflow/job results and links are attached to the same Draft phase PR and ignored
local evidence without an extra commit invalidating CI. Skill IN_PROGRESS, PR
DRAFT, Developer phase acceptance PENDING. No merge/tag/publish, Ready transition
or v0.5.1 work. macOS NOT_RUN; gameplay profiles NOT_EVALUATED. Earlier sections
retain their own checkpoint inventories and limitations.

## v0.5.1 current Skill admission gates

SK01–SK10 joins unchanged GF01–GF16/EC01–EC18/PG01–PG19/CB01–CB30. Actual0.5.1
packed tarball installs with the real pinned Core in an independent directory,
no source/symlink imports. Required skill-admission.mjs/.ts add4 runtime contracts
and strict NodeNext/skipLibCheck:false checks; runner requires tests4/pass4/skips0
and all four evidence markers. Current108 runtime contracts +2 outer gates,
root68 functions/103 types. Existing missing-source/spaced-Node/failure-propagation
regressions remain active. Registry4 modules/9 source files, Core pin unchanged.

Required local harness:check/selftest/build/typecheck/test:functional/full verify
and diff audit precede delivery. Exact delivered HEAD requires both push and PR
Windows/Ubuntu Node22/24 jobs PASS before CHECKPOINT_COMPLETE. Final SHA/CI links
are attached to existing Draft PR #10 and ignored local evidence, preserving the
tested SHA. Phase IN_PROGRESS; Developer acceptance PENDING. No merge/tag/publish
or v0.5.2 implementation; macOS NOT_RUN, gameplay profiles NOT_EVALUATED.

## v0.5.2 current Skill resource-cost gates

SK11–SK15 joins unchanged GF01–GF16/EC01–EC18/PG01–PG19/CB01–CB30/SK01–SK10.
Actual0.5.2 installed ESM/root-only consumer adds5 runtime tests and strict
NodeNext contracts; all108 prior runtime tests remain. Required state/source/gate
checks still fail closed, no silent skips. Fresh core:prepare and npm ci precede
verification. Exact delivered SHA must pass both push/PR Windows+Ubuntu Node22/24
matrix (8 jobs). Local PASS does not imply remote PASS. Final SHA/CI evidence is
recorded on Draft PR #10 without changing tested commit. macOS NOT_RUN; gameplay
profiles NOT_EVALUATED; phase IN_PROGRESS and Developer acceptance PENDING.

## v0.5.3 current Skill cooldown gates

Unchanged GF01–GF16/EC01–EC18/PG01–PG19/CB01–CB30/SK01–SK15 plus SK16–SK20
run via actual installed0.5.3 root-only package and strict external NodeNext.
Runner requires5 cooldown tests/5 markers with zero skips, retains all113 old
runtime tests and fail-closed source/spaced-Node/failure-propagation regressions.
Observed total118 installed runtime contracts +2 outer gates. Core artifact
integrity/root export closure and protected-owner audits remain mandatory.
Harness, selftests, build, typecheck, functional and full verify must PASS locally;
delivered SHA must also pass push and PR Windows/Ubuntu Node22/24 matrices (8 jobs).
Final SHA/CI evidence is attached to Draft PR #10 without changing the tested SHA.
Phase IN_PROGRESS; Developer acceptance PENDING. macOS NOT_RUN; game profiles
NOT_EVALUATED. No activation/timer runtime/merge/tag/publish or v0.5.4 implied.

## v0.5.4 current Skill activation gates

Actual installed0.5.4 root-only tarball/real pinned Core exercises SK01–SK25 plus
unchanged GF01–GF16/EC01–EC18/PG01–PG19/CB01–CB30. Observed125 runtime contracts
(118 unchanged +7 activation/handoff) and2 outer gates pass without skips.
Strict external NodeNext, closed75 runtime exports/125 types, Core SHA-512 and
private declaration checks remain. Existing missing-source, spaced-Node and
failure-propagation controls remain active. Four registry modules/nine production
source files unchanged. Local harness check/selftest/build/typecheck/functional/
full verify and diff audit must pass; push+PR exact delivered SHA requires8/8
Windows/Ubuntu Node22/24 jobs. Final links attach to existing Draft PR #10 without
changing tested SHA. Phase IN_PROGRESS, acceptance PENDING; v0.5.5 NOT_STARTED.
macOS NOT_RUN; concrete game profiles NOT_EVALUATED.

## v0.5.5 current Skill Slots & Loadout gates

Actual installed0.5.5 root-only package exercises SK01–SK30 and unchanged
GF01–GF16/EC01–EC18/PG01–PG19/CB01–CB30. Loadout fixture requires5 runtime tests,
all5 markers and fail/cancel/skip/todo0; strict external NodeNext also compiles.
Root80 functions/133 types, closed/private-free declarations, unchanged Core
artifact integrity and version-only lock audit remain required. Existing source-
required, spaced-Node and failure propagation controls stay active. All prior125
runtime tests/oracles retained. Local required commands and full verify must PASS;
exact delivered head requires push+PR Windows/Ubuntu Node22/24 matrix8/8 PASS.
Final remote evidence attaches to Draft PR #10 without changing tested SHA.
Phase IN_PROGRESS; acceptance PENDING; v0.5.6 NOT_STARTED. macOS NOT_RUN;
concrete game profiles NOT_EVALUATED.

Observed v0.5.5 total:130 installed runtime tests (125 retained +5 Loadout),
2 outer tests; zero failures/skips.
