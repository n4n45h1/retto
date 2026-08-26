# RETTO Engineering Rules

The project-specific skills in `.opencode/skills/retto-*` are authoritative.

## Commands

- Development: `pnpm dev`
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Unit tests: `pnpm test`
- Build: `pnpm build`
- End-to-end tests: `pnpm e2e`

## Boundaries

- `src/game/` is pure TypeScript and must not import React, browser storage, Cloudflare, database, or AI provider code.
- Only the Rules Engine validates and applies world-state changes.
- Simulation code must not use `Math.random()`, wall-clock time, rendering cadence, or incidental iteration order.
- Cross-system changes commit through an atomic `StateTransaction`.
- Keep `Polity`, `Government`, and `Region` as separate identities.
- Replay stores non-derived external inputs, not scheduler-generated tick advancement.
