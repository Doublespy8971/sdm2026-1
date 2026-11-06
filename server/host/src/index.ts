import { listen } from "@colyseus/tools";
import { createGameServer, type GameServerOptions } from "./app.config.ts";
import { PORT } from "./env.ts";

export { createGameServer, type GameServerOptions, type RoomClass } from "./app.config.ts";
export { APP_ENV, GIT_SHA, PORT } from "./env.ts";

/** Start the shared game server on $PORT (default 2567). */
export function startGameServer(options: GameServerOptions): ReturnType<typeof listen> {
  return listen(createGameServer(options), PORT);
}
