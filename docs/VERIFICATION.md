# Verification gates — v0.1.0 package foundation

Prepare the pinned Core artifact with `npm run core:prepare`, then install using
`npm ci --ignore-scripts`. See CORE_INTEGRATION.md for tool versions and pin.

| Command | Evidence | Limits |
| --- | --- | --- |
| `npm run build` | Clean JS/declaration emit from strict native ESM/NodeNext source | Root has no gameplay API |
| `npm run typecheck` | Strict source typecheck, no emit | No gameplay semantics |
| `npm run harness:check` | Registry, literal import/dependency direction, runtime package policy, obvious hidden RNG/time | Lexical, not full TS AST/semantic analysis |
| `npm run harness:selftest` | Positive/negative boundary controls | No runtime module enable/disable |
| `npm run test:functional` | External installed-artifact ESM/declarations/closed exports/real Kernel; gate orchestration failures | Build first; no gameplay profiles |
| `npm run verify` | Boundaries, self-tests, required build, typecheck and functional contracts, in that order | Automated evidence is not Developer acceptance |

`verify` checks that all three production scripts exist before running any of
them, and fails on a nonzero result, spawn error or termination signal. Node and
npm CLI subprocesses use argument arrays with `shell:false`. The regression test
records gate execution order, fails each gate individually, rejects missing
scripts and uses a Node executable path containing spaces.

CI reconstructs Core from the pinned SHA, verifies artifact integrity, installs
locked packages and runs full verification on Windows/Linux with Node 22/24 and
npm 12.2.0. Results apply only to the exact tested commit. macOS is not in this
matrix. The implementation report records actual commands/results.

## Honest scope

v0.1.0 has an empty public gameplay entrypoint, not an empty verification gate:
functional tests exercise packaging, types, dependency integration and failure
propagation. Gameplay behavior, GF01–GF16, and Text/2D/2.5D profiles are
**NOT_EVALUATED**. No placeholder gameplay functions or fake passing scripts.

If source is absent, the historical scaffold path still reports
`HARNESS_VERIFIED; GAMEPLAY_NOT_EVALUATED`. Once production source exists, build,
typecheck and functional gates are mandatory. Later approved gameplay tasks must
add real function/profile evidence and update this scope statement.

Report `PASS`, `FAIL`, `NOT_RUN`, `NOT_EVALUATED` or `BLOCKED_WITH_EVIDENCE` truthfully.
Semantic duplication, game policy and global gameplay state need source review;
static import checks alone cannot prove their absence.
