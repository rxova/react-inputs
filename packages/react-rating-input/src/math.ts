import type { RatingRounding } from "./types";

/** Largest decimal scale that 10**dp still represents exactly. */
const MAX_DP = 12;

/**
 * Number of decimal places in `n`, including exponential-notation forms
 * (`1e-7` -> 7). Used to pick an integer scale for exact snapping.
 */
export function decimalPlaces(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const s = String(n);
  const e = s.indexOf("e");
  if (e !== -1) {
    const mantissa = s.slice(0, e);
    const exponent = Number(s.slice(e + 1));
    const dot = mantissa.indexOf(".");
    const mantissaDp = dot === -1 ? 0 : mantissa.length - dot - 1;
    return Math.max(0, mantissaDp - exponent);
  }
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

/** Coerce anything to a usable score. NaN/Infinity/-Infinity/negatives -> 0. */
export function clampValue(value: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value > max ? max : value;
}

/** `max` must be a positive integer; anything else falls back to `fallbackMax`. */
export function normalizeMax(max: number, fallbackMax: number): number {
  if (!Number.isFinite(max)) return fallbackMax;
  const n = Math.floor(max);
  return n >= 1 ? n : fallbackMax;
}

/**
 * Snap `value` onto a `precision` grid in the given direction.
 *
 * Works in integer space rather than dividing floats: `4.35 / 0.1` is
 * `43.499999999999996` in IEEE-754, which naively floors to 4.3 when the
 * mathematically correct nearest is 4.4. Scaling both operands to integers
 * by their shared decimal count makes the division exact.
 */
export function snap(value: number, precision: number, rounding: RatingRounding): number {
  if (rounding === "none" || !Number.isFinite(precision) || precision <= 0) return value;
  if (!Number.isFinite(value)) return 0;

  // Capped at 12 rather than bailing out: past that the integer scale stops
  // being exactly representable, and a value carrying float dust (0.1 * 3 has
  // 17 decimal places) would otherwise escape the integer path entirely and
  // reintroduce the very error this function exists to remove.
  const dp = Math.min(MAX_DP, Math.max(decimalPlaces(value), decimalPlaces(precision)));

  const scale = 10 ** dp;
  const v = Math.round(value * scale);
  const p = Math.round(precision * scale);
  // A precision finer than the scale can represent has nothing to snap to.
  if (p === 0) return value;

  const steps = v / p;
  let n: number;
  switch (rounding) {
    case "down":
      n = Math.floor(steps);
      break;
    case "up":
      n = Math.ceil(steps);
      break;
    default:
      n = Math.round(steps);
  }
  return (n * p) / scale;
}

/**
 * Per-icon fill ratios in `[0, 1]`. Index `i` covers the score band `(i, i+1]`,
 * so a 4.3 over 5 icons yields `[1, 1, 1, 1, 0.3]`.
 */
export function getFills(value: number, max: number): number[] {
  const fills: number[] = new Array<number>(max);
  for (let i = 0; i < max; i++) {
    const f = value - i;
    // `4.3 - 4` is 0.29999999999999982. Left alone that dust reaches both the
    // rendered style attribute and `RatingIconState.fill`, so clean it here at
    // the source rather than at each use site.
    fills[i] = f <= 0 ? 0 : f >= 1 ? 1 : Math.round(f * 1e10) / 1e10;
  }
  return fills;
}

/**
 * A fill ratio as a CSS percentage number, rounded to two decimals.
 *
 * Emitted into a `style` attribute for every icon, so an unrounded value costs
 * ~15 extra characters per icon in the SSR payload and gives the client a
 * different string to reconcile against.
 */
export function toPercent(fill: number): number {
  return Math.round(fill * 1e4) / 1e2;
}

/**
 * The selectable values for interactive mode: every grid step from one
 * `precision` up to and including `max`. Never includes 0 — clearing is a
 * distinct action (`allowClear`), not a selectable option.
 */
export function getSteps(max: number, precision: number): number[] {
  const step = precision > 0 ? precision : 1;
  const count = Math.round(max / step);
  // Built by integer multiplication then a single divide, never by repeated
  // float multiplication: `3 * 0.1` is 0.30000000000000004, and that dust
  // would then flow into every value comparison and `checked` test downstream.
  const dp = Math.min(MAX_DP, decimalPlaces(step));
  const scale = 10 ** dp;
  const p = Math.round(step * scale);
  const steps: number[] = new Array<number>(count);
  for (let i = 1; i <= count; i++) {
    steps[i - 1] = (i * p) / scale;
  }
  return steps;
}
