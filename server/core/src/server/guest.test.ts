import { describe, expect, it } from "vitest";
import { GUEST_FINGERPRINT_PATTERN, isGuestId } from "../shared/guest.ts";
import { guestFingerprint, withoutGuestId } from "./guest.ts";

const RAW = "6f1c2b9e-3d4a-4f5b-8c7d-9e0f1a2b3c4d";

describe("isGuestId", () => {
  it("accepts UUIDs and rejects everything else", () => {
    expect(isGuestId(RAW)).toBe(true);
    expect(isGuestId(RAW.toUpperCase())).toBe(true);
    expect(isGuestId(crypto.randomUUID())).toBe(true);
    for (const bad of [
      undefined,
      null,
      42,
      {},
      "",
      "abc",
      `${RAW}0`,
      "x".repeat(36),
      RAW.replaceAll("-", ""),
    ])
      expect(isGuestId(bad)).toBe(false);
  });
});

describe("guestFingerprint", () => {
  it("is 12 hex characters, the start of the ID's SHA-256", async () => {
    const fp = guestFingerprint(RAW);
    expect(fp).toMatch(/^[0-9a-f]{12}$/);
    expect(fp).toMatch(GUEST_FINGERPRINT_PATTERN);
    const { createHash } = await import("node:crypto");
    expect(fp).toBe(createHash("sha256").update(RAW).digest("hex").slice(0, 12));
  });

  it("is stable: the same ID always gives the same fingerprint, whatever its case", () => {
    expect(guestFingerprint(RAW)).toBe(guestFingerprint(RAW));
    expect(guestFingerprint(RAW.toUpperCase())).toBe(guestFingerprint(RAW));
  });

  it("differs between IDs, and never equals or contains the raw ID or a piece of it", () => {
    const other = crypto.randomUUID();
    expect(guestFingerprint(other)).not.toBe(guestFingerprint(RAW));
    const fp = guestFingerprint(RAW);
    expect(fp).not.toBe(RAW);
    expect(RAW).not.toContain(fp);
    expect(fp).not.toContain(RAW);
    for (const part of RAW.split("-")) expect(fp).not.toContain(part);
  });

  it('is "" for a missing or invalid guest ID', () => {
    for (const bad of [undefined, null, "", "nope", 7, { id: RAW }, "x".repeat(10_000)])
      expect(guestFingerprint(bad)).toBe("");
  });
});

describe("withoutGuestId", () => {
  it("removes guestId and keeps every other option", () => {
    expect(withoutGuestId({ name: "Ada", guestId: RAW })).toEqual({ name: "Ada" });
    expect(withoutGuestId({ name: "Ada" })).toEqual({ name: "Ada" });
  });

  it("does not change the caller's object", () => {
    const options = { name: "Ada", guestId: RAW };
    withoutGuestId(options);
    expect(options.guestId).toBe(RAW);
  });

  it("leaves non-object options alone", () => {
    expect(withoutGuestId(undefined)).toBeUndefined();
    expect(withoutGuestId(null)).toBeNull();
    expect(withoutGuestId("x")).toBe("x");
  });
});
