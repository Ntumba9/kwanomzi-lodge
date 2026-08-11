import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/format";

describe("formatMoney", () => {
  it("formats whole rand amounts with comma thousands and no decimals", () => {
    expect(formatMoney(110000)).toBe("R1,100");
    expect(formatMoney(180000)).toBe("R1,800");
    expect(formatMoney(540000)).toBe("R5,400");
    expect(formatMoney(156000)).toBe("R1,560");
  });

  it("shows decimals only when the amount is genuinely fractional", () => {
    expect(formatMoney(110050)).toBe("R1,100.50");
  });

  it("has no space between the currency symbol and the amount", () => {
    expect(formatMoney(100000)).not.toMatch(/^R\s/);
  });
});
