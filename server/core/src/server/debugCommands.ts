import type { BaseState, RoomSettings } from "../sim/index.ts";
import type { SimMode, Simulation } from "./simulation.ts";

/** Runs a debug command against a simulation. Implemented in full by the debug commands task. */
export function runDebugCommand<S extends BaseState, I, C extends RoomSettings>(
  _sim: Simulation<S, I, C>,
  command: string,
  _args: string[],
  _mode: SimMode,
): string {
  throw new Error(`unknown command: ${command}`);
}
