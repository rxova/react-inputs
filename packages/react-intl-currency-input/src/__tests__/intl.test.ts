import { describe, expect, it } from "vitest";
import { createCurrencyFormatter, resolveLocale, findPart } from "../intl";

/**
 * The engine is the product, so this is the largest suite. It asserts behaviour
 * via round-trips and via separators the formatter itself reports — never
 * against a hardcoded literal space, because ICU changes which space character a
 * locale uses between releases and a literal assertion would flake on a Node
 * bump. (See CONTRIBUTING: "assert via derived separators, never literals".)
 */

const fmt = (locale: string, currency: string, opts = {}) =>
  createCurrencyFormatter({ locale, currency, ...opts });

describe("resolveLocale", () => {
  it("prefers an explicit locale", () => {
    expect(resolveLocale("bg-BG", "en", "US")).toBe("bg-BG");
  });
  it("combines language + country", () => {
    expect(resolveLocale(undefined, "bg", "BG")).toBe("bg-BG");
  });
  it("accepts language alone", () => {
    expect(resolveLocale(undefined, "de")).toBe("de");
  });
  it("returns undefined when nothing is given", () => {
    expect(resolveLocale()).toBeUndefined();
  });
});

describe("derived separators", () => {
  it("bg-BG uses a whitespace group separator and a comma decimal", () => {
    const f = fmt("bg-BG", "EUR");
    expect(f.groupSeparator).toMatch(/\s/);
    expect(f.decimalSeparator).toBe(",");
  });
  it("de-DE uses a dot group separator and a comma decimal", () => {
    const f = fmt("de-DE", "EUR");
    expect(f.groupSeparator).toBe(".");
    expect(f.decimalSeparator).toBe(",");
  });
  it("en-US uses a comma group separator and a dot decimal", () => {
    const f = fmt("en-US", "USD");
    expect(f.groupSeparator).toBe(",");
    expect(f.decimalSeparator).toBe(".");
  });
  it("fr-FR uses a whitespace group separator", () => {
    const f = fmt("fr-FR", "EUR");
    expect(f.groupSeparator).toMatch(/\s/);
    expect(f.decimalSeparator).toBe(",");
  });
  it("de-CH uses an apostrophe-like group separator", () => {
    const f = fmt("de-CH", "CHF");
    expect(f.groupSeparator).not.toBe("");
    expect(f.groupSeparator).not.toMatch(/\s/);
  });
});

describe("fraction digits come from the currency", () => {
  it("JPY has none", () => {
    expect(fmt("ja-JP", "JPY").maximumFractionDigits).toBe(0);
  });
  it("EUR has two", () => {
    expect(fmt("de-DE", "EUR").maximumFractionDigits).toBe(2);
  });
  it("KWD has three", () => {
    expect(fmt("ar-KW", "KWD").maximumFractionDigits).toBe(3);
  });
  it("an explicit cap overrides the currency default", () => {
    expect(fmt("en-US", "USD", { maximumFractionDigits: 0 }).maximumFractionDigits).toBe(0);
  });
});

describe("round-trips: parse(format(n)) === n", () => {
  const matrix: [string, string, number][] = [
    ["en-US", "USD", 1234567.89],
    ["de-DE", "EUR", 1234567.89],
    ["fr-FR", "EUR", 1234567.89],
    ["bg-BG", "EUR", 1234567.89],
    ["bg-BG", "EUR", 5000],
    ["bg-BG", "EUR", 50000],
    ["de-CH", "CHF", 1234567.89],
    ["hi-IN", "INR", 1234567.89],
    ["ja-JP", "JPY", 1234567],
    ["ar-EG", "EGP", 50000.5],
    ["ar-KW", "KWD", 1234.567],
    ["en-US", "USD", 0],
    ["de-DE", "EUR", 0.09],
  ];
  it.each(matrix)("%s / %s / %d", (locale, currency, n) => {
    const f = fmt(locale, currency);
    expect(f.parse(f.format(n))).toBe(n);
  });
});

