/**
 * Server rooms for this game. Each entry builds a Room class from the host's shared deps;
 * the host registers them by name.
 */
import type { RoomFactory } from "@sdm/host";

export const rooms: Record<string, RoomFactory> = {};
