import { z } from "zod";

/**
 * Replay format: everything needed to re-run a room and get the same result.
 * The server records it; `qa:replay` and `/repro` read it.
 *
 * Determinism rules that make replays work:
 * - Game code uses the room's SeededRandom, never Math.random().
 * - The simulation advances only in fixed ticks; inputs are applied on the tick they're recorded for.
 * - Config is identified by `configVersion`; a replay runs against the same config.
 */
export const REPLAY_VERSION = 1;

const tick = z.number().int().nonnegative();
const playerId = z.string().min(1);

export const ReplayEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("join"),
    tick,
    playerId,
    options: z.record(z.string(), z.unknown()).default({}),
  }),
  z.object({ type: z.literal("leave"), tick, playerId }),
  z.object({
    type: z.literal("input"),
    tick,
    playerId,
    seq: z.number().int().nonnegative(),
    data: z.unknown(),
  }),
  z.object({
    type: z.literal("debug"),
    tick,
    playerId,
    command: z.string(),
    args: z.array(z.string()),
  }),
]);
export type ReplayEvent = z.infer<typeof ReplayEventSchema>;

export const ReplaySchema = z.object({
  version: z.literal(REPLAY_VERSION),
  game: z.string(),
  roomId: z.string(),
  seed: z.number().int(),
  tickRate: z.number().positive(),
  configVersion: z.string(),
  sha: z.string(),
  scenario: z.string().nullable(),
  startedAt: z.string(),
  /** Events in the order they were applied. */
  events: z.array(ReplayEventSchema),
  /** Tick and state hash when the replay was saved, so a re-run can assert it matches. */
  final: z.object({ tick, stateHash: z.string() }).nullable(),
});
export type Replay = z.infer<typeof ReplaySchema>;
