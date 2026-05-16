import { describe, it, expect } from "vitest";
import { belgradeLocalToUTCISO } from "@/lib/utils";

describe("belgradeLocalToUTCISO", () => {
  it("converts May 17 21:00 Belgrade (CEST UTC+2) to 19:00 UTC", () => {
    expect(belgradeLocalToUTCISO("2026-05-17T21:00")).toBe("2026-05-17T19:00:00.000Z");
  });
  it("converts Jan 15 21:00 Belgrade (CET UTC+1) to 20:00 UTC", () => {
    expect(belgradeLocalToUTCISO("2026-01-15T21:00")).toBe("2026-01-15T20:00:00.000Z");
  });
  it("midnight roundtrip", () => {
    expect(belgradeLocalToUTCISO("2026-07-04T00:00")).toBe("2026-07-03T22:00:00.000Z");
  });
  it("returns null for garbage", () => {
    expect(belgradeLocalToUTCISO("not a date")).toBeNull();
  });
});
