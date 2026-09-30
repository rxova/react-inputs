import type { CurrencyDisplay } from "./types";
import { devWarnOnce } from "./warn";

/**
 * The formatting engine. Pure, React-free, and the whole correctness story of
 * this library.
 *
 * Every locale-specific fact — group separator, decimal separator, symbol,
 * symbol placement, fraction-digit count, native digits, the Bulgarian
 * "no grouping below 10000" rule — is *read from* `Intl.NumberFormat`, never
 * reconstructed. We never split a number into groups of three, never hardcode a
 * separator, never assume the symbol goes on the left. That single restraint is
 * why bg-BG, ja-JP, ar-EG and de-CH come out correct without a branch each.
 */

export interface CreateFormatterOptions {
  locale?: string | undefined;
  currency: string;
  currencyDisplay?: CurrencyDisplay | undefined;
  numberingSystem?: string | undefined;
  minimumFractionDigits?: number | undefined;
  maximumFractionDigits?: number | undefined;
  allowNegative?: boolean | undefined;
}

/**
 * The canonical state of a partially-typed amount, for live editing. Digits are
 * ASCII; grouping and symbol are re-derived on format, never stored.
 */
export interface EditRaw {
  negative: boolean;
  /** Integer digits, leading zeros stripped (a lone `'0'` is kept). */
  intDigits: string;
  /** Whether a decimal separator has been entered. */
  hasDecimal: boolean;
  /** Fraction digits, clamped to `maximumFractionDigits`. */
  fracDigits: string;
}

export interface CurrencyFormatter {
  /** number → the localized string the user sees. `null` → `''`. */
  readonly format: (value: number | null) => string;
  /** any string (formatted or typed) → a clean number, or `null` if empty. */
  readonly parse: (input: string | null | undefined) => number | null;
  /** a partially-typed string → the sanitized editable string. */
  readonly sanitize: (input: string) => string;
  /** number → the clean editable string shown on focus (ASCII digits). */
  readonly toEditable: (value: number | null) => string;
  /** a partially-typed string → its canonical {@link EditRaw} (live mode). */
  readonly extractEditing: (input: string) => EditRaw;
  /** an {@link EditRaw} → the live-formatted string, grouping + symbol (live mode). */
  readonly formatEditing: (raw: EditRaw) => string;
  /** {@link EditRaw} → the numeric value it represents, or `null` if empty. */
  readonly editValue: (raw: EditRaw) => number | null;
  /** {@link EditRaw} → a clean ASCII editable string (for `meta.raw`). */
  readonly editPlain: (raw: EditRaw) => string;
  /** Digits and the decimal separator count for caret math; grouping does not. */
  readonly isSignificantChar: (ch: string) => boolean;
  /**
   * Whether inserting `data` could contribute anything to the edited amount:
   * a digit (ASCII or the locale's native ones), an allowed sign, or a decimal
   * separator where one can still go (`hasDecimal` says the field already has
   * one). An insertion that contributes nothing should be rejected before it
   * mutates the field — reformatting would only discard it and move the caret.
   */
  readonly insertionHasEditableChar: (data: string, hasDecimal: boolean) => boolean;
  readonly locale: string;
  readonly currency: string;
  readonly decimalSeparator: string;
  readonly groupSeparator: string;
  readonly currencySymbol: string;
  readonly maximumFractionDigits: number;
}

/** Combine `locale` / `language` / `country` into one BCP-47 tag (or undefined). */
export function resolveLocale(
  locale?: string,
  language?: string,
  country?: string,
): string | undefined {
  if (locale) return locale;
  const tag = [language, country].filter(Boolean).join("-");
  return tag.length > 0 ? tag : undefined;
}

/** First part of `type` in the formatted output, or `''` if none is present. */
export function findPart(
  nf: Intl.NumberFormat,
  value: number,
  type: Intl.NumberFormatPartTypes,
): string {
  for (const part of nf.formatToParts(value)) {
    if (part.type === type) return part.value;
  }
  return "";
}

