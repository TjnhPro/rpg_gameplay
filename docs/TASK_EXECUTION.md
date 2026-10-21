# Approved task execution

Implement only the Developer-approved task. An explicit instruction to implement
is approval; do not request it again for routine work inside that scope. Recheck
branch, remote HEAD, working tree and task boundaries before editing. Preserve user changes.

L2 remains headless/function-first. Import only public `@rpg/core/kernel`; retain
canonical module owners and explicit dependencies. No game application, second engine,
default game policy, Core workaround or unapproved API/architecture expansion.
Escalate actual scope/ownership/Core gaps with evidence and options.

For an approved behavior, add the smallest useful direct function tests with independent
expected values and a material rejection/edge case. Use explicit caller clock/RNG.
Approved module/export additions do not need repeat permission to adjust relevant tests;
there are no historical source hash, whole-root export count or test quota gates.

Run targeted tests after build, then `npm run verify`, self-review diff and report
observable coverage and limits. Setup/install is separate from verification.
Follow [TESTING](TESTING.md) and [VERIFICATION](VERIFICATION.md).

Commit only authorized files, push the approved branch/PR and confirm the single CI
job at the exact delivered SHA. Keep PR Draft unless Developer says otherwise.
No merge, tag, publish or next phase without a separate instruction. Developer alone
accepts completion; report READY_FOR_DEVELOPER_REVIEW after actual gates pass.

## Harness simplification authorization

The approved 2026-10-21 MVP harness task supersedes historical consumer immutability,
source fingerprint, export inventory, mutation and eight-job requirements for this
refactor. It freezes all production bytes, Core pin, module graph, lockfile, version
and strict compiler configuration. See [delivery report](reports/harness-simplification-mvp.md).

Existing phase task files and reports remain historical provenance. Their removed
test paths/commands and gate counts are not live verification obligations.
