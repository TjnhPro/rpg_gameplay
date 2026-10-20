# Harness Features H01–H16 — scope vs. implementation

**Important:** A feature listed here is NOT proof of gameplay implementation.
v0.1.0 adds real package/Kernel integration contracts and strict build tooling;
v0.1.5 adds installed-package GF01–GF16 module/lifecycle/messaging/execution
evidence, shared full-flow reproducibility and Foundation profile compatibility.
v0.2.0 adds installed EC01–EC03 identity/creation/immutability and module evidence.
v0.2.1 adds installed EC04–EC06 ordered immutable collection/update evidence.
v0.2.2 adds installed EC07–EC09 immutable attributes/Kernel stats/recalculation evidence.
v0.3.0 adds installed PG01–PG03 creation/validation/isolation evidence.
v0.3.1 adds installed PG04–PG06 scalar transition/numeric-boundary evidence.
Gameplay profile behavior remains NOT_EVALUATED; Progression phase is REVIEW_PENDING.

| ID | Harness capability | Foundation status |
| --- | --- | --- |
| H01 | Agent Onboarding & Routing | Implemented: concise `AGENTS.md` map |
| H02 | Repository Knowledge Base | Implemented: scoped docs, accepted decisions |
| H03 | Architecture Boundary Guard | Partial automation: check static imports and paths |
| H04 | Module Ownership & Dependency Registry | Implemented: optional Entity and dependent optional Progression |
| H05 | RPG Core Integration Guard | Partial automation: forbid Core root/Legacy/internal imports |
| H06 | Canonical Implementation Guard | Governance/manual review; no fake algorithmic duplicate detector |
| H07 | Module Isolation & Optionality Guard | Partial automation: imports, explicit deps; selected-module lifecycle/isolation contracts tested; dynamic enable/disable excluded |
| H08 | Capability Gap & Change Control | Policy + escalation/STOP workflow |
| H09 | Three-Profile Functional Verification | Foundation action/opaque position/direction compatibility probes; no gameplay scenarios/apps |
| H10 | Deterministic Functional Test Harness | Injected clock/RNG/IDs, independent scripted semantic/failure traces; lexical global-source checks + audit; no simulator/app |
| H11 | Contract & Integration Test Harness | Installed package/Kernel/GF01–GF16/EC01–EC18/PG01–PG19, full Foundation flow, payload profiles and gate controls |
| H12 | Verification Gates & CI | Boundaries + build + typecheck + functional contracts; Windows/Linux, Node 22/24 |
| H13 | Agent Task Execution Protocol | Implemented: approved-plan-first docs and task template |
| H14 | Approval & Evidence Gates | Policy/report templates; Developer acceptance manual |
| H15 | Architecture Drift & Quality Audit | P1 after real module experience |
| H16 | Feature Promotion & Reuse Evaluation | P1 formal automation; policy already documented |

## Honest coverage

Static regex import guard catches conventional literal import/export and some obvious dynamic imports; it is **not** a full TypeScript AST security analyzer. Refine via compiler API once TypeScript is installed in an approved module task. Some invariants are semantic/manual, particularly no duplicate implementation and meaningfully proven reuse.

`npm run verify` proves package infrastructure, GF01–GF16, EC01–EC18 and Foundation profile
data compatibility. Gameplay behavior remains NOT_EVALUATED. It does not prove
the framework's future gameplay capabilities.

v0.2.3 adds installed EC10–EC13 current Resource State, Kernel normalization,
increase/decrease diagnostics, explicit regeneration and Stats maximum handoff.
The shared function evidence includes boundary policies, no hidden reads on
ineligible regeneration, immutability and multi-entity isolation. H06 ownership
still requires source review; no scheduler/life state/gameplay profile claim.

v0.2.4 adds installed EC14–EC17 immutable life state, explicit defeat/revival,
association/validation/repeat/isolation and caller GF12/GF13 event evidence.
At the v0.2.4 checkpoint, all 50 installed contracts retained old evidence, strict root-only types and actual
Kernel integration. Life operations perform no resource arithmetic or implicit
event publication; H06 still requires source review. The checkpoint kept phase IN_PROGRESS and PR DRAFT; v0.2.5 review readiness is
recorded below. Concrete gameplay profiles remain NOT_EVALUATED.

## v0.2.5 Entity integration

EC18 adds installed public-API integration with literal expected numerical and
semantic trace, independent sessions, invalid ID/revival/command input and
fail-fast listener evidence. All 51 installed contracts plus 2 outer tests run,
with zero skips. No production API or second engine is added.
Text/2D/2.5D Foundation/Entity compatibility: EVALUATED through shared entity
lookup and opaque profile event data, alongside prior Foundation probes.
Concrete gameplay/profile behavior: NOT_EVALUATED (combat, movement, animation).
H06 canonical numerical ownership is source-reviewed, not algorithmically proven
by a regex checker. Final Developer acceptance remains PENDING.

## v0.3.2 evidence extension