describe("the Bulgarian grouping quirk (the headline case)", () => {
  const f = fmt("bg-BG", "EUR");
  it("does not group a four-digit thousands value", () => {
    // 5000 must render its digits contiguously — no separator below 10000.
    // (Can't assert "no group char" directly: bg-BG's symbol spacing is the
    // same NBSP as its group separator. Contiguous digits is the real proof.)
    expect(f.format(5000)).toContain("5000");
  });
  it("does group a five-digit value", () => {
    // 50000 must have the group separator inside the digit run.
    expect(f.format(50000)).toContain(`50${f.groupSeparator}000`);
    expect(f.format(50000)).not.toContain("50000");
  });
  it("parses both back to the same number", () => {
    expect(f.parse(f.format(5000))).toBe(5000);
    expect(f.parse(f.format(50000))).toBe(50000);
  });
});

describe("parse strips non-ASCII group separators", () => {
  it("fr-FR narrow no-break space", () => {
    const f = fmt("fr-FR", "EUR");
    // Force the exact separator the formatter reports into a raw string.
    const raw = `1${f.groupSeparator}234${f.groupSeparator}567${f.decimalSeparator}89`;
    expect(f.parse(raw)).toBe(1234567.89);
  });
  it("bg-BG no-break space", () => {
    const f = fmt("bg-BG", "EUR");
    const raw = `50${f.groupSeparator}000`;
    expect(f.parse(raw)).toBe(50000);
  });
});

describe("native numbering systems", () => {
  it("ar-EG formats with non-ASCII digits by default", () => {
    const f = fmt("ar-EG", "EGP");
    expect(f.format(12345)).not.toMatch(/12345/);
  });
  it("parses native digits back to a number", () => {
    const f = fmt("ar-EG", "EGP");
    expect(f.parse(f.format(12345))).toBe(12345);
  });
  it("numberingSystem: latn forces ASCII digits", () => {
    const f = fmt("ar-EG", "EGP", { numberingSystem: "latn" });
    expect(f.format(12345)).toMatch(/12.?345/);
  });
});

describe("sanitize (the editable string while typing)", () => {
  it("keeps only digits and one decimal separator", () => {
    const f = fmt("en-US", "USD");
    expect(f.sanitize("1a2b3.4c5")).toBe("123.45");
  });
  it("collapses multiple decimal separators to the first", () => {
    const f = fmt("en-US", "USD");
    expect(f.sanitize("1.2.3")).toBe("1.23");
  });
  it("clamps fraction digits to the currency maximum", () => {
    const f = fmt("en-US", "USD");
    expect(f.sanitize("1.23456")).toBe("1.23");
  });
  it("drops the decimal entirely for a zero-fraction currency", () => {
    const f = fmt("ja-JP", "JPY");
    expect(f.sanitize("1234.56")).toBe("1234");
  });
  it("uses the locale decimal separator", () => {
    const f = fmt("de-DE", "EUR");
    expect(f.sanitize("1234,56")).toBe("1234,56");
  });
  it("accepts '.' as an alias when it is not the group separator", () => {
    const f = fmt("fr-FR", "EUR"); // decimal ',', group is a space — '.' is free
    expect(f.sanitize("1234.5")).toBe("1234,5");
  });
  it("does not alias '.' when it IS the group separator (de-DE)", () => {
    const f = fmt("de-DE", "EUR"); // group '.', decimal ','
    expect(f.sanitize("1.234")).toBe("1234");
  });
  it("drops a negative sign when allowNegative is false", () => {
    const f = fmt("en-US", "USD");
    expect(f.sanitize("-5")).toBe("5");
  });
  it("keeps a leading negative sign when allowNegative is true", () => {
    const f = fmt("en-US", "USD", { allowNegative: true });
    expect(f.sanitize("-5.5")).toBe("-5.5");
  });
});

