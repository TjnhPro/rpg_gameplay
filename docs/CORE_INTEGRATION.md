## Effect Foundation v0.6.0 capability audit

Core stays 2.0.0 at 04b7239f998c3c688a0dfa3202f11811a9acd775, with unchanged
lockfile integrity and harness/core-pin.json. Effect identity and immutable
structural association require no numerical calculation. Public Kernel types
cover numerical stats/modifiers/resources/damage/defense/cooldown; historical
Core ./effects is outside the allowed Kernel surface and is neither imported nor
copied. No Core implementation/pin/dependency change is needed. Future numerical
work must inventory Kernel support first; unsupported capabilities are deferred
from MVP, never reimplemented in L2.

# Core Kernel integration

## v0.5.6 closure verification

Core remains 2.0.0 at revision
04b7239f998c3c688a0dfa3202f11811a9acd775 with unchanged artifact/lock integrity.
Installed tests verify the actual Core artifact, exact peer/version and non-symlink
installation. Ranked Skill dispatch uses canonical Combat/Core; Skill payment
uses Entity transitions and cooldown uses Core. No Core change, fallback formula
or alternate calculator is included. Package0.5.6 is packed for isolated consumer
verification only; npm publishing is not authorized.


Only production import: `@rpg/core/kernel`. Core root, Legacy entrypoints, source
checkout paths and `dist` deep imports remain forbidden. No numerical code is
copied or implemented in L2. GF01–GF05 registry/configuration/dependency/composition functions require no
numerical calls; neither do the lifecycle/messaging/execution owners GF06–GF16.
The accepted Core pin and package integration remain unchanged in v0.1.5.

## Pin and reconstruction

- Source: https://github.com/TjnhPro/rpg_core
- Revision: `04b7239f998c3c688a0dfa3202f11811a9acd775`
- Installed package: `@rpg/core` 2.0.0, public `./kernel` JS + declarations.
- Pin metadata: `harness/core-pin.json`; tarball SHA-512: `package-lock.json`.
- Artifact: ignored `.artifacts/rpg-core-2.0.0.tgz`; no artifact committed.

Development and CI use npm 12.2.0 (Node 22.22.2+ or 24.15+). From a fresh clone:

```sh
npm run core:prepare
npm ci --ignore-scripts
npm run verify
```

`core:prepare` clones into a temporary directory with LF checkout, checks the
exact Git SHA/package identity/public Kernel export, installs Core's own locked
dev tools with lifecycle scripts disabled, then executes its three build stages:

1. Core's `scripts/clean.mjs`.
2. Core's installed TypeScript compiler against `tsconfig.json`, with `--newLine lf`.
3. Core's `scripts/legacy-build-paths.mjs` (part of its existing package build).

It packs with lifecycle scripts disabled, hashes the result, compares against the
committed lock integrity, and only then copies the artifact into `.artifacts/`.
No Core source or Developer checkout is changed. LF checkout/compiler output
keeps artifact bytes consistent between Windows/Linux. All subprocesses use
argument arrays and `shell:false`. Temporary directories are cleaned on failure.

The clone/build includes Core's existing Legacy package files, but L2 neither
imports nor tests Legacy behavior. Dependency and source guards enforce the only
allowed public entrypoint. This workflow does not require registry publication
or a machine-specific source path. Availability of GitHub and npm remains an
external requirement. Do not replace a missing Kernel with mocks/calculators.

## Dependency and consumer contract

The repository installs Core from the relative artifact as an exact development
dependency, pinned by lock integrity. The distributed gameplay manifest declares
an exact `@rpg/core: 2.0.0` peer. This avoids embedding a repository-local artifact
path in the consumer's runtime dependency resolution and keeps a single Core
instance shared with its caller. Private package consumption requires the caller
to supply the same built Core artifact explicitly, alongside the gameplay tarball
(see README). The peer version alone does not prove the caller's Git revision;
this repository's producer/CI workflow and artifact integrity supply that evidence.

The external consumer test installs both tarballs, executes public
`calculateResourceTransition` with independently specified expected output, and
checks strict NodeNext Kernel types. Kernel types stay canonical; approved Entity wrappers orchestrate them below.
Any pin change is a separate approved task with new audit and integrity evidence.

## EC07–EC09 numerical delegation

Entity's stat calculation path calls `prepareNumericalModifiers()` for
each explicit modifier list, then `calculateStats()` with captured ordered input.
Empty modifiers use the same path. Public EntityStatConfiguration composes
PreparedStatCalculationInput/NumericalModifier; no incompatible rule types or
second scalar/stat/modifier calculator are maintained in L2. Entity validates
shapes/finite values/references and captures configuration before execution;
Kernel owns canonical selection/conflicts, modifier arithmetic, effective
attributes, baselines/scaling, defaults, transforms, bounds/precision and ordering.
L2 projects only frozen detached attributes/values maps, with no recomputation.
Caller transforms must return finite numbers synchronously; invalid returns fail
instead of entering the snapshot. Callback closure policy remains caller-owned.

