/**
 * Template game client. Placeholder: checks the server's /health and shows the result.
 * Teams replace this with their own lobby and renderer; the debug overlay comes from @sdm/core/client.
 */
import { HealthResponseSchema, Routes } from "@sdm/core/shared";
import { GAME_ID } from "../shared/index.ts";

/** In local dev the server runs on :2567; deployed builds are served by the server itself. */
export const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL ?? (import.meta.env.DEV ? "http://localhost:2567" : location.origin);

const app = document.getElementById("app");

async function main(): Promise<void> {
  if (!app) return;
  try {
    const res = await fetch(`${SERVER_URL}${Routes.health}`);
    const health = HealthResponseSchema.parse(await res.json());
    app.innerHTML = `<div class="ok">Server OK</div>
      <div>game: ${GAME_ID}</div>
      <div>env: ${health.env}</div>
      <div>sha: ${health.sha}</div>
      <div>games: ${health.games.join(", ")}</div>`;
  } catch (err) {
    app.innerHTML = `<div class="bad">Can't reach the server at ${SERVER_URL}</div><div>${String(err)}</div>`;
  }
}

void main();
