import { describe, expect, it } from "vitest";
import { calculateTotalCents } from "@/lib/money";

describe("calculateTotalCents", () => {
  it("multiplies price per night by night count exactly", () => {
    expect(calculateTotalCents(180000, 4)).toBe(720000);
  });

  it("never produces a fractional result (integer cents only)", () => {
    const result = calculateTotalCents(33333, 3);
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(99999);
  });

  it("rejects a negative or non-integer price", () => {
    expect(() => calculateTotalCents(-100, 1)).toThrow();
    expect(() => calculateTotalCents(100.5, 1)).toThrow();
  });

  it("rejects a zero or negative night count", () => {
    expect(() => calculateTotalCents(100, 0)).toThrow();
    expect(() => calculateTotalCents(100, -1)).toThrow();
  });
});
