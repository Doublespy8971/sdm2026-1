# sdm2026-1

Hackathon repository: each team builds a multiplayer browser game on a shared stack.

| Part | Technology | Where |
|------|------------|-------|
| Game frontends | **Vite + TypeScript** | `games/team-N/` |
| Multiplayer server | Colyseus 0.18 on Node.js | `server/` |
| Hosting | Railway | see [server/ARCHITECTURE.md](server/ARCHITECTURE.md) |

## Branches

`team-N/<issue>-…` → `feature/team-N` → `main` → `prod`. Each team merges its work into its own `feature/team-N` branch, finished work goes into `main` (the cutting edge) once CI is green, and `main` is merged into `prod` to release. The details are in [AGENTS.md](AGENTS.md#branches).

## Read next

- [course/README.md](course/README.md): how the hackathon runs and how work is evaluated
- [AGENTS.md](AGENTS.md): the workflow every agent and person follows, including the branch model
- [server/AGENTS.md](server/AGENTS.md): how a game uses the shared platform
