# Agents — platform (`server/`)

`server/` is the shared platform: the tech stack, infra, CI and tooling that every team's game builds on. It is owned by the **platform team** (label `platform`). The repo-wide workflow in [`../AGENTS.md`](../AGENTS.md) applies here too; this file adds the platform rules.

## What lives here

| Package | Path | What it is |
|---|---|---|
| `@sdm/core` | `server/core/` | Contract types (`shared`), plus the server-side and client-side core used by every game |
| `@sdm/host` | `server/host/` | `startGameServer()`: the Colyseus + Express host with `/health` and static client hosting |
| `@sdm/template` | `server/template/` | Reference game. Teams copy it to `games/team-N/` to start |
| `@sdm/tooling` | `server/tooling/` | Shared TypeScript config (`tsconfig.base.json`) |

Docs for the platform live in `server/ARCHITECTURE.md` and `server/docs/`.

## Rules for teams

- Your game lives in `games/team-N/` and is its own package (`@team-N/game`). Import the platform only through package names: `@sdm/core/shared`, `@sdm/core/server`, `@sdm/core/client`, `@sdm/host`.
- Never import from another team's folder, and never import platform files by relative path (`../../server/...`).
- Need a platform change? Open an issue with the `platform` label that says what your team needs and why. Don't patch `server/` from a team PR.

## Rules for platform changes

- A platform change can break every game, so keep platform PRs small and focused.
- Changes to `server/core/src/shared/` (the contract) are breaking by default. Say in the PR which games are affected and how they migrate.
- `pnpm typecheck` and `pnpm test` run for every workspace package, so a platform PR is only green when every team's game still builds.
- Don't add a dependency to a platform package unless every game benefits. Game-specific dependencies belong in `games/team-N/package.json`.

## Determinism rules (all game code)

Replays only work if the simulation is deterministic:

- Use the room's `SeededRandom` (`@sdm/core/shared`). Never `Math.random()` in simulation code.
- Advance the simulation only in fixed ticks. Never read wall-clock time (`Date.now()`, `performance.now()`) inside the simulation.
- Validate every client message with a zod schema before using it.
- Keep tuning values in `config/*.json`, validated by the game's config schema, so designers change numbers without touching code.

## Commands (repo root)

| Command | What it does |
|---|---|
| `pnpm install` | Install everything (Node 22, pnpm 10) |
| `pnpm dev` | Run the template game: server on :2567, client on :5173 |
| `pnpm --filter @team-N/game dev` | Run your team's game |
| `pnpm lint` / `pnpm format` | Biome check / fix (Markdown is excluded) |
| `pnpm typecheck` | TypeScript across every package |
| `pnpm test` | Vitest across every package |
| `pnpm build` | Build every game's client |

Run `pnpm lint && pnpm typecheck && pnpm test` before opening a PR.

## CI

Every pull request and every push to `main` runs the **CI** check (`.github/workflows/ci.yml`): `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`, the same commands as above. A red check means the PR is not ready for review.

- It covers every package in the workspace, so a platform PR only passes when every team's game still builds.
- `--frozen-lockfile` fails when `pnpm-lock.yaml` is out of date: run `pnpm install` and commit the lockfile.
- Actions are pinned to commit SHAs. Update them through a platform PR.
