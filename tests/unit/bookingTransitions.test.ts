import { describe, expect, it } from "vitest";
import { isTransitionAllowed } from "@/lib/services/BookingService";

describe("booking status transitions", () => {
  it("allows the documented happy path", () => {
    expect(isTransitionAllowed("PENDING", "PAYMENT_PENDING")).toBe(true);
    expect(isTransitionAllowed("PAYMENT_PENDING", "CONFIRMED")).toBe(true);
    expect(isTransitionAllowed("CONFIRMED", "CHECKED_IN")).toBe(true);
    expect(isTransitionAllowed("CHECKED_IN", "CHECKED_OUT")).toBe(true);
  });

  it("allows cancellation/expiry from the pre-confirmation states", () => {
    expect(isTransitionAllowed("PENDING", "CANCELLED")).toBe(true);
    expect(isTransitionAllowed("PENDING", "EXPIRED")).toBe(true);
    expect(isTransitionAllowed("PAYMENT_PENDING", "CANCELLED")).toBe(true);
    expect(isTransitionAllowed("PAYMENT_PENDING", "EXPIRED")).toBe(true);
    expect(isTransitionAllowed("CONFIRMED", "CANCELLED")).toBe(true);
  });

  it("rejects arbitrary/backwards transitions", () => {
    expect(isTransitionAllowed("CHECKED_OUT", "CONFIRMED")).toBe(false);
    expect(isTransitionAllowed("CANCELLED", "PENDING")).toBe(false);
    expect(isTransitionAllowed("CONFIRMED", "PENDING")).toBe(false);
    expect(isTransitionAllowed("EXPIRED", "CONFIRMED")).toBe(false);
    expect(isTransitionAllowed("CHECKED_IN", "CANCELLED")).toBe(false);
  });

  it("treats terminal states as having no outgoing transitions", () => {
    for (const to of ["PENDING", "PAYMENT_PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "EXPIRED"] as const) {
      expect(isTransitionAllowed("CHECKED_OUT", to)).toBe(false);
      expect(isTransitionAllowed("CANCELLED", to)).toBe(false);
      expect(isTransitionAllowed("EXPIRED", to)).toBe(false);
    }
  });
});
