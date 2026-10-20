# Approved Task Execution — ChatGPT → Agent

## Authority

**Developer + ChatGPT:** discuss design and author task/plan. **Developer:** approves exact task. **Agent:** implements within that approved plan, provides evidence. **Developer:** closes the phase.

Do not let an agent create a replacement plan that changes scope on its own. A code task should include the exact approved text (pasted in prompt) and be recorded in `docs/tasks/active/<task-id>.md` before modifying implementation. After Developer acceptance, move the record to `completed/` with the decision. Plan records are source of truth for future agent runs.

## Execution protocol

1. Preflight: repo status, approved task ID/text, Core dependency, existing owners/public contracts, current checks.
2. Name impacted module(s), scope, invariants, expected behavior and explicit non-goals. Do not reinterpret plan boundaries.
3. Implement only authorized changes. Use canonical ownership; no workaround implementation or fake passing tests.
4. Add only contract/behavior tests with independent expected values and a simple requirement→test evidence table.
5. Run targeted checks while iterating; full `npm run verify` before asking Developer acceptance. If a gate cannot run, report as NOT_RUN/BLOCKED rather than PASS.
6. Self-review changed files/diff, duplicate implementations, module dependency, docs drift; attach concrete results.
7. Report `READY_FOR_REVIEW`, `BLOCKED_WITH_EVIDENCE`, or `REJECTED` (not `ACCEPTED` without Developer decision).

## STOP / approval required

- Changes outside approved scope, extra feature/module or API change not in plan.
- Changing layer/module ownership, dependencies in a breaking way, architecture, public contracts.
- Any edit to `rpg_core`, numerical capability gap or use of Core Legacy implementation.
- Test oracle change without independent expected result, bypass of static/CI tests, replaced canonical owner.
- Data loss, security-impacting change or uncertain semantics with large consumer impact.

## Small implementation choices

Agent may choose local implementation details, names of internal helpers, test input fixtures and refactors **within the approved scope** without seeking micro-approvals. Ask only if an important boundary/requirement cannot be decided from the approved plan.

See [Task Template](tasks/TASK_TEMPLATE.md).

## Phase workflow from v0.2.x

Developer approved **one phase = one branch = one PR**. Entity / Character uses
`feat/v0.2-entity-character` and one Draft PR to main for v0.2.0–v0.2.5. Only
v0.2.0 creates the branch/PR. Each later milestone needs its own approved task,
separate checkpoint commit/report and progress update on the same branch/PR.
Do not create milestone branches/PRs, merge/rebase to main between milestones,
rewrite checkpoint history, tag or publish intermediate versions.

Each checkpoint runs targeted evidence, full verify, self-review, commit/push
and observes checkpoint CI. Status is CHECKPOINT_COMPLETE when gates pass, not
ACCEPTED. Intermediate checkpoints do not require final phase PR review; phase
remains IN_PROGRESS and PR DRAFT. Report architecture/Core/breaking-semantic
blockers immediately. Only v0.2.5 performs full phase closure/regression and moves
the PR to Ready for Review after required gates. Developer decides final phase
acceptance and merge. Existing scope/authority rules remain in force; checkpoint
completion does not authorize the next milestone without its approved task.

## Active Progression phase

Approved task: `tasks/active/v0.3.0-progression-foundation.md`.
Phase branch `feat/v0.3-progression`, one Draft PR for v0.3.0–v0.3.5, base main
at merged Entity PR #7. Each milestone has its own approved task, checkpoint commit,
verification and exact-head CI. Milestone delivery is CHECKPOINT_COMPLETE only;
phase stays IN_PROGRESS. No intermediate merge/tag/publish. Only final v0.3.5
may prepare full phase review; Developer decides acceptance and merge.

## Active Combat phase

Approved task: tasks/active/v0.4.0-combat-foundation.md. Phase branch
feat/v0.4-combat, one Draft PR explicitly targeting main through v0.4.5.
Baseline is merged Progression PR #8 at c550669. v0.4.0 authorizes CB01–CB05
only: action intent snapshots, optional dependency, validation and evidence.
Each later milestone requires its separately approved task; no admission/target
policy/attack/damage/death/Skill implementation is implied. Checkpoint delivery
is CHECKPOINT_COMPLETE after local and exact-head CI evidence. Phase remains
IN_PROGRESS, PR DRAFT, Developer acceptance PENDING; no merge/tag/publish.

## Combat final integration authorization (v0.4.5)

Approved task: tasks/active/v0.4.5-combat-integration-closure.md. Continue
feat/v0.4-combat/PR #9 from completed0.4.4 checkpoint. CB26–CB30 is installed
integration/whole-phase audit and review handoff; no new mechanics/facade or
Group A/Core change. Version0.4.5, all local and exact-head CI gates, tracked
closure report and ignored self-contained handoff are required before moving
existing PR from Draft to Ready for Review. Final evidence stays ignored/PR-side
to preserve verified SHA. Developer alone accepts/closes; no merge/tag/publish.

