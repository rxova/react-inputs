import { clampValue, normalizeMax } from "./math";
import type { RatingWarning, RatingWarningCode } from "./types";

/**
 * Development-only diagnostics.
 *
 * Every function here is reached exclusively from the `NODE_ENV !== 'production'`
 * branch in `useRating`, so a production bundler drops this whole module. The
 * coercion itself lives in `math.ts` and always runs; this only *describes* a
 * coercion that already happened, reusing `clampValue`/`normalizeMax` so the
 * reported `used` value can never disagree with what is actually painted.
 */

/** `String(NaN)` is already "NaN"; kept as a seam in case that ever needs work. */
const show = (n: number): string => String(n);

/** Describe how `value`/`defaultValue` was coerced, or `null` if it was fine. */
export function inspectValue(
  raw: number,
  max: number,
  prop: "value" | "defaultValue",
): RatingWarning | null {
  let code: RatingWarningCode;
  if (!Number.isFinite(raw)) code = "value-non-finite";
  else if (raw < 0) code = "value-negative";
  else if (raw > max) code = "value-above-max";
  // 0..max, inclusive, is exactly the accepted range — nothing to report.
  else return null;

  const used = clampValue(raw, max);
  const got = show(raw);
  const message =
    code === "value-above-max"
      ? `\`${prop}\` (${got}) exceeds \`max\` (${show(max)}); painting ${show(used)}.`
      : code === "value-negative"
        ? `\`${prop}\` must be >= 0; received ${got}. Using ${show(used)}.`
        : `\`${prop}\` must be a finite number; received ${got}. Using ${show(used)}.`;

  return { code, prop, received: raw, used, message };
}

/** Describe how `max` was coerced, or `null` if it was a positive integer. */
export function inspectMax(raw: number, fallbackMax: number): RatingWarning | null {
  let code: RatingWarningCode;
  if (!Number.isFinite(raw)) code = "max-non-finite";
  else if (raw < 1) code = "max-too-small";
  else if (!Number.isInteger(raw)) code = "max-non-integer";
  else return null;

  const used = normalizeMax(raw, fallbackMax);
  const got = show(raw);
  let message: string;
  if (code === "max-non-integer") {
    message = `\`max\` must be an integer; received ${got}. Using ${show(used)}.`;
  } else if (code === "max-too-small") {
    message = `\`max\` must be >= 1; received ${got}. Using ${show(used)}.`;
  } else {
    message = `\`max\` must be a positive integer; received ${got}. Using ${show(used)}.`;
  }

  return { code, prop: "max", received: raw, used, message };
}
