---
name: retto-review
description: Reviews RETTO changes for state corruption, determinism regressions, AI authority or secret leaks, replay and migration failures, unsafe Worker boundaries, and oversized cross-system code. Use for RETTO PR review, pre-merge review, or architecture-risk assessment.
---

# RETTO Review

Review for behavioral defects and corrupted world history before style. Report findings in severity order with file and line references, concrete failure scenarios, and the missing or failing verification.

## Review Order

1. State integrity and legal transitions
2. Determinism, event order, save/load, and replay
3. AI authority, stale decisions, hallucinations, and secret isolation
4. Cross-system architecture and dependency direction
5. D1/R2 migrations, compatibility, and traceability
6. Worker/API security and resource abuse
7. Game balance regressions and missing Observer evidence
8. Maintainability, oversized files, and insufficient tests

## State Integrity

Look for:

- mutation that bypasses Rules Engine validation or explicit `StateChange`
- cross-system transitions not represented as one `StateTransaction`
- transactions that mutate before every component and invariant is validated, or that can partially commit changes/events
- dangling polity, government, region, war, treaty, faction, or event IDs
- ownership/control, capital, occupation, government, or war-participant contradictions
- display names used as identity or persistence keys
- election, coup, revolution, civil-war, surrender, or annexation paths that erase required history
- invalid numeric states such as `NaN`, infinities, impossible negatives, or unbounded percentage values
- events whose stated cause does not match the applied rule

Treat any route by which prose, UI state, or a provider response changes world facts directly as a blocking defect.

## Determinism and Replay

Check for:

- `Math.random()`, wall-clock time, unstable sorting, unordered iteration, or rendering cadence affecting outcomes
- one mutable sequential RNG shared across systems, or namespace keys based on display names/array positions
- a random draw added in one system perturbing unrelated systems, actors, battles, or later ticks
- implicit tick-order changes
- speed modes changing formulas rather than scheduling
- replay or load paths that call an AI provider again
- missing persistence of commands, accepted external decisions, state versions, RNG namespaces/counters, event order, or transaction boundaries
- missing or conflated `saveSchemaVersion` and `rulesetVersion`
- replay silently using current formulas when its recorded ruleset differs
- snapshot replay differing from uninterrupted execution
- old saves becoming unreadable without an explicit migration decision

Require deterministic tests for changed simulation behavior and save/load or replay tests for persistence-sensitive changes.

## AI Boundary and Secrets

Check for:

- model output applied before strict schema and legality validation
- missing `stateVersion` or stale-response handling
- stale responses rejected solely because unrelated global state changed, or rebased without declared dependency/precondition checks
- prompts containing undiscovered treaties, hidden intentions, agents, red lines, or privileged state from another actor
- one omniscient context reused for several actors
- unknown IDs, fabricated resources, or nonexistent history accepted from a model
- retries with no bound, no budget, or no trace
- browser-side model calls or exposed provider credentials
- narrative text treated as authoritative history instead of generated from events
- provider failure that freezes ticks or leaves partial state mutation

Require tests for hallucination resistance, structured output, stale decisions, treaty memory, and secret handling when those paths change.

## Architecture Boundaries

Flag:

- game rules in React components, route handlers, or AI providers
- Cloudflare, D1/R2, React, or provider SDK dependencies inside the domain core
- direct persistence access spread through game systems
- cycles between economy, politics, diplomacy, military, peace, and rebellion
- broad shared state bags or orchestration God Objects
- unrelated system rewrites in one feature slice
- files growing into orchestration God Objects; roughly 500 lines is a warning to inspect cohesion, not an automatic defect

Use Graft `callers` and `blast` when available to verify the actual impact rather than trusting the changed-file list.

## Persistence and Worker Safety

Check for:

- schema edits without migrations
- migrations that lose event order, history, secrets, or replay references
- D1 or in-memory transaction boundaries that permit partial state or event commits
- R2 blobs referenced before durable metadata exists or orphaned after failure
- missing authorization, input limits, rate limits, or Zod validation on Worker endpoints
- logs or errors exposing secrets, full privileged contexts, credentials, or sensitive AI traces
- unbounded request bodies, model context, event queries, or replay payloads

## Gameplay Regression

Review whether the change undermines RETTO's product invariants:

- all 47 polities act outside the player viewport
- base simulation still runs without AI
- outcomes arise from causes rather than arbitrary random events
- expansion incurs governance, logistics, occupation, and unrest costs
- defeat can flow into government change, civil war, exile, or restoration rather than accidental immediate game over
- diplomacy retains trust, promises, secrecy, and memory instead of collapsing to one score
- peace conferences may compromise, deadlock, or resume war
- the event history can answer why a major change occurred

For broad balance changes, request seeded Observer runs and compare survival, wars, revolutions, unification, game duration, economic collapse, and peace deadlock metrics.

## Verification Expectations

The repository target checks are:

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

For UI changes, also require Playwright or a documented manual browser check. Do not accept a passing build as evidence for deterministic rules, replay, secret isolation, migrations, or long-run balance.

## Review Output

- Findings come first and are ordered by severity.
- Each finding states the broken invariant, realistic impact, and exact location.
- Distinguish confirmed bugs from open questions.
- If there are no findings, say so and state residual test or balance risks.
- Keep summaries secondary; do not bury blocking state or secrecy defects in general commentary.
