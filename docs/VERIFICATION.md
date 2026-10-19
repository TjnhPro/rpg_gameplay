# Verification gates — v0.3.5

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
