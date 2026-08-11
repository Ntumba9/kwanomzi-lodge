import { describe, expect, it } from "vitest";
import { countNights, formatDateOnly, nightsBetween, parseDateOnly } from "@/lib/dates";

describe("parseDateOnly", () => {
  it("parses a YYYY-MM-DD string as UTC midnight", () => {
    const d = parseDateOnly("2026-08-10");
    expect(d.toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(() => parseDateOnly("10 Aug 2026")).toThrow();
    expect(() => parseDateOnly("2026-8-10")).toThrow();
  });
});

describe("formatDateOnly", () => {
  it("round-trips with parseDateOnly", () => {
    expect(formatDateOnly(parseDateOnly("2026-12-25"))).toBe("2026-12-25");
  });
});

describe("nightsBetween", () => {
  it("excludes the check-out day itself", () => {
    const nights = nightsBetween(parseDateOnly("2026-08-10"), parseDateOnly("2026-08-15"));
    expect(nights.map(formatDateOnly)).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
    ]);
  });

  it("returns a single night for a one-night stay", () => {
    const nights = nightsBetween(parseDateOnly("2026-08-10"), parseDateOnly("2026-08-11"));
    expect(nights.map(formatDateOnly)).toEqual(["2026-08-10"]);
  });

  it("adjacent bookings (checkout = next checkin) occupy disjoint nights", () => {
    const a = nightsBetween(parseDateOnly("2026-08-10"), parseDateOnly("2026-08-15"));
    const b = nightsBetween(parseDateOnly("2026-08-15"), parseDateOnly("2026-08-18"));
    const overlap = a.map(formatDateOnly).filter((d) => b.map(formatDateOnly).includes(d));
    expect(overlap).toEqual([]);
  });
});

describe("countNights", () => {
  it("matches nightsBetween's length", () => {
    const checkIn = parseDateOnly("2026-08-10");
    const checkOut = parseDateOnly("2026-08-17");
    expect(countNights(checkIn, checkOut)).toBe(nightsBetween(checkIn, checkOut).length);
  });
});
