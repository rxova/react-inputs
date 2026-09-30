/**
 * Best-effort ISO-3166-1 alpha-2 country → ISO-4217 currency lookup.
 *
 * This is a **convenience for greenfield code, not a source of truth.** A
 * country → currency mapping rots: countries adopt the euro (Bulgaria in 2026 —
 * the very example this library was built around), run dual currencies, or peg
 * to another. Whenever you can, pass `currency` explicitly instead of relying on
 * this. It returns `undefined` for anything it doesn't know rather than
 * guessing.
 */
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  // Eurozone
  AT: "EUR",
  BE: "EUR",
  HR: "EUR",
  CY: "EUR",
  EE: "EUR",
  FI: "EUR",
  FR: "EUR",
  DE: "EUR",
  GR: "EUR",
  IE: "EUR",
  IT: "EUR",
  LV: "EUR",
  LT: "EUR",
  LU: "EUR",
  MT: "EUR",
  NL: "EUR",
  PT: "EUR",
  SK: "EUR",
  SI: "EUR",
  ES: "EUR",
  // Rest of Europe
  BG: "BGN",
  CZ: "CZK",
  DK: "DKK",
  HU: "HUF",
  PL: "PLN",
  RO: "RON",
  SE: "SEK",
  CH: "CHF",
  NO: "NOK",
  IS: "ISK",
  GB: "GBP",
  UA: "UAH",
  RS: "RSD",
  TR: "TRY",
  // Americas
  US: "USD",
  CA: "CAD",
  MX: "MXN",
  BR: "BRL",
  AR: "ARS",
  CL: "CLP",
  CO: "COP",
  PE: "PEN",
  UY: "UYU",
  // Asia-Pacific
  JP: "JPY",
  CN: "CNY",
  HK: "HKD",
  TW: "TWD",
  KR: "KRW",
  IN: "INR",
  ID: "IDR",
  MY: "MYR",
  SG: "SGD",
  TH: "THB",
  PH: "PHP",
  VN: "VND",
  AU: "AUD",
  NZ: "NZD",
  // Middle East & Africa
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  KW: "KWD",
  BH: "BHD",
  IL: "ILS",
  EG: "EGP",
  ZA: "ZAR",
  NG: "NGN",
  KE: "KES",
  MA: "MAD",
};

/**
 * Look up a likely currency for a country code. Best-effort — see the module
 * doc. Returns `undefined` when the country is unknown.
 *
 * @param country ISO-3166-1 alpha-2 code, case-insensitive (e.g. `'BG'`).
 */
export function currencyForCountry(country: string): string | undefined {
  if (!country) return undefined;
  return COUNTRY_TO_CURRENCY[country.toUpperCase()];
}
