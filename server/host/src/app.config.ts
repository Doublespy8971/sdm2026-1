/**
 * Colyseus + Express host shared by every game. A team's game calls `startGameServer()` from
 * its own server.ts, so all games get the same /health, logging and static hosting.
 * Owner: platform team.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import config from "@colyseus/tools";
import { type HealthResponse, Routes } from "@sdm/core/shared";
import type { Room } from "colyseus";
import express from "express";
import { APP_ENV, GIT_SHA, STARTED_AT } from "./env.ts";

// biome-ignore lint/suspicious/noExplicitAny: Room subclasses take arbitrary constructor generics.
export type RoomClass = new (...args: any[]) => Room<any>;

export interface GameServerOptions {
  /** Game id, e.g. "team-2". Reported by /health. */
  gameId: string;
  /** Room name → Room class. Clients join with `client.joinOrCreate(name)`. */
  rooms?: Record<string, RoomClass>;
  /** Folder with the built client (vite build output). Served at the site root when it exists. */
  clientDist?: string;
}

export function createGameServer(options: GameServerOptions): ReturnType<typeof config> {
  const { gameId, rooms = {}, clientDist } = options;

  return config({
    initializeGameServer: (gameServer) => {
      for (const [name, roomClass] of Object.entries(rooms)) {
        gameServer.define(name, roomClass);
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
