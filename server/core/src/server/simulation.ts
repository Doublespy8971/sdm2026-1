/**
 * The deterministic core every room runs. It applies events (join, leave, drop, reconnect, input,
 * debug) to a game definition and records them, so the live room and the replay runner share one
 * code path and can't drift apart.
 * No clocks and no Colyseus here: the room measures timing around `tick()`.
 */
import {
  InputEnvelopeSchema,
  REPLAY_VERSION,
  type Replay,
  type ReplayEvent,
  SeededRandom,
} from "@sdm/core/shared";
import {
  type BaseState,
  type GameDefinition,
  type RoomSettings,
  Seat,
  type SimContext,
  type TickInput,
} from "../sim/index.ts";
import { runDebugCommand } from "./debugCommands.ts";
import { stateHash } from "./stateHash.ts";

export const DEFAULT_MAX_EVENTS = 1_000_000;

export type InputResult = "ok" | "envelope" | "schema" | "stale-seq" | "paused" | "unknown-player";
export type SimMode = "live" | "replay";

export interface SimulationOptions<C> {
  seed: number;
  roomId: string;
  sha: string;
  startedAt: string;
  mode: SimMode;
  scenario?: string | null;
  /** Overrides the definition's config; the replay runner passes the replay's embedded config. */
  config?: C;
  maxEvents?: number;
}

export class Simulation<S extends BaseState, I, C extends RoomSettings> {
  readonly def: GameDefinition<S, I, C>;
  readonly state: S;
  readonly ctx: SimContext<S, C>;
  readonly mode: SimMode;
  /** Wall-clock pacing multiplier, set by the `timescale` command. Not part of the simulation. */
  timeScale = 1;

  readonly #opts: SimulationOptions<C>;
  readonly #startConfig: C;
  readonly #events: ReplayEvent[] = [];
  readonly #maxEvents: number;
  #truncated = false;
  #pending: TickInput<I>[] = [];
  readonly #lastQueuedSeq = new Map<string, number>();
  readonly #seqReset = new Set<string>();

  constructor(def: GameDefinition<S, I, C>, opts: SimulationOptions<C>) {
    this.def = def;
    this.#opts = opts;
    this.mode = opts.mode;
    this.#maxEvents = opts.maxEvents ?? DEFAULT_MAX_EVENTS;
    const config = structuredClone(opts.config ?? def.config);
    this.#startConfig = structuredClone(config);
    this.state = def.createState();
    this.ctx = {
      state: this.state,
      rng: new SeededRandom(opts.seed),
      config,
      tick: 0,
      dt: 1 / config.tickRate,
    };
    def.init(this.ctx);
  }

  get truncated(): boolean {
    return this.#truncated;
  }

  hasSeat(playerId: string): boolean {
    return this.state.seats.has(playerId);
  }

  /** Throws when the options fail the game's join schema or the player is already seated. */
  join(playerId: string, rawOptions: unknown): void {
    if (this.hasSeat(playerId)) throw new Error(`player ${playerId} is already in the room`);
    const options = this.def.joinOptionsSchema.parse(rawOptions ?? {});
    this.state.seats.set(playerId, new Seat());
    this.#lastQueuedSeq.delete(playerId);
    this.def.join(this.ctx, playerId, options);
    this.#record({ type: "join", tick: this.state.tick, playerId, options });
  }

  leave(playerId: string): void {
    if (!this.hasSeat(playerId)) return;
    this.state.seats.delete(playerId);
    this.#pending = this.#pending.filter((input) => input.playerId !== playerId);
    this.#lastQueuedSeq.delete(playerId);
    this.#seqReset.delete(playerId);
    this.def.leave(this.ctx, playerId);
    this.#record({ type: "leave", tick: this.state.tick, playerId });
  }

  drop(playerId: string): void {
    const seat = this.state.seats.get(playerId);
    if (!seat) return;
    seat.connected = false;
    this.def.disconnect?.(this.ctx, playerId);
    this.#record({ type: "drop", tick: this.state.tick, playerId });
  }

  reconnect(playerId: string): void {
    const seat = this.state.seats.get(playerId);
    if (!seat) return;
    seat.connected = true;
    // A refreshed client starts again at seq 0, so accept its next input whatever the seq.
    this.#seqReset.add(playerId);
    this.def.reconnect?.(this.ctx, playerId);
    this.#record({ type: "reconnect", tick: this.state.tick, playerId });
  }

  /** Checks and queues one input for the next tick. Never throws. */
  queueInput(playerId: string, envelope: unknown): InputResult {
    const parsed = InputEnvelopeSchema.safeParse(envelope);
    if (!parsed.success) return "envelope";
    if (!this.hasSeat(playerId)) return "unknown-player";
    // In a replay, recorded inputs are applied even while paused (`step` advanced through them live).
    if (this.state.paused && this.mode === "live") return "paused";
    const { seq } = parsed.data;
    const reset = this.#seqReset.has(playerId);
    const last = this.#lastQueuedSeq.get(playerId);
    if (!reset && last !== undefined && seq <= last) return "stale-seq";
    const data = this.def.inputSchema.safeParse(parsed.data.data);
    if (!data.success) return "schema";
    this.#seqReset.delete(playerId);
    this.#lastQueuedSeq.set(playerId, seq);
    this.#pending.push({ playerId, seq, data: data.data });
    return "ok";
  }

  /** Advances one tick. Does nothing while paused unless `force` (the `step` command, the replay runner). */
  tick(opts: { force?: boolean } = {}): void {
    if (this.state.paused && !opts.force) return;
    const inputs = this.#pending;
    this.#pending = [];
    const tick = this.state.tick;
    const applied = new Map<string, number>();
    for (const input of inputs) {
      this.#record({ type: "input", tick, playerId: input.playerId, seq: input.seq, data: input.data });
      applied.set(input.playerId, Math.max(applied.get(input.playerId) ?? -1, input.seq));
    }
    this.ctx.tick = tick;
    this.def.step(this.ctx, inputs);
    for (const [playerId, seq] of applied) {
      const seat = this.state.seats.get(playerId);
      if (seat) seat.lastSeq = seq;
    }
    this.state.tick = tick + 1;
    this.ctx.tick = tick + 1;
  }

  /** Replaces the room's random generator. Used by the `seed` debug command. */
  reseed(seed: number): void {
    this.ctx.rng = new SeededRandom(seed);
  }

  /** Records the command, then runs it. Throws with a readable message when the command fails. */
  applyDebug(playerId: string, command: string, args: string[]): string {
    this.#record({ type: "debug", tick: this.state.tick, playerId, command, args });
    return runDebugCommand(this, command, args, this.mode);
  }

  /** The replay so far, with `final` set to the current tick and state hash. */
  snapshot(): Replay {
    return {
      version: REPLAY_VERSION,
      game: this.def.id,
      roomId: this.#opts.roomId,
      seed: this.#opts.seed,
      tickRate: this.#startConfig.tickRate,
      configVersion: this.#startConfig.version,
      config: structuredClone(this.#startConfig) as Record<string, unknown>,
      sha: this.#opts.sha,
      scenario: this.#opts.scenario ?? null,
      startedAt: this.#opts.startedAt,
      events: [...this.#events],
      truncated: this.#truncated,
      final: { tick: this.state.tick, stateHash: stateHash(this.state) },
    };
  }

  #record(event: ReplayEvent): void {
    if (this.#truncated) return;
    if (this.#events.length >= this.#maxEvents) {
      this.#truncated = true;
      return;
    }
    this.#events.push(event);
  }
}
