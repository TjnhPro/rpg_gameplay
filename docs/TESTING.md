# MVP function testing

Use Node's built-in `node:test` and `node:assert/strict`. Tests in `tests/unit/*.test.mjs`
import the public built root `dist/index.js`; build before running them.

```sh
npm run build
npm run test:functional
node --test tests/unit/item.test.mjs
```

Each test demonstrates an observable public contract with explicit inputs and an
independent literal expected result. Preserve a useful positive and a material
failure/edge case. Inject time/RNG where used; no hidden wall clock, network or
randomness. Prefer a small direct test over a shared test framework, quotas or
malformed-input permutations. Numerical results belong to the pinned Core Kernel,
not a test-local replacement calculator. Authoritative state commits belong to callers.

Coverage includes Foundation, Entity, Progression, Combat, Skill, Effect, Actor AI,
Encounter and Item; see the [coverage map](reports/harness-simplification-mvp.md).
Approved additive APIs need focused behavior tests, not updates to historical source
hashes, export counts or inventories. Do not change expectations merely to hide a bug.

## Deliberate limits

Daily tests do not pack/install tarballs, validate external installed NodeNext consumers,
run L4 Dungeon/Wave scenarios, mutate production, preserve historical source hashes,
or cover every historical negative case. Repo strict NodeNext checking remains mandatory.
Windows/Node24 and package installation checks are manual or release-time work when
needed; a green Ubuntu/Node22 job does not prove their equivalence. No game/profile,
balance, distributed commit or future-module assurance is implied.

Old phase reports/tasks record historical evidence, not current executable requirements.
Do not recreate the removed mutation/consumer matrix under a new name.
