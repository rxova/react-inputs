import { describe, expect, it } from "vitest";
import {
  clampValue,
  decimalPlaces,
  getFills,
  getSteps,
  normalizeMax,
  snap,
  toPercent,
} from "../math";
import type { RatingRounding } from "../types";

describe("clampValue", () => {
  it.each([
    [4.3, 5, 4.3],
    [0, 5, 0],
    [5, 5, 5],
    [7, 5, 5],
    [-1, 5, 0],
    [-0.0001, 5, 0],
    // Non-finite is garbage input, and garbage must never inflate a rating.
    // Documented contract: NaN/Infinity -> 0.
    [Number.NaN, 5, 0],
    [Number.POSITIVE_INFINITY, 5, 0],
    [Number.NEGATIVE_INFINITY, 5, 0],
  ])("clamp(%p, max %p) -> %p", (value, max, expected) => {
    expect(clampValue(value, max)).toBe(expected);
  });
});

describe("normalizeMax", () => {
  it.each([
    [5, 5, 5],
    [10, 5, 10],
    [1, 5, 1],
    [4.7, 5, 4],
    [0, 5, 5],
    [-3, 5, 5],
    [Number.NaN, 5, 5],
    [0, 10, 10],
    [Number.NaN, 10, 10],
  ])("normalizeMax(%p, fallback %p) -> %p", (input, fallback, expected) => {
    expect(normalizeMax(input, fallback)).toBe(expected);
  });
});

describe("decimalPlaces", () => {
  it.each([
    [1, 0],
    [0.5, 1],
    [0.25, 2],
    [4.35, 2],
    [1e-7, 7],
    [1.5e-3, 4],
    [Number.NaN, 0],
  ])("decimalPlaces(%p) -> %p", (input, expected) => {
    expect(decimalPlaces(input)).toBe(expected);
  });
});

describe("snap — the published rounding table", () => {
  // Every row of the table in the README. If this changes, the docs are wrong.
  const table: [string, number, number, RatingRounding, number][] = [
    ["exact 4.3", 4.3, 0, "none", 4.3],
    ["exact 4.7", 4.7, 0, "none", 4.7],
    ["whole nearest 4.3", 4.3, 1, "nearest", 4],
    ["whole nearest 4.7", 4.7, 1, "nearest", 5],
    ["whole down 4.3", 4.3, 1, "down", 4],
    ["whole down 4.7", 4.7, 1, "down", 4],
    ["whole up 4.3", 4.3, 1, "up", 5],
    ["whole up 4.7", 4.7, 1, "up", 5],
    ["half nearest 4.3", 4.3, 0.5, "nearest", 4.5],
    ["half nearest 4.7", 4.7, 0.5, "nearest", 4.5],
    ["half down 4.3", 4.3, 0.5, "down", 4],
    ["half down 4.7", 4.7, 0.5, "down", 4.5],
    ["tenths nearest 4.3", 4.3, 0.1, "nearest", 4.3],
    ["tenths nearest 4.7", 4.7, 0.1, "nearest", 4.7],
  ];

  it.each(table)("%s", (_name, value, precision, rounding, expected) => {
    expect(snap(value, precision, rounding)).toBe(expected);
  });
});

describe("snap — float safety", () => {
  // 4.35 / 0.1 is 43.499999999999996 in IEEE-754. Dividing floats naively
  // rounds this to 4.3; the mathematically correct nearest is 4.4.
  it("rounds 4.35 at tenths to 4.4, not 4.3", () => {
    expect(snap(4.35, 0.1, "nearest")).toBe(4.4);
  });

  it("produces clean decimals rather than float dust", () => {
    expect(snap(0.29, 0.1, "nearest")).toBe(0.3);
    expect(snap(2.675, 0.01, "nearest")).toBe(2.68);
    expect(snap(1.005, 0.01, "nearest")).toBe(1.01);
  });

  it("never returns a value needing epsilon comparison", () => {
    for (let i = 0; i <= 50; i++) {
      const v = i / 10;
      const out = snap(v, 0.5, "nearest");
      expect(Number.isInteger(out * 2)).toBe(true);
    }
  });

  it("is idempotent", () => {
    const rounds: RatingRounding[] = ["nearest", "down", "up", "none"];
    for (const r of rounds) {
      for (const p of [0, 0.1, 0.25, 0.5, 1]) {
        for (const v of [0, 0.07, 1.5, 3.333, 4.35, 5]) {
          const once = snap(v, p, r);
          expect(snap(once, p, r)).toBe(once);
        }
      }
    }
  });
});

