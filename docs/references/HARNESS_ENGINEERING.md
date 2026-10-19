# Reference — OpenAI Harness Engineering

Source: https://openai.com/index/harness-engineering/ (Ryan Lopopolo, 2026-02-11).

Relevant principles translated for this repository:

- **Humans steer / agents execute:** developer owns task and architecture approval; agent executes and reports evidence.
- **Give agents a map:** short AGENTS.md, versioned repository documents, progressive discovery.
- **Enforce invariants, not implementation preference:** static import/dependency guards, ownership/contract tests. Local coding choices remain flexible.
- **Legible feedback loop:** runnable tests, clear failure modes, test outcomes and reproduction; no full game required for a library.
- **Entropy control:** failures -> focused regression tests/guardrails, not doc bloat or indiscriminate testing.

Adaptation, not a copy of OpenAI's internal stack: this repo needs **headless function verification**, not browser/UI testing, monitoring stacks, multi-agent orchestration or autonomous merge tools.

See `docs/HARNESS_CAPABILITIES.md` for H01–H16 scope/status.