/** Map the locale's native digits back to ASCII, or `null` if already ASCII. */
function buildDigitMap(
  locale: string | undefined,
  numberingSystem: string | undefined,
): Record<string, string> | null {
  const nf = new Intl.NumberFormat(locale, {
    numberingSystem,
    useGrouping: false,
  });
  const map: Record<string, string> = {};
  let native = false;
  for (let i = 0; i <= 9; i++) {
    const glyph = nf.format(i);
    if (glyph !== String(i)) native = true;
    map[glyph] = String(i);
  }
  return native ? map : null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createCurrencyFormatter(options: CreateFormatterOptions): CurrencyFormatter {
  const {
    locale,
    currency,
    currencyDisplay = "symbol",
    numberingSystem,
    minimumFractionDigits = 0,
    maximumFractionDigits,
    allowNegative = false,
  } = options;

  const intlOptions: Intl.NumberFormatOptions = {
    style: "currency",
    currency,
    currencyDisplay,
    numberingSystem,
    minimumFractionDigits,
  };
  if (maximumFractionDigits !== undefined) {
    intlOptions.maximumFractionDigits = maximumFractionDigits;
  }

  let nf: Intl.NumberFormat;
  let currencyOk = true;
  try {
    nf = new Intl.NumberFormat(locale, intlOptions);
  } catch (err) {
    currencyOk = false;
    // A display/input component must never crash a page over a bad locale or
    // currency code. Fall back to a plain decimal formatter so the field still
    // accepts and shows numbers, and say so in dev.
    devWarnOnce(
      `bad-formatter:${String(locale)}:${currency}`,
      `Could not build an Intl currency formatter for locale=${String(
        locale,
      )} currency=${currency} (${String(err)}). Falling back to a plain number format.`,
    );
    // The original locale, numbering system, currency, or fraction range may
    // itself be what threw. A fallback that reuses any of them is not a
    // fallback at all. Normalize only the fraction range and let the runtime's
    // default locale/numbering system provide a formatter that cannot inherit
    // the invalid option.
    const safeMinimum = Number.isInteger(minimumFractionDigits)
      ? Math.min(20, Math.max(0, minimumFractionDigits))
      : 0;
    const requestedMaximum =
      maximumFractionDigits !== undefined && Number.isInteger(maximumFractionDigits)
        ? Math.min(20, Math.max(0, maximumFractionDigits))
        : 2;
    nf = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: safeMinimum,
      maximumFractionDigits: Math.max(safeMinimum, requestedMaximum),
    });
  }

  const resolved = nf.resolvedOptions();
  const resolvedLocale = resolved.locale;
  const resolvedNumberingSystem = resolved.numberingSystem;
  // Required by ECMA-402 at runtime; TypeScript models the resolved bag with
  // the broader optional input shape.
  const resolvedMaxFraction = Number(resolved.maximumFractionDigits);

  // Decimal separator is a locale property, identical in currency and decimal
  // styles — but a 0-fraction currency (JPY) never emits a decimal part, so
  // probe a decimal formatter that is guaranteed to show one.
  const decimalProbe = new Intl.NumberFormat(resolvedLocale, {
    numberingSystem: resolvedNumberingSystem,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  // Guaranteed by the forced one-digit fraction above.
  const decimalSeparator = findPart(decimalProbe, 1.1, "decimal");

  // Probe grouping with a 7-digit integer: bg-BG only groups at 5+ digits, so a
  // 4-digit probe would report no separator and parsing a large number would
  // then fail to strip it. This is the subtle correctness bug in naive probes.
  const groupSeparator = findPart(nf, 1_111_111, "group");

  const currencySymbol = nf
    .formatToParts(0)
    .filter((p) => p.type === "currency")
    .map((p) => p.value)
    .join("");

  const digitMap = buildDigitMap(resolvedLocale, resolvedNumberingSystem);

  const mapDigits = (s: string): string => {
    if (!digitMap) return s;
    let out = "";
    for (const ch of s) out += digitMap[ch] ?? ch;
    return out;
  };

  // Intl emits either ASCII hyphen-minus or U+2212 MINUS SIGN as the negative
  // marker; both are covered here without needing to probe it per locale.
  const isNegativeMarked = (s: string): boolean => allowNegative && /[-−]/.test(s);

  // A whitespace group separator (bg-BG NBSP, fr-FR narrow NBSP) is removed by
  // the `\s` pass in parse; only a non-whitespace one (',', '.', "'") needs its
  // own matcher.
  const groupRegExp =
    groupSeparator.trim() !== "" ? new RegExp(escapeRegExp(groupSeparator), "g") : null;

  function parse(input: string | null | undefined): number | null {
    if (input == null) return null;
    let s = mapDigits(input);
    const negative = isNegativeMarked(s);

    // Strip grouping first, before the decimal swap, so a group separator that
    // happens to be '.' (de-DE) is not later mistaken for a decimal point.
    s = s.replace(/\s/g, ""); // JS \s covers NBSP (U+00A0), narrow NBSP (U+202F), thin space
    if (groupRegExp) s = s.replace(groupRegExp, "");

    if (decimalSeparator !== ".") s = s.split(decimalSeparator).join(".");

    // Drop the symbol, letters, stray characters — anything but digits and dots.
    s = s.replace(/[^0-9.]/g, "");

    // Collapse to a single decimal point (keep the first).
    const dot = s.indexOf(".");
    if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");

    if (s === "" || s === ".") return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return negative ? -n : n;
  }

  const dotIsGroup = groupSeparator === ".";
  const acceptDotAlias = decimalSeparator !== "." && !dotIsGroup;

  function sanitize(input: string): string {
    const s = mapDigits(input);
    let out = "";
    let hasDecimal = false;
    let negative = false;
    for (const ch of s) {
      if ((ch === "-" || ch === "−") && allowNegative && out === "" && !negative) {
        negative = true;
        continue;
      }
      if (ch >= "0" && ch <= "9") {
        out += ch;
        continue;
      }
      if (!hasDecimal && (ch === decimalSeparator || (acceptDotAlias && ch === "."))) {
        out += decimalSeparator;
        hasDecimal = true;
        continue;
      }
      // drop group separators, spaces, symbol, letters, extra decimals
    }

    if (hasDecimal) {
      // `out` is known to contain exactly one decimalSeparator here, so slicing
      // at its index avoids the undefined-element branches that split() carries
      // under noUncheckedIndexedAccess.
      const dot = out.indexOf(decimalSeparator);
      const int = out.slice(0, dot);
      const frac = out.slice(dot + decimalSeparator.length);
      if (resolvedMaxFraction <= 0) {
        // This currency has no fractional part (JPY); drop the decimal entirely.
        out = int;
      } else {
        out =
          frac.length > 0
            ? int + decimalSeparator + frac.slice(0, resolvedMaxFraction)
            : int + decimalSeparator;
      }
    }

    return (negative ? "-" : "") + out;
  }

  function toEditable(value: number | null): string {
    if (value == null || !Number.isFinite(value)) return "";
    let s = String(value); // ASCII digits, '.' decimal
    if (decimalSeparator !== ".") s = s.replace(".", decimalSeparator);
    return s;
  }

  // ---- Live editing (formatMode: 'live') ------------------------------------

  const minusGlyph = findPart(nf, -1, "minusSign") || "-";

  // A char is a decimal candidate if it is the locale decimal or a plain dot or
  // comma. Group separators are removed before this ever runs, so a remaining
  // candidate can only mean "decimal point".
  const isDecimalChar = (ch: string): boolean =>
    ch === decimalSeparator || ch === "." || ch === ",";

  const isSignificantChar = (ch: string): boolean =>
    (ch >= "0" && ch <= "9") || (isDecimalChar(ch) && ch !== groupSeparator);

  function stripLeadingZeros(digits: string): string {
    const trimmed = digits.replace(/^0+/, "");
    // Keep a single 0 so "0" and "0.05" render rather than collapsing to empty.
    return trimmed === "" && digits !== "" ? "0" : trimmed;
  }

  function extractEditing(input: string): EditRaw {
    let s = mapDigits(input);
    const negative = allowNegative && /[-−]/.test(s);
    // Group separators are decorative and auto-reinserted on format, so strip
    // them (and whitespace grouping like NBSP) before reading the digits.
    s = s.replace(/\s/g, "");
    if (groupRegExp) s = s.replace(groupRegExp, "");

    let intDigits = "";
    let fracDigits = "";
    let hasDecimal = false;
    for (const ch of s) {
      if (ch >= "0" && ch <= "9") {
        if (hasDecimal) fracDigits += ch;
        else intDigits += ch;
      } else if (!hasDecimal && isDecimalChar(ch)) {
        hasDecimal = true;
      }
      // else: sign, symbol letters, extra separators — ignored
    }

    if (resolvedMaxFraction <= 0) {
      hasDecimal = false;
      fracDigits = "";
    } else {
      fracDigits = fracDigits.slice(0, resolvedMaxFraction);
    }

    return { negative, intDigits: stripLeadingZeros(intDigits), hasDecimal, fracDigits };
  }

  // Cache the exact-fraction formatters so live typing does not rebuild an
  // Intl.NumberFormat on every keystroke.
  const liveFormatters = new Map<number, Intl.NumberFormat>();
  function liveNf(fractionLen: number): Intl.NumberFormat {
    let f = liveFormatters.get(fractionLen);
    if (!f) {
      const base: Intl.NumberFormatOptions = {
        numberingSystem: resolvedNumberingSystem,
        minimumFractionDigits: fractionLen,
        maximumFractionDigits: fractionLen,
      };
      f = new Intl.NumberFormat(
        resolvedLocale,
        currencyOk ? { style: "currency", currency, currencyDisplay, ...base } : base,
      );
      liveFormatters.set(fractionLen, f);
    }
    return f;
  }

  function editValue(raw: EditRaw): number | null {
    if (raw.intDigits === "" && raw.fracDigits === "") return null;
    const n = Number(
      (raw.negative ? "-" : "") + (raw.intDigits || "0") + "." + (raw.fracDigits || "0"),
    );
    return Number.isFinite(n) ? n : null;
  }

  function editPlain(raw: EditRaw): string {
    if (raw.intDigits === "" && raw.fracDigits === "" && !raw.hasDecimal) {
      return raw.negative ? "-" : "";
    }
    const body = raw.intDigits + (raw.hasDecimal ? "." + raw.fracDigits : "");
    return (raw.negative ? "-" : "") + body;
  }

  function formatEditing(raw: EditRaw): string {
    const { negative, intDigits, hasDecimal, fracDigits } = raw;
    if (intDigits === "" && fracDigits === "" && !hasDecimal) {
      return negative ? minusGlyph : "";
    }
    const fractionLen = Math.min(fracDigits.length, resolvedMaxFraction);
    const magnitude = Number((intDigits || "0") + "." + (fracDigits || "0"));
    const parts = liveNf(fractionLen).formatToParts(negative ? -magnitude : magnitude);

    // A trailing decimal separator with no fraction digits yet ("12,"): Intl
    // will not emit it at fraction length 0, so splice it in after the integer.
    if (hasDecimal && fractionLen === 0 && resolvedMaxFraction > 0) {
      let lastInt = -1;
      parts.forEach((p, i) => {
        if (p.type === "integer") lastInt = i;
      });
      let out = "";
      parts.forEach((p, i) => {
        out += p.value;
        if (i === lastInt) out += decimalSeparator;
      });
      return out;
    }

    return parts.map((p) => p.value).join("");
  }

  function insertionHasEditableChar(data: string, hasDecimal: boolean): boolean {
    const s = mapDigits(data);
    for (const ch of s) {
      if (ch >= "0" && ch <= "9") return true;
      if ((ch === "-" || ch === "−") && allowNegative) return true;
      if (isDecimalChar(ch) && ch !== groupSeparator && resolvedMaxFraction > 0 && !hasDecimal) {
        return true;
      }
    }
    return false;
  }

  function format(value: number | null): string {
    if (value == null || !Number.isFinite(value)) return "";
    return nf.format(value);
  }

  return {
    format,
    parse,
    sanitize,
    toEditable,
    extractEditing,
    formatEditing,
    editValue,
    editPlain,
    isSignificantChar,
    insertionHasEditableChar,
    locale: resolvedLocale,
    currency,
    decimalSeparator,
    groupSeparator,
    currencySymbol,
    maximumFractionDigits: resolvedMaxFraction,
  };
}
