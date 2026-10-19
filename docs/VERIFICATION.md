# Verification gates — v0.2.0

Prepare the pinned Core artifact with `npm run core:prepare`, then install using
`npm ci --ignore-scripts`. See CORE_INTEGRATION.md for tool versions and pin.

| Command | Evidence | Limits |
| --- | --- | --- |
| `npm run build` | Clean JS/declaration emit from strict native ESM/NodeNext source | GF01–GF16 and EC01–EC03 only; no game loop |
| `npm run typecheck` | Strict source typecheck, no emit | No gameplay semantics |
| `npm run harness:check` | Registry, literal import/dependency direction, runtime package policy, obvious hidden RNG/time | Lexical, not full TS AST/semantic analysis |
| `npm run harness:selftest` | Positive/negative boundary controls | No runtime module enable/disable |
| `npm run test:functional` | External installed GF01–GF16/EC01–EC03, full Foundation flow and payloads, ESM/declarations/closed exports/real Kernel; gate failures | Build first; no gameplay profile behavior evidence |
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

`src/index.ts` remains mandatory. If it is absent, verification fails with
`VERIFY_FAIL` and exit code 1; there is no scaffold-success fallback. Build,
typecheck and functional gates are mandatory for successful verification.
Later approved gameplay tasks must
add real function/profile evidence and update this scope statement.

Report `PASS`, `FAIL`, `NOT_RUN`, `NOT_EVALUATED` or `BLOCKED_WITH_EVIDENCE` truthfully.
Semantic duplication, game policy and global gameplay state need source review;
static import checks alone cannot prove their absence.
