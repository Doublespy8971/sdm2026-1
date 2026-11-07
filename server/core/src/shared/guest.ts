/**
 * Guest identity: a random ID the browser keeps (`getGuestId()` in @sdm/core/client) and sends as the
 * join option `guestId`, so a game can tell that the same person came back.
 *
 * The raw ID works like a password: anyone who has it can join as that person. So it never appears in
 * synced state, logs, replays or HTTP responses. The server turns it into a short public fingerprint
 * (`guest`: the first 12 hex characters of its SHA-256) and stores only that.
 */

/** The join option the client sends the raw guest ID in. */
export const GUEST_ID_OPTION = "guestId";

/** Length of the public fingerprint, in hex characters (48 bits). */
export const GUEST_FINGERPRINT_LENGTH = 12;

/** A fingerprint, or "" for a player who sent no valid guest ID. */
export const GUEST_FINGERPRINT_PATTERN = /^(?:[0-9a-f]{12})?$/;

const GUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a UUID (any version, either case): what `getGuestId()` produces and the server accepts. */
export function isGuestId(value: unknown): value is string {
  return typeof value === "string" && GUEST_ID_PATTERN.test(value);
}
