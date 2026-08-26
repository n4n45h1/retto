---
name: retto-architecture
description: Enforces RETTO's domain boundaries and dependency direction. Use when designing or changing GameState, game systems, Worker APIs, persistence, UI integration, domain types, or cross-system architecture in RETTO.
---

# RETTO Architecture

This skill is the canonical source for RETTO's architecture invariants. Do not replace them with generic application patterns or infer domain contracts from the human-oriented DOCX alone.

## Authority and Dependency Direction

The TypeScript Rules Engine is the only authority for facts, legality, calculations, probabilities, and state mutation.

```text
UI -> Worker API -> application orchestration -> game systems -> domain core
                         |                         |
                         v                         v
                    AI adapters               explicit StateChange
                         |                         |
                         v                         v
                    providers                  persistence
```

- Keep `src/game/` independent of React, Cloudflare request objects, D1/R2 clients, and AI provider SDKs.
- Keep `src/ai/providers/` free of game rules. Providers transport requests and responses only.
- Keep rules out of `src/app/`, `src/components/`, and `src/map/`. UI renders visible state and submits commands.
- Access D1 and R2 through persistence boundaries. Domain systems must not issue storage queries directly.
- Prefer pure domain functions that return explicit `StateChange` and `GameEvent` values over in-place mutation.
- Dependencies between game systems must be explicit and acyclic. Do not create a shared God Object to coordinate systems.

## Domain Glossary

Use these names consistently. Do not create near-duplicate types with overlapping meanings.

| Term | Meaning |
|---|---|
| `Command` | Intent submitted by a player, AI controller, or deterministic system. It requests evaluation but has no effect by itself. |
| `Decision` | Structured choice proposed by an external reasoning source. It remains inert until current-state validation succeeds. |
| `TriggerCandidate` | Rule-derived opportunity for an event or decision, with its cause and importance. |
| `StateChange` | Machine-authoritative description of one legal world mutation. |
| `StateTransaction` | Atomic batch of state changes and events that is either committed in full or not applied. |
| `GameEvent` | Immutable historical record of what happened, why, and with what visibility. |
| `GameState` | Authoritative current world state at a specific version. |
| `Polity` | Political and diplomatic actor that owns or controls regions. |
| `Government` | Current governing regime of a polity; it can change without replacing polity identity or history. |
| `Region` | Territorial, combat, and administrative unit; not a political actor by default. |
| `Projection` | Visibility-filtered representation of GameState for one observer or actor. |

## Domain Boundaries

- Separate `State`/`Polity` from `Government`. Elections, coups, and revolutions replace governments without erasing polity history.
- Separate ownership from effective control. Occupation does not immediately transfer ownership or full economic output.
- Use `Region` as the territorial, combat, and administrative unit. A polity is the political actor; a city or hub is an important location, not another polity.
- Keep internal IDs stable and separate from generated display names. Renaming a country, government, or flag must not change references.
- Model visibility explicitly. Public, estimated, rumored, unknown, and secret facts must not collapse into one unrestricted state view.
- Represent diplomacy with distinct concepts such as trust, fear, dependency, legitimacy, grievances, promises, and treaties; do not reduce it to one relation score.
- Preserve causal history for events, governments, names, flags, treaties, wars, and territorial changes.

## System Ownership

| Concern | Owner |
|---|---|
| Legal actions, numeric effects, RNG, state mutation | Rules Engine |
| Tick scheduling and system order | Simulation |
| Decision proposals and natural-language interpretation | AI layer |
| Context filtering and secret access | AI context layer |
| Current queryable state and metadata | D1 |
| Large snapshots, complete AI traces, replay blobs | R2 |
| Presentation, overlays, interaction, visible projections | UI |

Never let an AI response, UI event, or database record mutate world state without domain validation.

## Atomic State Transactions

Cross-system transitions such as peace, surrender, civil-war splits, annexation, government replacement, and treaty bundles must be validated as a complete transaction before any component change becomes authoritative.

```ts
interface StateTransaction {
  id: TransactionId;
  source: CauseRef;
  changes: StateChange[];
  events: GameEvent[];
}
```

- Build the transaction without mutating authoritative state.
- Validate all changes, references, invariants, permissions, and event links against the same base version.
- Commit every change and event atomically only when the complete transaction is legal.
- If any component fails, apply zero components and record the rejection outside world history as diagnostic trace data.
- Persist transaction identity and ordering so save/load and replay preserve the same boundary.
- Do not expose intermediate transaction state to UI, AI context, ticks, or other systems.

## Persistence and Replay

- Use current state plus events/state changes plus periodic snapshots; do not persist a full world copy every tick.
- Make every schema change through a migration.
- Persist `saveSchemaVersion` and `rulesetVersion` separately with the world seed. Schema compatibility does not imply rule compatibility.
- Preserve enough information to rebuild from the latest snapshot and replay subsequent changes.
- Treat AI input references, raw output, parsed decisions, validation results, and applied changes as traceable records.
- Design for future timeline branching without adding speculative branching behavior before replay is reliable.

## Change Procedure

Before a cross-system change:

1. Identify the authoritative owner of each rule and datum.
2. Trace dependencies and callers; use Graft `map`, `callers`, or `blast` when the graph exists.
3. Define the command/input, validated transaction, emitted events, and visible projection.
4. Keep the slice within one system where possible; avoid rewriting several systems together.
5. Add boundary tests before wiring UI or AI expression around the rule.

## Reject These Designs

- React components calculating game outcomes
- AI providers deciding legality or directly writing state
- Tick code querying D1 for every local calculation
- A single type combining polity, government, territory, and presentation data
- Display names used as foreign keys
- Hidden intentions placed in a public API response
- Cross-system mutation with no atomic `StateTransaction`, `StateChange`, or event trail
- Files growing into orchestration God Objects; roughly 500 lines is a review warning, not an automatic failure

## Verification

- [ ] Rules Engine remains the sole state authority
- [ ] Dependency direction is acyclic and domain code is infrastructure-independent
- [ ] State/government, ownership/control, ID/display name, and public/secret data remain separate
- [ ] State transitions and causal events are explicit and replayable
- [ ] Cross-system transitions validate and commit as atomic transactions
- [ ] DB changes include migrations and replay compatibility checks
- [ ] Saves and replays record both schema and ruleset versions
- [ ] Relevant typecheck, unit, integration, and build commands pass