Installed PG07–PG10 now covers explicit cumulative/local advancement, complete
policy validation, frozen diagnostics, blockers/prefixes, dry-run and replay.
60 installed contracts plus 2 outer tests; no gate bypass. Previous fixtures and
Core pin unchanged. This is Progression evidence, not game-profile acceptance.

## v0.3.3 evidence extension

Installed PG11–PG13 covers separate point pools, validated actual advancement
receipts, exact per-level rewards, updated-cursor replay protection and canonical
Entity allocation.64 installed contracts plus2 outer tests,zero skips; prior
fixtures and gates retained. No game profile or global authority claim.

## v0.3.4 evidence extension

Installed PG14–PG18 covers fixed exact-key Skill Ranks, independent Skill Point
pools/cursors and actual advancement rewards, explicit requirements, one-rank
upgrade, deterministic blockers, expectedRank guard and combined immutable result.
69 installed contracts plus2 outer tests,zero skips. All prior consumers retained,
real Core pin/integrity and verification failure controls unchanged. Gameplay
profiles remain NOT_EVALUATED; Progression IN_PROGRESS until v0.3.5 review.


## v0.3.5 closure evidence

PG19 supplies installed cross-domain literal traces in two independent sessions,
real Kernel stat handoff, explicit GF command/event integration and failure/cleanup
boundaries.70 installed contracts +2 outer tests,zero skips; all69 old fixtures
retained. Root60 functions/77 types unchanged. Harness checks remain lexical and
semantic ownership still requires full phase source/diff review. No concrete
gameplay profile claim; Developer acceptance PENDING, Progression REVIEW_PENDING.

## v0.4.0 checkpoint harness evidence

The Group A baseline is merged through PR #8. H04 now registers optional entity,
progression -> entity and combat -> entity (no placeholders). H11/H12 include
CB01–CB05 installed exact intent, closed own-data validation, immutable snapshots,
composition and strict NodeNext root-only declarations. 75 installed contracts
retain all71 baseline contracts; 2 outer gate tests, zero skips. H06 source review
confirms one Combat owner, no engine/global state/numerical duplicate. Mode-neutral
caller fixtures prove context data semantics only; gameplay profiles remain
NOT_EVALUATED. Combat phase IN_PROGRESS; Developer acceptance PENDING.

## v0.4.1 checkpoint evidence

H11/H12 now include CB06–CB10 installed admission/rejection priority, malformed
boundaries/getter safety, immutable results, deterministic sessions and unchanged
domain state. 79 installed contracts (75 prior +4 admission), 2 outer gates,
zero skips; strict external NodeNext verifies readonly fields and literal unions.
H04 registry and Core pin unchanged. Source review supplements tests for no target
lookup, HP/life transitions, events, numerical work, sessions or hidden providers.
Gameplay profile behavior NOT_EVALUATED; phase IN_PROGRESS, acceptance PENDING.


## v0.4.2 current evidence

Installed CB11-CB15 adds four focused runtime groups: policy/identity, rejection
priority/stage boundary, malformed-input/getter safety, immutable deterministic
sessions. Strict external NodeNext verifies root types and closed deep exports.
Actual package0.4.2 + pinned Core artifact; 83 installed contracts (79 retained +4),
2 outer gates, zero skips. Source/diff audit supplements tests for no numerical
execution/event/store/duplicate owner and unchanged registry/Core/Group A. Mode
profiles remain NOT_EVALUATED. Exact-head push/PR evidence is on existing Draft PR.

## v0.4.3 current evidence

CB16–CB20 adds seven installed numerical/stage/RNG/immutability/replay groups and
strict public-type checks. Current90 installed contracts (83 retained +7),2 outer
gates, zero skips. Literal B0=100/B1=150/final75 and RNG traces complement direct
public Kernel diagnostic comparisons. Actual package0.4.3/Core tarballs, lockfile
integrity and closed exports are mandatory. Source/diff audit proves no new state,
events, formulas or Group A/Core/registry changes. Exact-head Windows/Ubuntu
Node22/24 push+PR jobs remain the checkpoint delivery gate. Profile gameplay
behavior NOT_EVALUATED; phase IN_PROGRESS; Developer acceptance PENDING.

## v0.4.4 current evidence

CB21–CB25 adds eight focused installed runtime groups plus strict public-type
checks: normal/custom resources; lethal/overkill/minimum/dead; above-max applied;
dodge/zero no-op; malformed receipt; state/policy/identity validation; immutability;
independent actual end-to-end replay/parity. Total98 installed contracts
(90 retained +8),2 outer gates, zero skips. Literal independent oracles supplement
canonical Entity result comparisons. Actual0.4.4/Core artifacts, SHA-512 integrity,
strict external NodeNext and closed exports remain mandatory. Source/diff review
covers canonical ownership/no hidden events or state. Exact-head Windows/Ubuntu
Node22/24 push+PR CI required; profiles NOT_EVALUATED, acceptance PENDING.
