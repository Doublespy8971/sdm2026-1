/** Server side of the guest identity (see shared/guest.ts): hashing and stripping the raw ID. */
import { createHash } from "node:crypto";
import { GUEST_FINGERPRINT_LENGTH, GUEST_ID_OPTION, isGuestId } from "../shared/guest.ts";

/**
 * The public fingerprint of a raw guest ID: the first 12 hex characters of SHA-256 of the lowercased
 * ID. Returns "" when the value isn't a guest ID, so a bad or missing one never rejects a join.
 */
export function guestFingerprint(guestId: unknown): string {
  if (!isGuestId(guestId)) return "";
  return createHash("sha256").update(guestId.toLowerCase()).digest("hex").slice(0, GUEST_FINGERPRINT_LENGTH);
}

/** The join options without `guestId`, so the game's schema, the replay and the logs never see it. */
export function withoutGuestId(options: unknown): unknown {
  if (options === null || typeof options !== "object" || Array.isArray(options)) return options;
  if (!(GUEST_ID_OPTION in options)) return options;
  const { [GUEST_ID_OPTION]: _raw, ...rest } = options as Record<string, unknown>;
  return rest;
}
