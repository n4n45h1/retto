---
name: retto-simulation
description: Preserves RETTO's deterministic world simulation, seeded RNG, tick ordering, event causality, and replayability. Use when changing ticks, time controls, economy, politics, diplomacy, war, events, Observer mode, save/load, or state transitions.
---

# RETTO Simulation

Build a continuously running world that remains deterministic, explainable, and testable. LLM calls are event-driven additions, never the simulation clock.

## Non-Negotiable Invariants

- The same initial state, seed, commands, and validated external decisions must produce the same state changes and events.
- All randomness comes from deterministic named streams or counter-based RNG derived from the world seed. Do not call `Math.random()`, use wall-clock time, or depend on unordered iteration.
- Tick execution order is defined, stable, and tested. A refactor must not silently reorder systems.
- Prefer pure functions from state plus inputs to explicit state changes and events.
- Every applied change carries enough source information to explain why it happened.
- All 47 starting polities continue simulating outside the player's viewport.
- Pause stops simulation advancement. Speed changes scheduling, not rules or outcomes.

## Randomness Isolation

Adding a random draw in one system must not silently perturb unrelated systems or all future ticks. Do not share one mutable sequential RNG across economy, politics, combat, events, or polities.

Derive stable streams or counter keys from semantic identifiers, for example:

```text
economy:{tick}:{polityId}
politics:{tick}:{polityId}
combat:{battleId}:{phase}
event:{eventCandidateId}
```

- Use an API conceptually equivalent to `rng.for("politics", tick, polityId)` or a counter-based draw with the same stable namespace.
- Include enough identity to avoid accidental collisions, but never use display names or array positions.
- Keep draw order stable within a stream where multiple draws are required; use named counters for independently evolving choices.
- Changing a namespace or draw contract is a ruleset change and requires a new `rulesetVersion`.
- Tests must prove that adding a draw to one namespace does not alter results in unrelated namespaces.

## Tick Pipeline

Use this conceptual sequence unless an approved design documents a more specific order:

```text
commands
  -> deterministic system updates
  -> metrics, pressure, and goals
  -> trigger candidates
  -> importance routing
  -> rules-only or external AI decision request
  -> schema and legality validation
  -> StateTransaction validation and atomic commit
  -> GameEvent and causal links
  -> persistence/replay records
```

- Base economy, population, food, logistics, politics, diplomacy, war, and unrest on rules that run without AI.
- Trigger events from accumulated pressures, thresholds, and seeded probability, not arbitrary fixed timers.
- The World Director may strengthen an existing cause when the world is too quiet; it must not invent causeless wars, revolutions, money, technology, or population.
- Every Director choice uses its own seeded namespace, identifies an existing rule-derived cause, and emits a normal proposed transaction plus a causal event such as `DirectorAdjustment`. It never mutates pressure or state through a privileged side channel.
- Snowball control must emerge from governance, logistics, occupation, unrest, food, infrastructure, and political costs rather than hard GDP or population caps.

## External Decisions

AI responses are nondeterministic external inputs. Convert them into replayable validated decisions before applying them.

- Attach `stateVersion` and a declared dependency/precondition set such as relevant actor, target, war, regions, treaty versions, and resource facts to every request.
- A stale version must never be applied blindly, but global version mismatch alone is not enough to reject it.
- When stale, compare the declared dependencies with current state. If relevant facts are unchanged, revalidate and rebase the decision against current state; otherwise discard it or request reevaluation.
- Validate shape, actor authority, resource availability, visibility, legality, and current preconditions.
- Persist the accepted parsed decision, original and applied state versions, dependency check, rebase result, and resulting transaction so replay does not call the model again.
- A failed, malformed, or unavailable AI call must not corrupt or freeze the base simulation. Use a defined rules-only fallback or leave the candidate unapplied.

## Events and Explanation

- Events need stable IDs, turn/time, actors, effects, visibility, importance, and causal references.
- Preserve cause chains such as `war exhaustion -> tax increase -> approval loss -> military defection -> government collapse`.
- The `Explain` UI derives facts from rules and events; an LLM may phrase the explanation but may not invent causes.
- Annual newspapers and end-of-game histories summarize stored events. They are not the historical source of truth.
- Important events may auto-slow or pause presentation without changing simulation results.

## Save, Replay, and Observer

- Save current state plus ordered changes/events and periodic snapshots.
- Persist `saveSchemaVersion`, `rulesetVersion`, and world seed in save, snapshot, and replay metadata. Never infer ruleset compatibility from schema version.
- Replay from a snapshot using recorded commands and accepted external decisions.
- Replay must use the recorded ruleset contract. If that ruleset is unavailable, report incompatibility or run an explicit replay migration; never silently use current formulas.
- Never use a fresh AI call during replay.
- Observer simulations must support accelerated headless execution and collect balance metrics such as survival, unification, wars, revolutions, game duration, GDP collapse, and peace-conference failure.
- Keep simulation logic independent from rendering frame rate and browser focus.

## Testing

For every simulation rule or bug fix, include the smallest relevant checks:

- Same seed and inputs produce identical states and event order.
- A draw added to one RNG namespace does not perturb unrelated systems, actors, battles, or event candidates.
- Different seeds can diverge while remaining legal.
- Save/load continuation matches uninterrupted execution.
- Snapshot plus replay matches the source state.
- Stale decisions with unchanged dependencies can rebase after full validation; changed or undeclared dependencies produce no state change.
- A failed multi-system transaction applies no component changes or events.
- Save and replay metadata preserve and enforce `rulesetVersion` independently from `saveSchemaVersion`.
- Threshold behavior is tested immediately below, at, and above boundaries.
- Long accelerated runs preserve invariants and do not produce `NaN`, negative impossible resources, dangling references, or ownership/control contradictions.

## Reject These Designs

- `Math.random()` or timestamps inside domain decisions
- One shared sequential RNG whose draw count couples unrelated systems
- LLM calls on every tick or for every polity
- Event generation without a rule-derived cause
- World Director mutation through a non-rules side channel
- Replay that contacts AI providers
- State mutation before validation completes
- Partial application of a multi-system transaction
- Speed settings that alter economic or combat formulas
- Array or object iteration whose incidental order changes outcomes

## Verification

- [ ] RNG namespaces, ordering, and time inputs are explicit, isolated, and deterministic
- [ ] Every change is legal, causal, and replayable
- [ ] Multi-system changes commit atomically or not at all
- [ ] Base simulation runs with AI disabled
- [ ] Save/load and replay equivalence are tested
- [ ] Save and replay metadata record the exact ruleset version
- [ ] Observer mode can run faster than UI time without changing rules
- [ ] Relevant typecheck, unit, integration, and build commands pass
