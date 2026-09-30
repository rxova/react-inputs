import { describe, expect, it } from "vitest";
import { createCurrencyFormatter } from "../intl";

/**
 * The cross-product suite: the *same* currency rendered in *many* languages, and
 * many currencies across many countries. It proves the two facts that make this
 * library correct:
 *
 *   1. the **language** controls the separators, symbol placement and digits;
 *   2. the **currency** controls the fraction-digit count — invariantly, in
 *      every language.
 *
 * Everything is asserted by round-trip and by structural comparison, never
 * against a hardcoded literal string, so an ICU version bump cannot flake it.
 */

const fmt = (locale: string, currency: string) => createCurrencyFormatter({ locale, currency });

interface CurrencyGroup {
  currency: string;
  fractionDigits: number;
  locales: string[];
}

// Each currency shown in a spread of languages — same money, different tongues.
const CURRENCIES: CurrencyGroup[] = [
  {
    currency: "USD",
    fractionDigits: 2,
    locales: [
      "en-US",
      "es-MX",
      "fr-CA",
      "de-DE",
      "ja-JP",
      "ar-EG",
      "hi-IN",
      "zh-CN",
      "ru-RU",
      "pt-BR",
      "en-IN",
    ],
  },
  {
    currency: "EUR",
    fractionDigits: 2,
    locales: [
      "de-DE",
      "fr-FR",
      "nl-NL",
      "it-IT",
      "es-ES",
      "bg-BG",
      "el-GR",
      "fi-FI",
      "ga-IE",
      "pt-PT",
      "nl-BE",
      "fr-BE",
    ],
  },
  { currency: "GBP", fractionDigits: 2, locales: ["en-GB", "en-US", "fr-FR", "de-DE", "cy-GB"] },
  { currency: "JPY", fractionDigits: 0, locales: ["ja-JP", "en-US", "de-DE", "fr-FR", "zh-CN"] },
  { currency: "CHF", fractionDigits: 2, locales: ["de-CH", "fr-CH", "it-CH", "en-US"] },
  { currency: "CAD", fractionDigits: 2, locales: ["en-CA", "fr-CA", "en-US"] },
  { currency: "INR", fractionDigits: 2, locales: ["hi-IN", "en-IN", "ta-IN", "en-US", "de-DE"] },
  { currency: "CNY", fractionDigits: 2, locales: ["zh-CN", "zh-Hant", "en-US", "ja-JP"] },
  { currency: "BRL", fractionDigits: 2, locales: ["pt-BR", "en-US", "de-DE"] },
  { currency: "KWD", fractionDigits: 3, locales: ["ar-KW", "en-US", "de-DE", "fr-FR"] },
  { currency: "BHD", fractionDigits: 3, locales: ["ar-BH", "en-US", "de-DE"] },
  { currency: "SEK", fractionDigits: 2, locales: ["sv-SE", "en-US", "de-DE"] },
  { currency: "PLN", fractionDigits: 2, locales: ["pl-PL", "en-US", "de-DE"] },
  { currency: "RUB", fractionDigits: 2, locales: ["ru-RU", "en-US", "uk-UA"] },
  { currency: "ILS", fractionDigits: 2, locales: ["he-IL", "ar-IL", "en-US"] },
  { currency: "BGN", fractionDigits: 2, locales: ["bg-BG", "en-US", "de-DE"] },
  { currency: "THB", fractionDigits: 2, locales: ["th-TH", "en-US"] },
  { currency: "KRW", fractionDigits: 0, locales: ["ko-KR", "en-US", "de-DE"] },
  { currency: "VND", fractionDigits: 0, locales: ["vi-VN", "en-US"] },
];

