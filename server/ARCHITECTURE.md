# Architecture

Every team builds its own real-time multiplayer browser game in `games/team-N/`. All games share one platform in `server/`: the same server host, netcode contract, tooling and CI.

```
repo root            pnpm workspace (package.json, pnpm-workspace.yaml, biome.json, vitest.config.ts)
├─ games/team-N/     one package per team: client/, room/, shared/, config/, server.ts
└─ server/           platform (owned by the platform team)
   ├─ core/          @sdm/core   shared contract + server and client core
   ├─ host/          @sdm/host   Colyseus + Express host
   ├─ template/      @sdm/template  reference game that teams copy
   └─ tooling/       @sdm/tooling   shared TypeScript config
```

## Runtime

Each game deploys as **one service**: its `server.ts` calls `startGameServer()`, which runs Colyseus (game rooms over WebSocket) and Express (HTTP) on one port, and serves the game's built client from the same origin. The client therefore connects to `location.origin` in deployed environments, with no CORS or per-environment URLs. In local dev the client runs on Vite (:5173) and connects to the server on :2567.

The server is authoritative: clients send inputs, never state. Rooms advance in fixed ticks, use a seeded random generator, and record inputs so any room can be replayed exactly (format: `ReplaySchema` in `@sdm/core/shared`).

## The contract (`server/core/src/shared`)

| Module | Defines |
|---|---|
| `env.ts` | `AppEnv` (`local`, `development`, `staging`, `production`), `HealthResponse`, `isDebugEnabled()` |
| `messages.ts` | WebSocket message names, HTTP routes, input envelope, debug commands, bug reports |
| `replay.ts` | Replay file format |
| `random.ts` | `SeededRandom` |

Each game adds its own contract in `games/team-N/shared/`: Colyseus state schema, input schema and config schema (see `server/template/shared/index.ts`).

## Environments

| Environment | Deploys | Where |
|---|---|---|
| PR | Every push to an open PR that touches the game or the platform | Railway PR environment |
| development | Every merge to `main` that touches the game or the platform | Railway |
| staging | A chosen commit, via the Promote workflow | Railway |
| production | A chosen commit from staging, via the Promote workflow, with approval | Railway |

Each team has its own Railway project. Watch paths (`games/team-N/**`, `server/**`, `pnpm-lock.yaml`) keep other teams' merges from redeploying your game.
