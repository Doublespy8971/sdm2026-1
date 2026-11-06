/**
 * Colyseus + Express host shared by every game. A team's game calls `startGameServer()` from
 * its own server.ts, so all games get the same /health, logging and static hosting.
 * Owner: platform team.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import config from "@colyseus/tools";
import { type HealthResponse, Routes } from "@sdm/core/shared";
import express from "express";
import { APP_ENV, GIT_SHA, STARTED_AT } from "./env.ts";
import { type GameRoomDeps, LiveRoomRegistry, type RoomClass } from "./gameRoom.ts";
import { createLogger, type Logger } from "./logger.ts";
import { MemoryStores } from "./stores.ts";

export type { RoomClass } from "./gameRoom.ts";

/** Builds a game's Room class from the shared deps, e.g. `(deps) => createGameRoom(myGame, deps)`. */
export type RoomFactory = (deps: GameRoomDeps) => RoomClass;

const MB = 1024 * 1024;

export interface GameServerOptions {
  /** Game id, e.g. "team-2". Reported by /health. */
  gameId: string;
  /** Room name → room factory. Clients join with `client.joinOrCreate(name)` or by code. */
  rooms?: Record<string, RoomFactory>;
  /** Folder with the built client (vite build output). Served at the site root when it exists. */
  clientDist?: string;
}

/** Shared per-process services: logger, stores and the live room registry. */
export interface GameServerContext {
  logger: Logger;
  stores: MemoryStores;
  registry: LiveRoomRegistry;
  deps: GameRoomDeps;
}

export function createGameServerContext(
  gameId: string,
  logger: Logger = createLogger(gameId),
): GameServerContext {
  const stores = new MemoryStores({ budgetBytes: Number(process.env.MEMORY_BUDGET_MB ?? 256) * MB });
  const registry = new LiveRoomRegistry();
  return { logger, stores, registry, deps: { env: APP_ENV, sha: GIT_SHA, stores, logger, registry } };
}

export function createGameServer(
  options: GameServerOptions,
  context: GameServerContext = createGameServerContext(options.gameId),
): ReturnType<typeof config> {
  const { gameId, rooms = {}, clientDist } = options;

  return config({
    initializeGameServer: (gameServer) => {
      for (const [name, factory] of Object.entries(rooms)) {
        gameServer.define(name, factory(context.deps));
      }
    },

    initializeExpress: (app) => {
      // Local dev only: the Vite dev server runs on another port.
      if (APP_ENV === "local") {
        app.use((_req, res, next) => {
          res.setHeader("Access-Control-Allow-Origin", "*");
          next();
        });
      }

      app.get(Routes.health, (_req, res) => {
        const body: HealthResponse = {
          ok: true,
          env: APP_ENV,
          sha: GIT_SHA,
          startedAt: STARTED_AT,
          games: [gameId],
        };
        res.json(body);
      });

      if (clientDist && existsSync(clientDist)) {
        app.use(express.static(clientDist));
        // Single-page app fallback for every path that isn't the API or health check.
        app.get(/^\/(?!api\/|health$).*/, (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
      }
    },
  });
}
