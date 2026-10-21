# MVP verification

Environment setup (once per fresh checkout or dependency/pin change):

```sh
npm run core:prepare
npm ci --ignore-scripts
```

Core preparation rebuilds the pinned artifact and checks its SHA-512 against the
unchanged lockfile. See [Core integration](CORE_INTEGRATION.md). Verification never
installs dependencies or prepares/packs Core automatically. Missing dependencies
produce the explicit setup instruction and fail.

```sh
npm run verify
```

The fail-closed runner runs exactly once, in order:

1. `harness:check`: registry, allowed imports and module ownership/dependencies.
2. `build`: compile the required production source to a clean `dist`.
3. `typecheck`: strict repository TypeScript/NodeNext checking.
4. `test:functional`: selected direct public function tests from `tests/unit`.

Missing source or a failed command exits nonzero; success is printed only after all
four steps. Subprocesses use Node with argument arrays and `shell: false`.
`prepack` remains a separate packaging lifecycle and is outside verification.

## CI and interpretation

`.github/workflows/harness.yml` runs one Ubuntu/Node22 job for PRs to `main`, plus
manual dispatch. It checks out the PR head SHA, prepares Core once with integrity
validation, installs locked dependencies, then runs verify. No Core artifact cache
is used; npm's download cache does not substitute for artifact validation.
No push trigger, Windows/Node24 matrix or duplicate required workflow remains.

Delivery evidence is local verify plus **1/1 CI success at the delivered head**.
Report the actual commands, SHA, results and untested limits. Tests are evidence;
Developer decides acceptance. See [testing limits](TESTING.md).

Past eight-job, installed-consumer, mutation and hash reports are historical only.
GitHub default branch/protection changes require separate owner authorization.
