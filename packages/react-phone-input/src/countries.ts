/**
 * The country table.
 *
 * Two decisions make the whole component 3.9 kB brotli, where the default
 * choice in this category is 41.1 kB.
 *
 * **No names.** `Intl.DisplayNames` already knows what "DE" is called in every
 * locale the runtime supports, and every engine ships that data. Bundling a
 * name table — which is what `libphonenumber-js` metadata and every locale JSON
 * in this space mostly *is* — pays for something the platform gives away.
 *
 * **No flag images.** A flag emoji is the two ISO 3166-1 letters shifted into
 * the Unicode regional-indicator block, so it is six bytes of arithmetic rather
 * than an icon font or 250 SVGs.
 *
 * What is left is the part the platform genuinely does not know: which calling
 * code belongs to which region, how long a national number is there, and how it
 * is conventionally grouped.
 *
 * The trade this makes against `libphonenumber-js` is stated plainly rather
 * than hidden: length-based *possibility*, not full *validity*. See `phone.ts`.
 */

/** One entry, after parsing. */
export interface Country {
  /** ISO 3166-1 alpha-2, uppercase. */
  iso2: string
  /** Calling code without the `+`. */
  dial: string
  /**
   * Accepted national-number lengths. Empty means "unknown here", and the
   * generic E.164 bounds apply instead.
   */
  lengths: number[]
  /** Conventional digit grouping, e.g. `[3, 3, 4]`. Empty means no convention known. */
  groups: number[]
}

/**
 * `iso2 dial [lengths] [groups]`, space-separated, one country per entry.
 *
 * Lengths and groups are optional and present for the regions that carry most
 * traffic; everything else falls back to the E.164 bounds and generic grouping,
 * which is a graceful degradation rather than a wrong answer.
 *
 * Ordered by calling code so that the shared-code groups (NANP on 1, Kazakhstan
 * and Russia on 7) sit together and stay easy to audit.
 */
const TABLE = `
US 1 10 3-3-4|CA 1 10 3-3-4|BS 1 10 3-3-4|BB 1 10 3-3-4|AI 1 10 3-3-4|AG 1 10 3-3-4
VG 1 10 3-3-4|VI 1 10 3-3-4|KY 1 10 3-3-4|BM 1 10 3-3-4|GD 1 10 3-3-4|TC 1 10 3-3-4
MS 1 10 3-3-4|MP 1 10 3-3-4|GU 1 10 3-3-4|AS 1 10 3-3-4|SX 1 10 3-3-4|LC 1 10 3-3-4
DM 1 10 3-3-4|VC 1 10 3-3-4|PR 1 10 3-3-4|DO 1 10 3-3-4|TT 1 10 3-3-4|KN 1 10 3-3-4
JM 1 10 3-3-4
EG 20 10 2-4-4|SS 211|MA 212 9|DZ 213 9|TN 216 8|LY 218|GM 220|SN 221|MR 222|ML 223
GN 224|CI 225|BF 226|NE 227|TG 228|BJ 229|MU 230|LR 231|SL 232|GH 233 9|NG 234 10
TD 235|CF 236|CM 237|CV 238|ST 239|GQ 240|GA 241|CG 242|CD 243|AO 244|GW 245|IO 246
AC 247|SC 248|SD 249|RW 250|ET 251|SO 252|DJ 253|KE 254 9|TZ 255 9|UG 256 9|BI 257
MZ 258|ZM 260|MG 261|RE 262|ZW 263|NA 264|MW 265|LS 266|BW 267|SZ 268|KM 269
ZA 27 9 2-3-4|SH 290|ER 291|AW 297|FO 298|GL 299
GR 30 10 3-3-4|NL 31 9 1-4-4|BE 32 9 3-2-2-2|FR 33 9 1-2-2-2-2|ES 34 9 3-3-3
GI 350|PT 351 9 3-3-3|LU 352|IE 353 9 2-3-4|IS 354 7|AL 355|MT 356|CY 357|FI 358 9
BG 359|HU 36 9 1-3-3-2|LT 370|LV 371|EE 372|MD 373|AM 374|BY 375|AD 376|MC 377
SM 378|VA 379|UA 380 9|RS 381|ME 382|XK 383|HR 385 9|SI 386|BA 387|MK 389
IT 39 9,10 3-3-4|RO 40 9 3-3-3|CH 41 9 2-3-2-2|CZ 420 9 3-3-3|SK 421 9 3-3-3
LI 423|AT 43|GB 44 10 4-6|DK 45 8 2-2-2-2|SE 46 9 2-3-2-2|NO 47 8 3-2-3|PL 48 9 3-3-3
DE 49 10,11
FK 500|BZ 501|GT 502 8|SV 503 8|HN 504 8|NI 505 8|CR 506 8 4-4|PA 507 8 4-4|PM 508
HT 509|PE 51 9 3-3-3|MX 52 10 2-4-4|CU 53|AR 54 10 2-4-4|BR 55 11 2-5-4|CL 56 9 1-4-4
CO 57 10 3-3-4|VE 58 10|BO 591 8|GY 592|EC 593 9|GF 594|PY 595|MQ 596|SR 597|UY 598 8
CW 599
MY 60 9,10|AU 61 9 3-3-3|ID 62|PH 63 10 3-3-4|NZ 64 8,9|SG 65 8 4-4|TH 66 9 1-4-4
JP 81 10 2-4-4|KR 82 9,10 2-4-4|VN 84 9|CN 86 11 3-4-4
TR 90 10 3-3-2-2|IN 91 10 5-5|PK 92 10|AF 93|LK 94 9|MM 95|MV 960|LB 961|JO 962
SY 963|IQ 964|KW 965 8 4-4|SA 966 9 2-3-4|YE 967|OM 968 8 4-4|PS 970|AE 971 9 2-3-4
IL 972 9 2-3-4|BH 973 8 4-4|QA 974 8 4-4|BT 975|MN 976|NP 977|IR 98|TJ 992|TM 993
AZ 994|GE 995|KG 996|UZ 998
KZ 7 10|RU 7 10 3-3-2-2
HK 852 8 4-4|MO 853 8|KH 855|LA 856|BD 880 10|TW 886 9|MV 960
NF 672|PG 675|TO 676|SB 677|VU 678|FJ 679|PW 680|WF 681|CK 682|NU 683|WS 685|KI 686
NC 687|TV 688|PF 689|TK 690|FM 691|MH 692|NR 674|TL 670|BN 673
KP 850|TM 993
AQ 672|CX 61|CC 61
`