describe("parse edge cases", () => {
  const f = fmt("en-US", "USD");
  it("empty string is null", () => {
    expect(f.parse("")).toBeNull();
  });
  it("whitespace only is null", () => {
    expect(f.parse("   ")).toBeNull();
  });
  it("a lone decimal separator is null", () => {
    expect(f.parse(".")).toBeNull();
  });
  it("drops a negative sign when allowNegative is false", () => {
    expect(f.parse("-42")).toBe(42);
  });
  it("keeps the sign when allowNegative is true", () => {
    expect(
      createCurrencyFormatter({ locale: "en-US", currency: "USD", allowNegative: true }).parse(
        "-42",
      ),
    ).toBe(-42);
  });
  it("rejects a digit sequence too large for a finite number", () => {
    expect(f.parse("9".repeat(400))).toBeNull();
  });
});

describe("toEditable", () => {
  it("renders a plain number with the locale decimal separator", () => {
    expect(fmt("de-DE", "EUR").toEditable(1234.5)).toBe("1234,5");
  });
  it("null and non-finite become empty", () => {
    const f = fmt("en-US", "USD");
    expect(f.toEditable(null)).toBe("");
    expect(f.toEditable(Number.NaN)).toBe("");
    expect(f.toEditable(Number.POSITIVE_INFINITY)).toBe("");
  });
});

describe("format", () => {
  it('null and non-finite become empty (never "0", never a crash)', () => {
    const f = fmt("en-US", "USD");
    expect(f.format(null)).toBe("");
    expect(f.format(Number.NaN)).toBe("");
  });
  it("formats zero as a real currency string", () => {
    expect(fmt("en-US", "USD").format(0)).toMatch(/0/);
  });
});

describe("resilience", () => {
  it("does not throw on an unknown currency code (falls back)", () => {
    expect(() => createCurrencyFormatter({ locale: "en-US", currency: "ZZ" })).not.toThrow();
    const f = createCurrencyFormatter({ locale: "en-US", currency: "ZZ" });
    expect(f.parse(f.format(1234.5))).toBe(1234.5);
  });
  it("falls back while still honoring an explicit fraction cap", () => {
    const f = createCurrencyFormatter({
      locale: "en-US",
      currency: "ZZ",
      maximumFractionDigits: 0,
    });
    expect(f.maximumFractionDigits).toBe(0);
    expect(f.sanitize("12.34")).toBe("12");
  });
  it("does not rethrow when the locale itself is invalid", () => {
    const f = createCurrencyFormatter({ locale: "not_a_locale", currency: "EUR" });
    expect(f.parse(f.format(1234.5))).toBe(1234.5);
  });
  it("normalizes an impossible fraction range in the fallback", () => {
    const f = createCurrencyFormatter({
      locale: "en-US",
      currency: "EUR",
      minimumFractionDigits: 4,
      maximumFractionDigits: 2,
    });
    expect(f.maximumFractionDigits).toBe(4);
    expect(f.parse(f.format(12.5))).toBe(12.5);
  });
  it("normalizes non-integer fallback fraction options", () => {
    const f = createCurrencyFormatter({
      locale: "not_a_locale",
      currency: "EUR",
      minimumFractionDigits: Number.NaN,
      maximumFractionDigits: Number.NaN,
    });
    expect(f.maximumFractionDigits).toBe(2);
  });
});

describe("findPart", () => {
  it("returns the requested part", () => {
    const nf = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
    expect(findPart(nf, 1234, "group")).toBe(",");
  });
  it("returns an empty string when the part is absent", () => {
    const nf = new Intl.NumberFormat("en-US");
    // A plain integer has no decimal, group (too small) or currency part.
    expect(findPart(nf, 5, "decimal")).toBe("");
    expect(findPart(nf, 5, "currency")).toBe("");
  });
});

describe("more parse and sanitize branches", () => {
  const f = fmt("en-US", "USD");
  it("treats null input as empty", () => {
    expect(f.parse(null)).toBeNull();
  });
  it("recognizes a U+2212 minus sign when allowNegative", () => {
    const neg = fmt("en-US", "USD", { allowNegative: true });
    expect(neg.parse("−42")).toBe(-42);
  });
  it("keeps a trailing decimal separator while typing", () => {
    expect(f.sanitize("5.")).toBe("5.");
  });
});
