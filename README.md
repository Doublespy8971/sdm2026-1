# sdm2026-1

Hackathon repository: each team builds a multiplayer browser game on a shared stack.

| Part | Technology | Where |
|------|------------|-------|
| Game frontends | **Vite + TypeScript** | `games/team-N/` |
| Multiplayer server | Colyseus 0.18 on Node.js | `server/` |
| Hosting | Railway | see [server/ARCHITECTURE.md](server/ARCHITECTURE.md) |

Branches: `team-N/<issue>-…` → `feature/team-N` → `dev` → `prod`.

## Read next

- [course/README.md](course/README.md): how the hackathon runs and how work is evaluated
- [AGENTS.md](AGENTS.md): the workflow every agent and person follows, including the branch model
- [server/AGENTS.md](server/AGENTS.md): how a game uses the shared platform
