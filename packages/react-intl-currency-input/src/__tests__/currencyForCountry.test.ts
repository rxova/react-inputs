import { describe, expect, it } from "vitest";
import { currencyForCountry } from "../currencyForCountry";

describe("currencyForCountry", () => {
  it("maps known countries", () => {
    expect(currencyForCountry("US")).toBe("USD");
    expect(currencyForCountry("BG")).toBe("BGN");
    expect(currencyForCountry("JP")).toBe("JPY");
    expect(currencyForCountry("KW")).toBe("KWD");
  });
  it("is case-insensitive", () => {
    expect(currencyForCountry("de")).toBe("EUR");
    expect(currencyForCountry("Fr")).toBe("EUR");
  });
  it("returns undefined for unknown or empty input rather than guessing", () => {
    expect(currencyForCountry("ZZ")).toBeUndefined();
    expect(currencyForCountry("")).toBeUndefined();
  });
});
