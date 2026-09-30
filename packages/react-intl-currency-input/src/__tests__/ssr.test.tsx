import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CurrencyInput } from "../CurrencyInput";

/**
 * Runs in the node project, where `window` genuinely does not exist. The README
 * claims SSR safety; without this file that claim is untested. An idle field
 * renders its *formatted* value server-side, so hydration has nothing to
 * correct and there is no flash of an unformatted number.
 */
describe("server rendering", () => {
  it("renders a text input with a decimal keypad hint", () => {
    const html = renderToStaticMarkup(
      <CurrencyInput locale="en-US" currency="USD" value={1234.5} />,
    );
    expect(html).toContain('type="text"');
    expect(html).toMatch(/inputmode="decimal"/i);
  });

  it("renders the formatted value into the input, not a raw number", () => {
    const html = renderToStaticMarkup(
      <CurrencyInput locale="en-US" currency="USD" value={1234.5} />,
    );
    // minimumFractionDigits defaults to 0, so no forced trailing zero.
    expect(html).toContain("$1,234.5");
  });

  it("honors minimumFractionDigits for forced trailing zeros", () => {
    const html = renderToStaticMarkup(
      <CurrencyInput locale="en-US" currency="USD" value={1234.5} minimumFractionDigits={2} />,
    );
    expect(html).toContain("$1,234.50");
  });

  it('renders an empty value as an empty field, never "0"', () => {
    const html = renderToStaticMarkup(<CurrencyInput locale="en-US" currency="USD" value={null} />);
    expect(html).toContain('value=""');
  });

  it("does not throw for a spread of tricky locale/currency pairs", () => {
    const pairs: [string, string][] = [
      ["bg-BG", "EUR"],
      ["de-DE", "EUR"],
      ["ja-JP", "JPY"],
      ["ar-EG", "EGP"],
      ["hi-IN", "INR"],
      ["de-CH", "CHF"],
    ];
    for (const [locale, currency] of pairs) {
      expect(() =>
        renderToStaticMarkup(<CurrencyInput locale={locale} currency={currency} value={50000} />),
      ).not.toThrow();
    }
  });

  it("marks an invalid field for assistive tech", () => {
    const html = renderToStaticMarkup(
      <CurrencyInput locale="en-US" currency="USD" value={1} invalid />,
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("data-invalid");
  });
});
