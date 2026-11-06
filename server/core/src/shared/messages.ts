import { z } from "zod";
import { AppEnvSchema } from "./env.ts";

/** WebSocket message types sent from client to server. */
export const ClientMessage = {
  /** Player input for one fixed tick. `data` is validated by the game's own input schema. */
  Input: "input",
  /** Debug console command. Rejected in production. */
  DebugCommand: "debug:command",
} as const;

/** WebSocket message types sent from server to client. */
export const ServerMessage = {
  /** Reply to a debug command. */
  DebugResult: "debug:result",
  /** Short text shown to players (e.g. "Room is full", "Server restarting"). */
  Notice: "notice",
} as const;

/** HTTP routes served next to the game. */
export const Routes = {
  health: "/health",
  bugReport: "/api/bug-report",
  replay: (roomId: string) => `/api/replays/${encodeURIComponent(roomId)}`,
} as const;

/**
 * Envelope for every input message. `seq` increases by one per input from a client, so
 * the server can ack and the client can reconcile predictions.
 */
export const InputEnvelopeSchema = z.object({
  seq: z.number().int().nonnegative(),
  data: z.unknown(),
});
export type InputEnvelope = z.infer<typeof InputEnvelopeSchema>;

export const DebugCommandSchema = z.object({
  /** Client-chosen id so the reply can be matched to the command. */
  id: z.string().min(1).max(64),
  /** Command name without the slash, e.g. "spawn", "tp", "set", "pause", "step", "seed", "kick". */
  command: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-z][a-z0-9:-]*$/),
  args: z.array(z.string().max(200)).max(16).default([]),
});
export type DebugCommand = z.infer<typeof DebugCommandSchema>;

export const DebugResultSchema = z.object({
  id: z.string(),
  ok: z.boolean(),
  output: z.string(),
});
export type DebugResult = z.infer<typeof DebugResultSchema>;

export const NoticeSchema = z.object({
  level: z.enum(["info", "warn", "error"]),
  text: z.string(),
});
export type Notice = z.infer<typeof NoticeSchema>;

/** Simulated network conditions active on the reporting client. */
export const NetConditionsSchema = z.object({
  latencyMs: z.number().nonnegative(),
  jitterMs: z.number().nonnegative(),
  lossPct: z.number().min(0).max(100),
});
export type NetConditions = z.infer<typeof NetConditionsSchema>;

/** Body of `POST /api/bug-report`, sent by the in-game Report bug button (F8). */
export const BugReportSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).default(""),
  game: z.string(),
  env: AppEnvSchema,
  sha: z.string(),
  roomId: z.string().nullable(),
  playerId: z.string().nullable(),
  tick: z.number().int().nonnegative().nullable(),
  scenario: z.string().nullable(),
  url: z.string(),
  userAgent: z.string(),
  net: NetConditionsSchema.nullable(),
  /** Most recent client log lines, oldest first. */
  logs: z.array(z.string()).max(500),
  /** PNG data URL of the game canvas. */
  screenshot: z.string().startsWith("data:image/").nullable(),
});
export type BugReport = z.infer<typeof BugReportSchema>;
