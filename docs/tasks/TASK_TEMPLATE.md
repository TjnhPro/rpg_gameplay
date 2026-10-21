# TASK — <id>: <title>

**Approval:** <Developer instruction / link>
**Baseline:** <branch, SHA, working tree>
**Objective:** <one measurable behavior>

## Scope and ownership

<Allowed files/modules/public contracts and explicit non-goals. Canonical owner,
module dependencies, Kernel calls and L3/L4 responsibilities. Escalate real gaps.>

## Functional evidence

| Contract | Public function and explicit input | Independent expected result | Test file |
| --- | --- | --- | --- |
| <invariant> | <call> | <positive and material rejection/edge> | tests/unit/<owner>.test.mjs |

Use deterministic providers. No test quotas, historical hashes, synthetic mutation
matrices, export counts or mandatory installed consumers. Add focused release checks
only when a concrete need is approved. Record coverage limitations honestly.

## Verification and delivery

- Setup dependencies separately; build before targeted direct function tests.
- Run `npm run verify`: boundaries, build, strict typecheck, function tests once.
- Review scope/diff; commit/push only approved changes to the specified branch/PR.
- Record actual local results and exact-head single Ubuntu/Node22 CI result.
- Report READY_FOR_DEVELOPER_REVIEW or concrete blocker; Developer accepts completion.
- No merge, publish, tag, Ready conversion or next phase without authorization.
