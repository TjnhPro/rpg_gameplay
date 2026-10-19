# Verification Gates — actual capabilities and truthful results

## Current scaffold (no gameplay code yet)

| Command | What it checks | What it does NOT check |
| --- | --- | --- |
| `npm run harness:check` | Registry, static source imports, import direction, basic deterministic constraints | Semantic duplicate detection, full TS AST, actual module enable/disable |
| `npm run harness:selftest` | Negative and positive controls for the guard | Gameplay logic |
| `npm run verify` | Above checks; checks existence of production test/typecheck scripts if production code exists | Gameplay functionality when no production source exists |

With empty `src/`, `verify` emits `GAMEPLAY_NOT_EVALUATED`. This is intentional.

## Gate progression (when gameplay modules are implemented)

- **Quick**: architecture check + narrow function tests on touched module; typecheck if modified TS.
- **Integration**: dependent functions' contract tests + meaningful profile cases.
- **Full review**: architecture + selftests + typecheck + functional tests + documented acceptance/evidence.

`verify` becomes strict once production `src/` exists: package must define `typecheck` and `test:functional` scripts; both must run and pass. The first approved module task is responsible for selecting/pinning TS runner, adding lockfile, and updating CI install step as needed. **Do not add empty passing placeholders for required tests.**

## Reporting

Distinguish `PASS`, `FAIL`, `NOT_RUN`, `NOT_EVALUATED`, `BLOCKED_WITH_EVIDENCE`. List exact commands and scope; no claims that all three profiles work without their relevant tests. Full acceptance is a Developer decision separate from automated gates.
