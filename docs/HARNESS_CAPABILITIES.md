# Harness Features H01–H16 — scope vs. implementation

**Important:** A feature listed here is NOT proof of implementation. Foundation includes only minimal docs/guard checks. Verify functional coverage via actual runnable tests once gameplay exists.

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
| H11 | Contract & Integration Test Harness | Test quality policy and evidence template; no gameplay tests yet |
| H12 | Verification Gates & CI | Implemented: scaffold harness gate + CI; gameplay gates required when source is introduced |
| H13 | Agent Task Execution Protocol | Implemented: approved-plan-first docs and task template |
| H14 | Approval & Evidence Gates | Policy/report templates; Developer acceptance manual |
| H15 | Architecture Drift & Quality Audit | P1 after real module experience |
| H16 | Feature Promotion & Reuse Evaluation | P1 formal automation; policy already documented |

## Honest coverage

Static regex import guard catches conventional literal import/export and some obvious dynamic imports; it is **not** a full TypeScript AST security analyzer. Refine via compiler API once TypeScript is installed in an approved module task. Some invariants are semantic/manual, particularly no duplicate implementation and meaningfully proven reuse.

`npm run verify` at empty scaffold reports `GAMEPLAY_NOT_EVALUATED`; it is not allowed to claim the framework works until real function tests run.
