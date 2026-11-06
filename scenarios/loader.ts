import type { Scenario } from "./schema.js";

export function parseScenario(data: unknown): Scenario {
  if (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "name" in data &&
    "players" in data &&
    Array.isArray((data as Record<string, unknown>).players)
  ) {
    return data as Scenario;
  }
  throw new Error("Invalid scenario data");
}
