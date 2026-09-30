import { describe, expect, it } from "vitest";
import { createCurrencyFormatter } from "../intl";
import type { EditRaw } from "../intl";

const f = (locale: string, currency: string, opts = {}) =>
  createCurrencyFormatter({ locale, currency, ...opts });

const raw = (
  intDigits: string,
  hasDecimal = false,
  fracDigits = "",
  negative = false,
): EditRaw => ({ negative, intDigits, hasDecimal, fracDigits });

describe("extractEditing", () => {
  it("reads plain integer digits", () => {
    expect(f("en-US", "USD").extractEditing("1234")).toEqual(raw("1234"));
  });
  it("strips leading zeros but keeps a lone zero", () => {
    expect(f("en-US", "USD").extractEditing("007").intDigits).toBe("7");
    expect(f("en-US", "USD").extractEditing("0").intDigits).toBe("0");
  });
  it("reads a decimal and clamps fraction digits to the currency max", () => {
    expect(f("en-US", "USD").extractEditing("12.3456")).toEqual(raw("12", true, "34"));
  });
  it("honors the locale decimal separator (de-DE comma)", () => {
    expect(f("de-DE", "EUR").extractEditing("1234,5")).toEqual(raw("1234", true, "5"));
  });
  it("strips its own group separators (de-DE dot)", () => {
    expect(f("de-DE", "EUR").extractEditing("1.234.567,8").intDigits).toBe("1234567");
  });
  it("strips a non-breaking-space group separator (fr-FR)", () => {
    const fr = f("fr-FR", "EUR");
    // Build the exact separators the formatter reports.
    const s = `1${fr.groupSeparator}234${fr.decimalSeparator}5`;
    expect(fr.extractEditing(s)).toEqual(raw("1234", true, "5"));
  });
  it("reads native digits (ar-EG) back to ASCII", () => {
    const ar = f("ar-EG", "EGP");
    expect(ar.extractEditing(ar.format(12345)).intDigits).toBe("12345");
  });
  it("drops the decimal for a zero-fraction currency (JPY)", () => {
    expect(f("ja-JP", "JPY").extractEditing("1234.5")).toEqual(raw("1234"));
  });
  it("reads a leading minus only when allowNegative", () => {
    expect(f("en-US", "USD").extractEditing("-12").negative).toBe(false);
    expect(f("en-US", "USD", { allowNegative: true }).extractEditing("-12").negative).toBe(true);
  });
});

describe("formatEditing", () => {
  it("groups the integer part live", () => {
    const en = f("en-US", "USD");
    expect(en.formatEditing(raw("1234567"))).toContain("1,234,567");
  });
  it("keeps a trailing decimal separator while typing", () => {
    const en = f("en-US", "USD");
    expect(en.formatEditing(raw("12", true, ""))).toContain("12.");
  });
  it("preserves trailing zeros from the typed fraction", () => {
    const en = f("en-US", "USD");
    expect(en.formatEditing(raw("1234", true, "50"))).toContain("1,234.50");
  });
  it("shows the Bulgarian space only above 9999", () => {
    const bg = f("bg-BG", "BGN");
    expect(bg.formatEditing(raw("5000"))).toContain("5000");
    expect(bg.formatEditing(raw("50000"))).toContain(`50${bg.groupSeparator}000`);
  });
  it("uses lakh grouping live (hi-IN)", () => {
    expect(f("hi-IN", "INR").formatEditing(raw("1234567"))).toContain("12,34,567");
  });
  it("renders an empty raw as an empty string", () => {
    expect(f("en-US", "USD").formatEditing(raw(""))).toBe("");
  });
  it("renders a lone minus while typing a negative", () => {
    const en = f("en-US", "USD", { allowNegative: true });
    expect(en.formatEditing(raw("", false, "", true))).toBe("-");
  });
  it("round-trips through parse for a spread of typed states", () => {
    const cases: [string, string, EditRaw][] = [
      ["en-US", "USD", raw("1234567", true, "89")],
      ["de-DE", "EUR", raw("1234", true, "5")],
      ["bg-BG", "BGN", raw("50000")],
      ["ja-JP", "JPY", raw("1234567")],
      ["hi-IN", "INR", raw("1234567", true, "89")],
      ["ar-EG", "EGP", raw("50000", true, "5")],
    ];
    for (const [locale, currency, r] of cases) {
      const fmt = f(locale, currency);
      expect(fmt.parse(fmt.formatEditing(r))).toBe(fmt.editValue(r));
    }
  });
});

describe("editValue", () => {
  it("builds the number from the canonical raw", () => {
    const en = f("en-US", "USD");
    expect(en.editValue(raw("1234", true, "5"))).toBe(1234.5);
    expect(en.editValue(raw("1234", true, "50"))).toBe(1234.5);
    expect(en.editValue(raw("", false, "", true))).toBeNull();
    expect(en.editValue(raw(""))).toBeNull();
  });
  it("applies the sign", () => {
    const en = f("en-US", "USD", { allowNegative: true });
    expect(en.editValue(raw("42", false, "", true))).toBe(-42);
  });
});

describe("isSignificantChar", () => {
  it("counts digits and the decimal separator, never the group separator", () => {
    const de = f("de-DE", "EUR"); // group '.', decimal ','
    expect(de.isSignificantChar("5")).toBe(true);
    expect(de.isSignificantChar(",")).toBe(true);
    expect(de.isSignificantChar(".")).toBe(false);
    const en = f("en-US", "USD"); // group ',', decimal '.'
    expect(en.isSignificantChar(".")).toBe(true);
    expect(en.isSignificantChar(",")).toBe(false);
  });
});

describe("typing simulation (re-extract on every keystroke, as live mode does)", () => {
  it("builds up a Bulgarian amount and reveals the space at 10000", () => {
    const bg = f("bg-BG", "BGN");
    const seen: string[] = [];
    for (const partial of ["5", "50", "500", "5000", "50000"]) {
      const r = bg.extractEditing(partial);
      seen.push(bg.formatEditing(r));
    }
    expect(seen[3]).toContain("5000"); // 5000 — no space
    expect(seen[4]).toContain(`50${bg.groupSeparator}000`); // 50 000 — space appears
  });
});