Installed package evidence uses the actual pinned Kernel, not mocks:
25/29/32 independent oracle, attribute clamping, baseline offsets, all modifier
operations, identical-instance dedup/conflict, rounding/reclamping, disabled rules,
stat order and callback capture. Source review confirms no parallel arithmetic.
Core revision/lock integrity, peer/development dependency and reconstruction are
unchanged; Entity identity/attribute creation/update and collection operations need no calculation.

## EC10–EC13 resource delegation

The same Entity owner calls normalizeResource once per initialization definition
and once per explicit normalization; calculateResourceTransition once per explicit
increase/decrease; calculateResourceRegeneration once per explicit regeneration.
Public options/results compose ResourceNormalizationInput/Result,
ResourceTransitionInput/Rule/Result and ResourceRegenerationInput (including its
DecimalPrecision). No duplicate clamping, regeneration formula, rounding or applied
magnitude reconstruction exists in L2. Frozen diagnostics copy Kernel scalars verbatim.

L2 owns exact identity/current snapshots, finite scalar/shape validation, fixed keys
and explicit next-state orchestration. Caller owns bounds, recovery/above-max
policy, eligibility, rate, elapsed seconds and precision. Eligible regeneration
requires normalized current. Ineligible regeneration preserves Kernel's early no-op
without reading ignored numeric/accessor fields or synthesizing them. The internal
partial-input cast exists only for that pinned public Kernel early return; the
public consumer type retains the full Kernel-shaped options contract.

Independent installed-package oracles include omitted-current mana50, health80,
normalization100→80, decrease80→55/increase55→70, above-max increase120→100 with
applied-20 and decrease120→100 with applied10, minimum recovery and regeneration
30→35/applied5. Eligible=false returns120 unchanged with unreadable ignored fields.
The EC08 integration explicitly passes a calculated stat100 then80 as maximum;
no auto sync occurs. All old numerical/Foundation/Entity fixtures remain unchanged.
Core pin, integrity, dependencies and static module registry are unchanged.

## EC14–EC17 life policy boundary

Life creation/defeat/revival invokes no Kernel operation. Reuse canonical EC10
own-data/finite resource inspection, then compare current with caller bounds.
Defeat is explicit equality at minimum; reachedMinimum remains a numerical
diagnostic alone. EC12 recovery0→30 and EC11 reset/normalization are separate
caller operations before life-only revival. No arithmetic, refill, rounding or
applied reconstruction is added. Core revision/integrity and installed real
Kernel regression evidence are unchanged.

## EC18 integration audit

v0.2.5 adds installed consumer evidence with the unchanged actual Core artifact.
Literal oracle: max-life 25/29/32, normalization 30 to 25, resource decreases
25 to 20 to 0, explicit regeneration 0 to 10. All arithmetic remains in the
five existing Kernel functions; life only evaluates caller-selected bounds.
No source, Core pin, dependency, integrity or numerical implementation changed.

## PG07–PG10 approved bookkeeping boundary

The v0.3.2 task permits explicit requirement comparison, ordered level increment,
local EXP cost subtraction and before/after diagnostics in Progression. Cumulative
EXP is preserved. Core 2.0.0 has no Level/EXP-specific calculator; no synthetic
resource policy, dummy Kernel call, curve or parallel numerical engine is added.
The pin/reconstruction/dependencies remain unchanged; installed real Kernel and
all Entity delegation regressions continue to run. PG05/PG06 arithmetic is unchanged.

## PG11–PG13 approved point bookkeeping

Safe integer point grants/spending and reward cursor checks are L2 bookkeeping.
Caller provides per-level rewards and allocation cost/new base value. Canonical
Entity setter updates Base Attributes; later explicit Entity stat calculation
still invokes real pinned Kernel. No Progression stat formula/calculator, Core
change or dependency change. Installed trace independently expects strength20 ->
power45, then strength23 -> power51 only after explicit recalculation.

## PG14–PG18 approved rank/point bookkeeping

Skill point grants/spending, one-rank increment, cap/character-level/prerequisite
comparisons and immutable diagnostics are task-approved L2 bookkeeping. Caller
supplies per-level rewards, rank caps, per-request cost and eligibility. No Skill
damage/cost/cooldown/effect/scaling calculator or dummy Kernel call. Core pin,
lock integrity and real installed Kernel/Entity numerical regression remain intact.


## PG19 installed integration

