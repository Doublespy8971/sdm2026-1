# sdm2026-1

Hackathon repository: each team builds a multiplayer browser game on a shared stack.

| Part | Technology | Where |
|------|------------|-------|
| Game frontends | **Vite + TypeScript** | `games/team-N/` |
| Multiplayer server | Colyseus 0.18 on Node.js | `server/` |
| Hosting | Railway | see [server/ARCHITECTURE.md](server/ARCHITECTURE.md) |

## Branches

`main` is the cutting edge and `prod` is the release: work branches (`team-N/<issue>-…`) are merged into `main`, and `main` is merged into `prod` to release. The details are in [AGENTS.md](AGENTS.md#branches).

## Read next

- [course/README.md](course/README.md): how the hackathon runs and how work is evaluated
- [AGENTS.md](AGENTS.md): the workflow every agent and person follows
- [server/AGENTS.md](server/AGENTS.md): how a game uses the shared platform
