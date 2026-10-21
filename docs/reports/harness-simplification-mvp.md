# Harness simplification — MVP

Baseline: `c4af54096248e203f6942d90484e532b9b2e51f8`, clean local/upstream/PR head
on `feat/v0.9-item`. Delivery: the single commit containing this report;
[Draft PR #14](https://github.com/TjnhPro/rpg_gameplay/pull/14) receives the exact
delivered SHA and CI run URL in a supplement after push. **CI_PENDING at commit**;
READY_FOR_DEVELOPER_REVIEW requires that supplement's exact-head 1/1 PASS.

**Zero gameplay delta:** all 13 `src` files, `harness/core-pin.json`,
`harness/modules.json`, `package-lock.json`, `tsconfig.json` and the boundary checker
have identical baseline Git blobs (Windows clean filters accounted for). The two
temporary source probes restored their original byte buffers in `finally`.
All non-script `package.json` fields are equal; package stays `0.9.3`.
Core stays `2.0.0`, revision `04b7239f998c3c688a0dfa3202f11811a9acd775`,
with unchanged lock integrity, owners, module graph and public source/API.

**Changed files:** `scripts/verify.mjs`, `package.json` scripts,
`.github/workflows/harness.yml`; nine `tests/unit/*.test.mjs` files below;
`AGENTS.md`, `README.md`, `docs/{TESTING,VERIFICATION,TASK_EXECUTION}.md`,
`docs/tasks/TASK_TEMPLATE.md`, `docs/quality/FAILURE_LOG.md`,
`docs/reports/{README,harness-simplification-mvp}.md`.
Deleted all 124 former tracked test files: 117 `tests/consumers/*` fixtures,
`tests/{foundation.test,verify.test,consumer-evidence}.mjs` and four
`tests/item-*-evidence.mjs` helpers; also deleted `scripts/harness-selftest.mjs`.
Historical reports remain provenance, not current executable requirements.

| Owner → new `tests/unit/` file | Direct observable behavior retained |
| --- | --- |
| Foundation → `foundation.test.mjs` | dependency order/missing dependency; explicit lifecycle, stale capability rejection, reflection cannot expose mutators; owned command, missing provider rejection |
| Entity → `entity.test.mjs` | create/get/replace identity, duplicate rejection; Kernel-derived power 29; HP20→0, death, revival requires recovery |
| Progression → `progression.test.mjs` | EXP260→level3/EXP10; negative gain, reward replay and exhausted point spend rejected |
| Combat → `combat.test.mjs` | admitted attack, dead source/ally rejection; injected RNG repeat equality; canonical damage150/applied100/defeat and unchanged inputs |
| Skill → `skill.test.mjs` | admission/dead rejection; mana100→75/insufficient rejection; Kernel cooldown750ms, no refresh, ready at1750 |
| Effect → `effect.test.mjs` | apply/dead-target rejection; timed effect present5999/expired6000 without mutating prior snapshot |
| Actor AI → `actor-ai.test.mjs` | unordered candidates select A, candidate-only state; manual selection/dead life gate reject without dispatch |
| Encounter → `encounter.test.mjs` | explicit activation; join/change-side/leave, duplicate rejection; active/member scope; pending versus explicit resolve/close |
| Item → `item.test.mjs` | binding, detached nested immutable data, cyclic/getter rejection without getter execution; admitted/rejected property candidates; equal/different-property stack assessment |

**Observed local verification:** Windows, Node `24.18.0`; `npm run build` then
`node --test tests/unit/*.test.mjs` passed before deleting the old suite.
Final `npm run verify`: boundaries → build → strict repo NodeNext → function tests,
each once; exit0, 12 passed, 0 failed/skipped. Full wall time **4.328 seconds**
(PowerShell Stopwatch, dependencies already installed). Comparable before timing:
**NOT_MEASURED in this refactor**; no speedup ratio claimed. `git diff --check` clean.

**Three temporary RED→GREEN checks:** incorrect Item expected ID made full verify
exit1 at `test:functional`, then restored Item tests passed; a string assigned to a
number in `src/index.ts` made typecheck exit2/TS2322, then restored typecheck passed;
Item import of Entity made checker exit1 (`undeclared module dependency item -> entity`),
then restored boundary check passed. No probes remain in source or default tests.

**CI/settings:** one PR-to-main Ubuntu/Node22 job, optional manual dispatch, no push
matrix. Checkout uses delivered PR head. Core is rebuilt once per job (no artifact
cache) and SHA-512-checked against the unchanged lockfile before locked install.
Main required-status API returned404 `Branch not protected`; no settings changed.
Default branch remains `master`; correcting it to `main` is deferred to the owner.

**Coverage deliberately reduced:** no physical tarball installation/external consumer
NodeNext, exhaustive malformed-input or attack/feedback permutations, historical hash/
export/packed-file inventories, mutation matrix or Dungeon/Wave/L4 simulation.
CI no longer establishes Windows/Node24 equivalence per commit; this local Windows
Node24 run is separate evidence. Packaging/platform release checks are deferred until
needed. No gameplay feature, Core, version, dependency, architecture or acceptance change.