The v0.3.5 external consumer installs actual gameplay/Core tarballs and asserts
strength20 -> power45, then explicit canonical allocation to23 -> power51 through
calculateEntityStats. A caller transform counter proves allocation never invokes
stat calculation. No Progression formula/Kernel mock or numerical fallback.
Pin, peer/dev dependencies and tarball SHA-512 remain unchanged across the whole
Progression phase; the installed runner verifies artifact bytes against the lock.

## CB16–CB20 numerical delegation (v0.4.3)

resolveCombatAttack delegates calculateHit, calculateCritical, calculateDamageB0,
calculateDamageB1 and calculateMitigation to the pinned public Kernel. Input types
compose its public contracts. Ordered scaling snapshots adapt sourceOrder,
sourceValue/coefficient callbacks; explicit flat data adapts resolveFlat. No L2
numerical formulas, clamps or fallback engine. Already-effective bonus values go
to B1 unchanged; actual critical.bonus enters once, never multiplier a second time.

Lazy roll closures call Foundation nextExecutionRandom only when Kernel requests
it. Zero/disabled/ineligible dodge consumes zero; eligible enabled critical still
draws at chance zero. Dodge skips Critical/B0/B1/Mitigation. Invalid RNG propagates
without retry/default/rollback. Enabled mitigation requires complete valid config;
missing_config never succeeds. Every numerical diagnostic must be finite, copied
and frozen without mutating Kernel results. Disabled mitigation preserves actual
missing diagnostics. Core2.0.0 pin/revision/artifact integrity remain unchanged.

## CB21–CB25 canonical resource semantics (v0.4.4)

Combat calls Entity transitionEntityResource with amount=actual CB20 finalDamage,
operation=decrease, caller resource/bounds/currentAboveMaximum and fixed
allowIncreaseFromMinimum:false. Then resolveEntityDefeat uses its updated state.
No direct resource arithmetic or second Core damage calculation. appliedDamage
is exactly resourceResult.transition.applied. Pinned Kernel permits above-max
140->100 after requested20 while applied=20 and delta=40; Combat preserves this.
Above-max reject propagates the canonical Entity/Core error, with originals intact.
No-op paths never transition/normalize/evaluate defeat. Core pin/artifact/deps
remain unchanged; real installed integrity and numerical regressions are required.

## v0.4.5 full-flow integration evidence

Pinned Core2.0.0/revision04b7239f998c3c688a0dfa3202f11811a9acd775 and locked
SHA-512 remain unchanged. Two installed sessions independently assert raw100,
critical bonus.5, B1=150, reduction.5, final75; application threads HP100->25->0
with applied75/25. Dodge chance0 consumes0; Critical consumes2 total. Real positive
CB20 resolution also supplies20 for above-max140->100/applied20/delta40.
No numerical reimplementation or new runtime dependencies. Existing artifact-byte
integrity and public Kernel consumers remain mandatory. Consumer literal oracles
are independent expectations, not values regenerated from implementation output.

## SK11–SK15 canonical cost transitions (v0.5.2)

Skill delegates positive costs through Entity transitionEntityResource(decrease),
with caller bounds/policy and allowIncreaseFromMinimum:false. Exact canonical
applied determines full payment; no subtraction, clamping, tolerance or rounding.
Core140->100 for cost20 preserves applied20/delta40. Above-max reject and other
canonical errors propagate without fallback. Zero/free performs no numerical
operation; full-state validation still uses Entity lookup. Installed package
literal oracles and unchanged artifact SHA-512 prove real pinned Core integration.

## SK17 canonical cooldown duration (v0.5.3)

Skill calls the actual pinned public Kernel calculateCooldownDurationMs(baseMs,
effectiveCdr) only for ready starts. L2 validates closed configuration: finite
base>=0 and finite effectiveCdr in [0,1]. Core's returned duration is used unchanged;
no copied formula/double reduction/round/clamp/epsilon. Literal installed oracles:
1000/.25 ->750; 1000/0 ->1000; 1000/1 ->0; 1001/.5 ->500.5. L2 only adds the
observed Foundation timestamp and checks finite/later representability. Active
reuse does not invoke duration calculation. Kernel errors propagate; Core pin,
revision, lock integrity and dependencies remain unchanged.

## SK21–SK25 activation reuse (v0.5.4)

Activation introduces no numerical implementation: applySkillResourceCosts owns
all-or-nothing payment via canonical Entity/Core and startSkillCooldown owns
canonical duration via the unchanged pinned public Kernel. Earlier rejected
gates perform structural Entity lookup only; no numerical transition/time read.
Canonical errors propagate. Actual installed handoff exercises Combat->Kernel
attack/damage and Entity Resource/Life application; Skill imports no Combat.
Core2.0.0 revision04b7239f998c3c688a0dfa3202f11811a9acd775, artifact integrity,
registry, dependencies and protected owners remain unchanged.