describe("snap — degenerate inputs", () => {
  it.each([
    [4.3, 0, "nearest" as const, 4.3],
    [4.3, -1, "nearest" as const, 4.3],
    [4.3, Number.NaN, "nearest" as const, 4.3],
    [4.3, Number.POSITIVE_INFINITY, "nearest" as const, 4.3],
  ])("precision %p is a no-op", (value, precision, rounding, expected) => {
    expect(snap(value, precision, rounding)).toBe(expected);
  });

  it("returns 0 for non-finite values when snapping", () => {
    expect(snap(Number.NaN, 1, "nearest")).toBe(0);
  });

  it("treats a precision finer than 1e-12 as a no-op rather than lying", () => {
    expect(snap(1.0000000000005, 0.0000000000001, "nearest")).toBe(1.0000000000005);
  });

  it("absorbs float dust in the incoming value", () => {
    // 0.1 * 3 === 0.30000000000000004, which carries 17 decimal places.
    expect(snap(0.1 * 3, 0.1, "nearest")).toBe(0.3);
    expect(snap(0.1 + 0.2, 0.1, "nearest")).toBe(0.3);
  });
});

describe("getFills", () => {
  it("splits a partial score across icons", () => {
    expect(getFills(4.3, 5)).toEqual([1, 1, 1, 1, 0.3]);
  });

  it.each([
    [0, 5, [0, 0, 0, 0, 0]],
    [5, 5, [1, 1, 1, 1, 1]],
    [2, 5, [1, 1, 0, 0, 0]],
    [0.5, 3, [0.5, 0, 0]],
  ])("getFills(%p, %p)", (value, max, expected) => {
    expect(getFills(value, max)).toEqual(expected);
  });

  it("always returns exactly max entries in [0,1]", () => {
    for (const max of [1, 3, 5, 10]) {
      for (const v of [0, 0.4, 2.7, max]) {
        const fills = getFills(v, max);
        expect(fills).toHaveLength(max);
        for (const f of fills) expect(f).toBeGreaterThanOrEqual(0);
        for (const f of fills) expect(f).toBeLessThanOrEqual(1);
      }
    }
  });

  it("sums to the value it was given", () => {
    expect(getFills(3.7, 5).reduce((a, b) => a + b, 0)).toBeCloseTo(3.7, 10);
  });
});

describe("getSteps", () => {
  it("enumerates whole values by default", () => {
    expect(getSteps(5, 1)).toEqual([1, 2, 3, 4, 5]);
  });

  it("enumerates halves", () => {
    expect(getSteps(5, 0.5)).toEqual([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);
  });

  it("never includes 0 — clearing is a separate action", () => {
    expect(getSteps(5, 0.5)).not.toContain(0);
  });

  it("treats precision 0 as whole steps, since 0 is not selectable", () => {
    expect(getSteps(3, 0)).toEqual([1, 2, 3]);
  });

  it("produces clean decimals at tenths", () => {
    expect(getSteps(1, 0.1)).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
  });
});

describe("decimalPlaces — exponential notation", () => {
  it("handles an exponential mantissa that carries its own decimals", () => {
    // String(1.5e-7) is "1.5e-7": one mantissa decimal plus a 7-place exponent.
    expect(decimalPlaces(1.5e-7)).toBe(8);
    expect(decimalPlaces(1.25e-7)).toBe(9);
  });

  it("handles a positive exponent", () => {
    expect(decimalPlaces(1e21)).toBe(0);
  });
});

describe("toPercent", () => {
  it("strips float dust from the emitted style value", () => {
    // 4.3 - 4 is 0.29999999999999982, which would otherwise reach the DOM.
    expect(toPercent(4.3 - 4)).toBe(30);
    expect(toPercent(0.1 + 0.2)).toBe(30);
  });

  it.each([
    [0, 0],
    [1, 100],
    [0.5, 50],
    [0.333333333, 33.33],
    [0.125, 12.5],
  ])("toPercent(%p) -> %p", (fill, expected) => {
    expect(toPercent(fill)).toBe(expected);
  });

  it("never emits more than two decimals", () => {
    for (let i = 0; i <= 100; i++) {
      const s = String(toPercent(i / 300));
      const dot = s.indexOf(".");
      if (dot !== -1) expect(s.length - dot - 1).toBeLessThanOrEqual(2);
    }
  });
});

describe("getFills — dust", () => {
  it("returns a clean fractional fill", () => {
    expect(getFills(4.3, 5)[4]).toBe(0.3);
    expect(getFills(2.1, 3)[2]).toBe(0.1);
  });
});
