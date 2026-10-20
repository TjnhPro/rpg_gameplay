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
