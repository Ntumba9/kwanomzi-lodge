import { describe, expect, it } from "vitest";
import { generateBookingReference } from "@/lib/bookingReference";

describe("generateBookingReference", () => {
  it("matches the expected shape", () => {
    const ref = generateBookingReference(new Date("2026-08-10T00:00:00.000Z"));
    expect(ref).toMatch(/^KWZ-20260810-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  });

  it("excludes visually ambiguous characters", () => {
    const refs = Array.from({ length: 200 }, () => generateBookingReference());
    for (const ref of refs) {
      const suffix = ref.split("-")[2];
      expect(suffix).not.toMatch(/[01OI]/);
    }
  });

  it("produces different references on repeated calls", () => {
    const refs = new Set(Array.from({ length: 50 }, () => generateBookingReference()));
    expect(refs.size).toBeGreaterThan(1);
  });
});