## Active Skill phase (v0.5.0)

Task: tasks/active/v0.5.0-skill-foundation.md, submitted for execution under the
Developer's standing instruction to proceed without repeated approval requests.
Create feat/v0.5-skill from accepted main82feaf5 (merged Combat PR #9), then reuse
one Draft PR targeting explicit main through v0.5.6. SK01–SK05 authorizes only
optional skill -> entity, identity-only definitions/instances and verification.
No accepted owner/Core changes, numerical operations, availability/activation,
cost/cooldown/loadout or catalog/runtime engine. Each checkpoint requires local
and exact-head push+PR CI evidence. Status CHECKPOINT_COMPLETE, phase IN_PROGRESS,
PR DRAFT and Developer phase acceptance PENDING; no Ready/merge/tag/publish or
next milestone without its own task. The submitted task's PROPOSED header is
retained verbatim as source text; it is not phase acceptance evidence.

## Active Skill admission checkpoint (v0.5.1)

Approved submitted task: tasks/active/v0.5.1-skill-availability-admission.md.
Continue feat/v0.5-skill / existing Draft PR #10 from verified v0.5.0 checkpoint
a60de0c1ee96df637be59289e68a6ffe88bda024. SK06–SK10 authorizes one pure admission
operation/five types, canonical Entity lookup/Life snapshots, explicit caller
rank/ownership/eligibility, deterministic fail-closed assessment and installed
contracts. No accepted owner/Core/dependency/schema changes or activation/cost/
cooldown/loadout. Required local and exact-head push+PR CI precede checkpoint
completion. Phase IN_PROGRESS, PR DRAFT, acceptance PENDING; no v0.5.2/merge/tag/
publish/Ready transition implied.

## Active Skill resource-cost checkpoint (v0.5.2)

Submitted task tasks/active/v0.5.2-skill-resource-costs.md authorizes SK11–SK15 on
feat/v0.5-skill/existing Draft PR #10 from c762a4d92b43d3b5ecc5e74a7654d93fa801543e.
Two public functions/seven proposed types, canonical Entity/Core transitions,
all-or-nothing candidate state, installed contracts and same-head CI. No protected
owner/Core/dependency/architecture changes or activation/cooldown/execution.
Required fresh baseline/local gates, self-review and exact-head push+PR CI precede
CHECKPOINT_COMPLETE. Phase IN_PROGRESS, acceptance PENDING, PR remains DRAFT;
no v0.5.3/merge/tag/publish/Ready authorization.

## Active Skill cooldown checkpoint (v0.5.3)

Submitted task tasks/active/v0.5.3-skill-cooldown.md authorizes SK16–SK20 on
feat/v0.5-skill/existing Draft PR #10 from ef74bb8b8474adc2f77179c4d1eca527325658ae.
Three functions/six proposed types, independent immutable cooldown state,
canonical Core duration and Foundation time, installed contract evidence and
same-head Windows/Linux Node22/24 push+PR CI. No protected owner/Core/pin/dependency
edits, timer/global runtime or activation. CHECKPOINT_COMPLETE requires every
gate PASS. Phase IN_PROGRESS, acceptance PENDING, PR DRAFT; v0.5.4 NOT_STARTED.
No Ready transition, merge, tag or publish authorized.

## Active Skill activation checkpoint (v0.5.4)

Approved submitted task tasks/active/v0.5.4-skill-activation-execution.md authorizes
SK21–SK25 on feat/v0.5-skill/existing Draft PR #10 from20f64a735239168c980fcd29a8c0a8853228236f.
Two functions/nine types, reuse existing private validators and canonical
Resource/Cooldown operations, installed actual caller-mediated Combat handoff,
minimal contract evidence, local gates and exact-head push+PR CI. No protected
owner/Core/pin/dependency/registry changes. CHECKPOINT_COMPLETE requires all gates;
phase IN_PROGRESS, Developer acceptance PENDING and PR remains DRAFT.
No merge/tag/publish/Ready or v0.5.5 implementation authorization.

## Active Skill Slots & Loadout checkpoint (v0.5.5)

Approved submitted task tasks/active/v0.5.5-skill-slots-loadout.md authorizes
SK26–SK30 on feat/v0.5-skill/existing Draft PR #10 from verified v0.5.4 checkpoint
0b15fad46ce4666b5b7e4254b61fdb36ab444fcb. Five functions/eight types, references-only
Loadout, canonical identity reuse, explicit L3 policies, immutable transitions,
installed evidence, local gates and exact-head push+PR CI. No protected owner,
Core/pin/dependency/registry/CI edits. Phase IN_PROGRESS, acceptance PENDING,
PR remains DRAFT. No Ready/merge/tag/publish or v0.5.6 implementation authorized.
