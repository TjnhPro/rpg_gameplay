# Harness Features H01–H16 — scope vs. implementation

**Important:** A feature listed here is NOT proof of gameplay implementation.
v0.1.0 adds real package/Kernel integration contracts and strict build tooling;
gameplay functional coverage remains absent until approved gameplay tasks.

| ID | Harness capability | Foundation status |
| --- | --- | --- |
| H01 | Agent Onboarding & Routing | Implemented: concise `AGENTS.md` map |
| H02 | Repository Knowledge Base | Implemented: scoped docs, accepted decisions |
| H03 | Architecture Boundary Guard | Partial automation: check static imports and paths |
| H04 | Module Ownership & Dependency Registry | Implemented: initially empty `harness/modules.json` |
| H05 | RPG Core Integration Guard | Partial automation: forbid Core root/Legacy/internal imports |
| H06 | Canonical Implementation Guard | Governance/manual review; no fake algorithmic duplicate detector |
| H07 | Module Isolation & Optionality Guard | Partial automation: imports, explicit deps; runtime enable/disable future work |
| H08 | Capability Gap & Change Control | Policy + escalation/STOP workflow |
| H09 | Three-Profile Functional Verification | Defined contract: Text/2D/2.5D functional scenarios, not apps; no scenarios yet |
| H10 | Deterministic Functional Test Harness | Design policy: injected RNG/clock; harness checks obvious violations; no simulator/app |
| H11 | Contract & Integration Test Harness | Installed package/Kernel contracts and orchestration controls; no gameplay tests yet |
| H12 | Verification Gates & CI | Boundaries + build + typecheck + functional contracts; Windows/Linux, Node 22/24 |
| H13 | Agent Task Execution Protocol | Implemented: approved-plan-first docs and task template |
| H14 | Approval & Evidence Gates | Policy/report templates; Developer acceptance manual |
| H15 | Architecture Drift & Quality Audit | P1 after real module experience |
| H16 | Feature Promotion & Reuse Evaluation | P1 formal automation; policy already documented |

## Honest coverage

Static regex import guard catches conventional literal import/export and some obvious dynamic imports; it is **not** a full TypeScript AST security analyzer. Refine via compiler API once TypeScript is installed in an approved module task. Some invariants are semantic/manual, particularly no duplicate implementation and meaningfully proven reuse.

`npm run verify` proves v0.1.0 package infrastructure; gameplay profiles remain
NOT_EVALUATED. It does not prove the framework's future gameplay capabilities.