/** Generic E.164 bounds for a national number when the table has no lengths. */
export const MIN_NATIONAL_DIGITS = 4
export const MAX_NATIONAL_DIGITS = 15

function parseTable(): Country[] {
  const seen = new Set<string>()
  const countries: Country[] = []
  for (const entry of TABLE.split(/[|\n]/)) {
    const fields = entry.trim().split(/\s+/)
    const [iso2, dial, lengths, groups] = fields
    if (iso2 === undefined || dial === undefined || iso2 === '') continue
    // First entry wins. The table lists a few territories twice (Christmas and
    // Cocos islands both sit on +61, Antarctica shares +672 with Norfolk); a
    // duplicate ISO code would otherwise make lookups order-dependent.
    if (seen.has(iso2)) continue
    seen.add(iso2)
    countries.push({
      iso2,
      dial,
      lengths: lengths === undefined ? [] : lengths.split(',').map(Number),
      groups: groups === undefined ? [] : groups.split('-').map(Number),
    })
  }
  return countries
}

/** Every known country, in table order. */
export const COUNTRIES: Country[] = parseTable()

const BY_ISO2 = new Map(COUNTRIES.map((country) => [country.iso2, country]))

/** Look up a country by ISO 3166-1 alpha-2 code, case-insensitively. */
export function countryByISO2(iso2: string): Country | undefined {
  return BY_ISO2.get(iso2.toUpperCase())
}

/**
 * Calling codes, longest first.
 *
 * Order matters: `+1` and `+1868` are both valid prefixes, so a shortest-first
 * scan would resolve every Trinidadian number to the United States. Longest
 * first is the only order that can be scanned greedily.
 */
const DIALS_BY_LENGTH = [...new Set(COUNTRIES.map((country) => country.dial))].sort(
  (a, b) => b.length - a.length,
)

/**
 * The country a `+`-prefixed number belongs to.
 *
 * Ambiguous by construction: +1 covers 25 countries here and there is no way to
 * tell which from the calling code alone. The first table entry for a code wins
 * (the United States for +1, Russia for +7), which is what every phone field
 * does, and the caller can override with `country`.
 */
export function countryForDial(digits: string): Country | undefined {
  for (const dial of DIALS_BY_LENGTH) {
    if (digits.startsWith(dial)) {
      return COUNTRIES.find((country) => country.dial === dial)
    }
  }
  return undefined
}

/** Offset from an ASCII letter to its regional-indicator symbol. */
const REGIONAL_INDICATOR_OFFSET = 127397

/**
 * The flag emoji for an ISO 3166-1 alpha-2 code.
 *
 * Two regional-indicator symbols, which every modern platform renders as a
 * flag. No icon font, no sprite sheet, no 250 SVGs — and it inherits the
 * field's font-size for free.
 *
 * Windows is the known exception: it renders the two letters instead of a flag,
 * which is a legible fallback rather than a broken image.
 */
export function flagEmoji(iso2: string): string {
  const upper = iso2.toUpperCase()
  if (!/^[A-Z]{2}$/.test(upper)) return ''
  return String.fromCodePoint(
    ...Array.from(upper, (letter) => letter.charCodeAt(0) + REGIONAL_INDICATOR_OFFSET),
  )
}

/**
 * The localised country name, from the platform.
 *
 * `Intl.DisplayNames` ships with every engine, so this is free and correct in
 * every locale the runtime supports. Falls back to the ISO code, which is at
 * least unambiguous, if the API or the region is unknown.
 */
export function countryName(iso2: string, locale?: string): string {
  try {
    const names = new Intl.DisplayNames(locale === undefined ? undefined : [locale], {
      type: 'region',
    })
    // `?? iso2` is unreachable with the default `fallback: 'code'`, which makes
    // `of` return the code itself rather than undefined. Kept because the DOM
    // types allow undefined, and excluded from coverage rather than faked.
    /* v8 ignore next */
    return names.of(iso2.toUpperCase()) ?? iso2.toUpperCase()
  } catch {
    return iso2.toUpperCase()
  }
}