describe("the same currency, formatted in many languages", () => {
  for (const { currency, fractionDigits, locales } of CURRENCIES) {
    describe(`${currency} (${String(fractionDigits)} fraction digits)`, () => {
      it.each(locales)(`%s round-trips and keeps ${currency}'s fraction digits`, (locale) => {
        const f = fmt(locale, currency);

        // The currency, not the language, decides the fraction count.
        expect(f.maximumFractionDigits).toBe(fractionDigits);

        // An integer round-trips in every locale/currency pairing.
        expect(f.parse(f.format(1234567))).toBe(1234567);

        // …and so does a value carrying exactly the currency's fraction digits.
        const fractional =
          fractionDigits === 0 ? 7654321 : fractionDigits === 3 ? 1234.125 : 1234.5;
        expect(f.parse(f.format(fractional))).toBe(fractional);

        // The formatted string is never empty and never leaks a NaN.
        expect(f.format(1234567)).not.toBe("");
        expect(f.format(1234567)).not.toMatch(/nan/i);
      });
    });
  }
});

describe("fraction digits are set by the currency, never by the language", () => {
  const languages = [
    "en-US",
    "de-DE",
    "fr-FR",
    "ja-JP",
    "ar-EG",
    "hi-IN",
    "zh-CN",
    "ru-RU",
    "bg-BG",
  ];
  it.each([
    ["USD", 2],
    ["EUR", 2],
    ["GBP", 2],
    ["JPY", 0],
    ["KRW", 0],
    ["KWD", 3],
    ["BHD", 3],
  ] as const)("%s is always %i fraction digits, in every language", (currency, digits) => {
    for (const locale of languages) {
      expect(fmt(locale, currency).maximumFractionDigits).toBe(digits);
    }
  });
});

describe("same country, different official language", () => {
  const pairs = [
    { a: "de-CH", b: "fr-CH", currency: "CHF", country: "Switzerland" },
    { a: "en-CA", b: "fr-CA", currency: "CAD", country: "Canada" },
    { a: "nl-BE", b: "fr-BE", currency: "EUR", country: "Belgium" },
  ];

  it.each(pairs)(
    "$country ($currency): $a and $b format differently but both round-trip",
    ({ a, b, currency }) => {
      const fa = fmt(a, currency);
      const fb = fmt(b, currency);
      const amount = 1234567.89;

      // The language genuinely changes the rendering (separators or symbol side).
      expect(fa.format(amount)).not.toBe(fb.format(amount));

      // Yet both parse back to the same number.
      expect(fa.parse(fa.format(amount))).toBe(amount);
      expect(fb.parse(fb.format(amount))).toBe(amount);

      // And the shared currency keeps the same fraction count in both languages.
      expect(fa.maximumFractionDigits).toBe(fb.maximumFractionDigits);
    },
  );
});

describe("Indian lakh grouping vs western grouping", () => {
  it("groups INR in lakhs for Indian locales and in thousands elsewhere", () => {
    const enIN = fmt("en-IN", "INR");
    const hiIN = fmt("hi-IN", "INR");
    const enUS = fmt("en-US", "INR");

    // 12,34,567 (lakh) is not 1,234,567 (western), so the strings differ…
    expect(enIN.format(1234567)).not.toBe(enUS.format(1234567));
    // …but both Indian locales group the same way.
    expect(hiIN.format(1234567)).toBe(enIN.format(1234567));

    // All three still round-trip to the same number.
    for (const f of [enIN, hiIN, enUS]) {
      expect(f.parse(f.format(1234567))).toBe(1234567);
    }
  });
});

describe("a currency can be shown far from its home country", () => {
  // Displaying USD to a German user, JPY to an American, EUR to a Bulgarian…
  const exotic: [string, string, number][] = [
    ["de-DE", "USD", 1234567.89],
    ["ja-JP", "USD", 1234567.89],
    ["ar-EG", "USD", 50000.5],
    ["bg-BG", "JPY", 1234567],
    ["en-US", "BGN", 1234.56],
    ["fr-FR", "KWD", 1234.125],
    ["hi-IN", "EUR", 1234567.89],
    ["ru-RU", "GBP", 9999.99],
    ["zh-CN", "CHF", 1234567.89],
  ];
  it.each(exotic)("%s displaying %s round-trips", (locale, currency, value) => {
    const f = fmt(locale, currency);
    expect(f.parse(f.format(value))).toBe(value);
  });
});
