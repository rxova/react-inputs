import { describe, expect, it } from "vitest";
import { inspectMax, inspectValue } from "../warn";
import type { RatingWarningCode } from "../types";

/**
 * `inspect*` is the pure core of the development warnings: given a raw prop it
 * names the coercion `math.ts` will apply, or returns null when nothing was
 * coerced. Kept pure and unit-tested here; the effect that routes these to a
 * handler is exercised in warn.browser.test.tsx.
 */

describe("inspectValue", () => {
  it.each<[number, number, RatingWarningCode | null]>([
    // In range, including both endpoints — no warning.
    [3, 5, null],
    [0, 5, null],
    [5, 5, null],
    // Out of range in each of the three ways.
    [7, 5, "value-above-max"],
    [-1, 5, "value-negative"],
    [-0.0001, 5, "value-negative"],
    [Number.NaN, 5, "value-non-finite"],
    [Number.POSITIVE_INFINITY, 5, "value-non-finite"],
    [Number.NEGATIVE_INFINITY, 5, "value-non-finite"],
  ])("inspectValue(%p, max %p) -> %s", (raw, max, code) => {
    expect(inspectValue(raw, max, "value")?.code ?? null).toBe(code);
  });

  it("reports the coerced value that will actually be painted", () => {
    expect(inspectValue(7, 5, "value")?.used).toBe(5);
    expect(inspectValue(-2, 5, "value")?.used).toBe(0);
    expect(inspectValue(Number.NaN, 5, "value")?.used).toBe(0);
  });

  it("names the prop it was told to blame", () => {
    expect(inspectValue(7, 5, "value")?.prop).toBe("value");
    expect(inspectValue(7, 5, "defaultValue")?.prop).toBe("defaultValue");
  });

  it("preserves the raw input on the warning for telemetry", () => {
    const w = inspectValue(Number.POSITIVE_INFINITY, 5, "value");
    expect(w?.received).toBe(Number.POSITIVE_INFINITY);
    expect(w?.message).toContain("Infinity");
  });

  it("spells out max in the above-max message", () => {
    expect(inspectValue(7, 5, "value")?.message).toBe("`value` (7) exceeds `max` (5); painting 5.");
  });
});

describe("inspectMax", () => {
  it.each<[number, RatingWarningCode | null]>([
    [5, null],
    [1, null],
    [10, null],
    [4.7, "max-non-integer"],
    [0, "max-too-small"],
    [0.5, "max-too-small"],
    [-3, "max-too-small"],
    [Number.NaN, "max-non-finite"],
    [Number.POSITIVE_INFINITY, "max-non-finite"],
  ])("inspectMax(%p) -> %s", (raw, code) => {
    expect(inspectMax(raw, 5)?.code ?? null).toBe(code);
  });

  it("reports the fallback that will actually be used", () => {
    expect(inspectMax(4.7, 5)?.used).toBe(4);
    expect(inspectMax(0, 5)?.used).toBe(5);
    expect(inspectMax(Number.NaN, 5)?.used).toBe(5);
    expect(inspectMax(0, 10)?.used).toBe(10);
  });

  it("always blames max", () => {
    expect(inspectMax(4.7, 5)?.prop).toBe("max");
  });
});
