# Harness evolution — evidence from actual failures

Add an entry **only** when a real failure/friction is observed. Do not create process for hypothetical failure modes.

Template:

- Date / Task ID:
- Observed failure / reproduction:
- Root cause / broken invariant:
- Affected module / Core boundary:
- Narrowest safeguard (function regression, static check, doc/contract update):
- Verification of safeguard:
- Developer approval if contract/owner changed:

## 2026-10-21 — MVP harness simplification

- Observed friction: approved additive Item exports required `historicalBeforeItem`
  normalization of older source fingerprints; historical version/export inventories
  repeatedly blocked legitimate additive checkpoints. The daily runner also packed,
  installed and mutated artifacts and repeated an eight-job CI matrix.
- Cause: historical source identity and phase orchestration became behavioral oracles.
- Boundary: harness-only; production, Core pin, owners, module graph and versions frozen.
- Correction: selected direct public function tests, unchanged boundary checker, strict
  repo NodeNext, four-step verifier and one Ubuntu/Node22 PR job. Delete obsolete runner,
  consumers, mutation/hash/normalization helpers and harness selftest.
- Evidence: [migration report](../reports/harness-simplification-mvp.md), including three
  temporary RED-to-GREEN sanity checks. Removed assurance is explicitly documented.
- Approval: Developer supplied the harness task and authorized its implementation and
  separate `refactor(harness): simplify MVP function verification` commit.
