import { describe, expect, it } from "vitest";
import { readTrustProxyHops } from "./env.ts";

describe("readTrustProxyHops", () => {
  it("is 1 when unset or empty: Railway's edge only", () => {
    expect(readTrustProxyHops(undefined)).toBe(1);
    expect(readTrustProxyHops("")).toBe(1);
  });

  it.each(["1", "2", "3"])("accepts %s", (value) => {
    expect(readTrustProxyHops(value)).toBe(Number(value));
  });

  it.each(["0", "4", "-1", "1.5", "two", "NaN"])("refuses %s instead of quietly falling back", (value) => {
    expect(() => readTrustProxyHops(value)).toThrow(/TRUST_PROXY_HOPS must be 1, 2 or 3/);
  });
});
