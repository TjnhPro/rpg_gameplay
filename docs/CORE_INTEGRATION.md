# Core Kernel integration

Only production import: `@rpg/core/kernel`. Core root, Legacy entrypoints, source
checkout paths and `dist` deep imports remain forbidden. No numerical code is
copied or implemented in L2. GF01–GF05 registry/configuration/dependency/composition functions require no
numerical calls; the accepted Core pin and package integration remain unchanged.

## Pin and reconstruction

- Source: https://github.com/TjnhPro/rpg_core
- Revision: `04b7239f998c3c688a0dfa3202f11811a9acd775`
- Installed package: `@rpg/core` 2.0.0, public `./kernel` JS + declarations.
- Pin metadata: `harness/core-pin.json`; tarball SHA-512: `package-lock.json`.
- Artifact: ignored `.artifacts/rpg-core-2.0.0.tgz`; no artifact committed.

Development and CI use npm 12.2.0 (Node 22.22.2+ or 24.15+). From a fresh clone:

```sh
npm run core:prepare
npm ci --ignore-scripts
npm run verify
```

`core:prepare` clones into a temporary directory with LF checkout, checks the
exact Git SHA/package identity/public Kernel export, installs Core's own locked
dev tools with lifecycle scripts disabled, then executes its three build stages:

1. Core's `scripts/clean.mjs`.
2. Core's installed TypeScript compiler against `tsconfig.json`, with `--newLine lf`.
3. Core's `scripts/legacy-build-paths.mjs` (part of its existing package build).

It packs with lifecycle scripts disabled, hashes the result, compares against the
committed lock integrity, and only then copies the artifact into `.artifacts/`.
No Core source or Developer checkout is changed. LF checkout/compiler output
keeps artifact bytes consistent between Windows/Linux. All subprocesses use
argument arrays and `shell:false`. Temporary directories are cleaned on failure.

The clone/build includes Core's existing Legacy package files, but L2 neither
imports nor tests Legacy behavior. Dependency and source guards enforce the only
allowed public entrypoint. This workflow does not require registry publication
or a machine-specific source path. Availability of GitHub and npm remains an
external requirement. Do not replace a missing Kernel with mocks/calculators.

## Dependency and consumer contract

The repository installs Core from the relative artifact as an exact development
dependency, pinned by lock integrity. The distributed gameplay manifest declares
an exact `@rpg/core: 2.0.0` peer. This avoids embedding a repository-local artifact
path in the consumer's runtime dependency resolution and keeps a single Core
instance shared with its caller. Private package consumption requires the caller
to supply the same built Core artifact explicitly, alongside the gameplay tarball
(see README). The peer version alone does not prove the caller's Git revision;
this repository's producer/CI workflow and artifact integrity supply that evidence.

The external consumer test installs both tarballs, executes public
`calculateResourceTransition` with independently specified expected output, and
checks strict NodeNext Kernel types. No re-export/wrapper is introduced in L2.
Any pin change is a separate approved task with new audit and integrity evidence.
