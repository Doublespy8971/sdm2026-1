import { SeededRandom } from "@sdm/core/shared";
import { describe, expect, it } from "vitest";
import { runReplay } from "./replayRunner.ts";
import { Simulation } from "./simulation.ts";
import { makeCounterGame } from "./testing/counterGame.ts";

function scriptedSim(ticks: number) {
  const def = makeCounterGame();
  const sim = new Simulation(def, { seed: 7, roomId: "r1", sha: "t", startedAt: "x", mode: "live" });
  const driver = new SeededRandom(99);
  const seq = { p1: 0, p2: 0 };
  sim.join("p1", { name: "a" });
  for (let i = 0; i < ticks; i++) {
    if (i === 20) sim.join("p2", { name: "b" });
    if (i === 60) sim.drop("p2");
    if (i === 90) {
      sim.reconnect("p2");
      seq.p2 = -1;
    }
    if (i === 150) sim.leave("p1");
    for (const id of ["p1", "p2"] as const) {
      if (driver.next() < 0.7) sim.queueInput(id, { seq: ++seq[id], data: { dx: driver.range(-1, 1) } });
    }
    sim.tick();
  }
  return { def, sim };
}

describe("runReplay", () => {
  it("re-running a snapshot reproduces the final hash", () => {
    const { def, sim } = scriptedSim(200);
    const replay = sim.snapshot();
    expect(replay.events.some((e) => e.type === "drop")).toBe(true);
    const result = runReplay(def, replay);
    expect(result.tick).toBe(200);
    expect(result.stateHash).toBe(replay.final?.stateHash);
  });

  it("a mid-run snapshot replays to that tick's hash", () => {
    const { def, sim } = scriptedSim(120);
    const mid = sim.snapshot();
    for (let i = 0; i < 30; i++) sim.tick();
    expect(runReplay(def, mid).stateHash).toBe(mid.final?.stateHash);
  });

  it("stops at untilTick", () => {
    const { def, sim } = scriptedSim(100);
    expect(runReplay(def, sim.snapshot(), { untilTick: 40 }).tick).toBe(40);
  });

  it("uses the replay's embedded config, not the definition's", () => {
    const { def, sim } = scriptedSim(100);
    const replay = sim.snapshot();
    const edited = { ...def, config: { ...def.config, speed: 5 } };
    expect(runReplay(edited, replay).stateHash).toBe(replay.final?.stateHash);
  });

  it("rejects another game's replay and a truncated replay", () => {
    const { def, sim } = scriptedSim(10);
    const replay = sim.snapshot();
    expect(() => runReplay(def, { ...replay, game: "other" })).toThrow("replay is for game other");
    expect(() => runReplay(def, { ...replay, truncated: true })).toThrow("replay is truncated");
  });
});
