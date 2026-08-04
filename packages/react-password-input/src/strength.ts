import type { PasswordPenaltyCode, PasswordScore, PasswordStrength } from './types'

/**
 * A ~1 kB entropy estimator.
 *
 * The incumbent in this space is zxcvbn, which is excellent and costs ~350 kB
 * minified + brotli (measured, not quoted) because it ships wordlists. That trade is right for a password *auditor* and
 * wrong for a signup form: the meter is a nudge, not an authorisation decision,
 * and the real defences (length floor, breach-corpus check, rate limiting) live
 * elsewhere. So this estimator models the four things a wordlist-free estimator
 * can model honestly — character pool, length, structural repetition, and
 * explicitly supplied context — and gets out of the way. The `estimate` prop
 * swaps in zxcvbn for anyone who wants the wordlists.
 *
 * Everything here is a pure function of its arguments. No `Date`, no
 * `Math.random`, no locale: the same password always scores the same, which is
 * what makes the buckets testable and the meter non-flickery.
 */

/**
 * The character classes a password can draw from, and how many symbols each
 * one adds to the pool.
 *
 * Code-point predicates rather than regex literals. The punctuation class in
 * particular is four disjoint ASCII ranges, and written as a character class it
 * is line noise that one careless escape turns into something else entirely.
 */
const CLASSES: readonly (readonly [(code: number) => boolean, number])[] = [
  [(code) => code >= 97 && code <= 122, 26], // a-z
  [(code) => code >= 65 && code <= 90, 26], // A-Z
  [(code) => code >= 48 && code <= 57, 10], // 0-9
  // Space (32) plus the punctuation runs between the alphanumerics:
  // 33-47, 58-64, 91-96, 123-126.
  [
    (code) =>
      code === 32 ||
      (code >= 33 && code <= 47) ||
      (code >= 58 && code <= 64) ||
      (code >= 91 && code <= 96) ||
      (code >= 123 && code <= 126),
    33,
  ],
  // Anything outside ASCII. A deliberately conservative 100 rather than the
  // ~150k of Unicode: a user reaching for non-ASCII is picking from their own
  // keyboard layout, not from the whole codespace, and overstating this would
  // let a short emoji password score as "strong".
  [(code) => code > 127, 100],
]

/**
 * Weight of each character past the second in a detected run. Not zero: `aaaa`
 * is genuinely harder to guess than `aa`, just not twice as hard. Not one: that
 * would mean `aaaaaaaaaaaa` scored like a 12-character password.
 */
const RUN_TAIL_WEIGHT = 0.35

/** Minimum length of a repeat/sequence before it counts as a run. */
const MIN_RUN = 3

/**
 * Keyboard walks, which codepoint arithmetic cannot see: `q` and `w` are six
 * apart in ASCII but adjacent under the fingers. Rows only — full graph
 * adjacency is what wordlist-scale estimators are for.
 */
const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890', 'azertyuiop', 'qwertz']

/** Shortest keyboard-walk substring that counts. `asd` is noise; `asdf` is a pattern. */
const MIN_WALK = 4

/**
 * The passwords that dominate every breach corpus. Deliberately tiny — this is
 * a smoke alarm, not a wordlist. Anything more serious belongs behind
 * `checkCompromised`, where it can query a real corpus without shipping one.
 */
const COMMON = [
  'password',
  'passwort',
  'contrasena',
  '123456',
  '12345678',
  '123456789',
  'qwerty',
  'qwertyuiop',
  'azerty',
  'letmein',
  'welcome',
  'admin',
  'administrator',
  'iloveyou',
  'monkey',
  'dragon',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'superman',
  'batman',
  'trustno1',
  'starwars',
  'whatever',
  'shadow',
  'master',
  'michael',
  'jennifer',
  'jordan',
  'hunter',
  'freedom',
  'ninja',
  'access',
  'flower',
  'charlie',
  'donald',
  'pokemon',
  'samsung',
  'google',
  'facebook',
  'abc123',
  'changeme',
  'default',
  'secret',
  'login',
  'guest',
  'root',
  'toor',
]

/** Entropy thresholds, in bits, for scores 1 through 4. */
const BUCKETS = [28, 36, 60, 80]

/** Reported before the codes that merely explain a lower number. */
const PENALTY_ORDER: PasswordPenaltyCode[] = [
  'blocklisted',
  'contains-user-input',
  'too-short',
  'sequential-characters',
  'repeated-characters',
  'single-class',
]

/** Leet substitutions, so `P4ssw0rd` is recognised as `password`. */
const LEET: Record<string, string> = {
  '4': 'a',
  '@': 'a',
  '3': 'e',
  '1': 'i',
  '!': 'i',
  '0': 'o',
  '5': 's',
  $: 's',
  '7': 't',
  '+': 't',
}

/** Shortest token worth searching for inside the password. */
const MIN_TOKEN = 3

export interface EstimateStrengthOptions {
  /** Extra low-entropy strings to reject, e.g. your product name. */
  blocklist?: string[]
  /** Email, username, display name — anything the attacker already knows. */
  userInputs?: string[]
  /** Length below which `too-short` is reported and the score is capped. @default 8 */
  minLength?: number
}

/** Lowercase and undo leet substitutions, so lookups see the underlying word. */
function normalize(password: string): string {
  let out = ''
  for (const char of password.toLowerCase()) out += LEET[char] ?? char
  return out
}

/**
 * The code point of a single-character string.
 *
 * Only ever called with a character taken from iterating a string, so it is
 * never empty — but `codePointAt` is typed as possibly-undefined and a
 * non-null assertion here would be noise repeated a dozen times.
 */
function codePoint(char: string): number {
  return char.codePointAt(0) ?? 0
}

/**
 * Split into characters, not UTF-16 code units.
 *
 * `Array.from` rather than `[...string]` only because the repo's lint config
 * flags the spread form; the two iterate identically, by code point.
 */
function characters(value: string): string[] {
  return Array.from(value)
}

/** Size of the alphabet the password draws from, and how many classes it spans. */
function poolSize(password: string): { pool: number; classes: number } {
  let pool = 0
  let classes = 0
  for (const [matches, size] of CLASSES) {
    for (const char of password) {
      if (matches(codePoint(char))) {
        pool += size
        classes++
        break
      }
    }
  }
  return { pool, classes }
}

/**
 * Length after discounting repeats and plus/minus-one codepoint runs.
 *
 * Walks the string once, greedily consuming each run. A run of `n >= MIN_RUN`
 * counts as `2 + (n - 2) * RUN_TAIL_WEIGHT` — the first two characters are a
 * real choice, the rest follow from them.
 */
function collapse(password: string): {
  effectiveLength: number
  repeated: boolean
  sequential: boolean
} {
  const chars = characters(password)
  let effectiveLength = 0
  let repeated = false
  let sequential = false
  let i = 0

  while (i < chars.length) {
    const first = chars[i]
    const second = chars[i + 1]
    let runLength = 1

    if (first !== undefined && second !== undefined) {
      const delta = codePoint(second) - codePoint(first)
      if (delta === 0 || delta === 1 || delta === -1) {
        runLength = 2
        while (i + runLength < chars.length) {
          const previous = chars[i + runLength - 1]
          const next = chars[i + runLength]
          if (previous === undefined || next === undefined) break
          if (codePoint(next) - codePoint(previous) !== delta) break
          runLength++
        }
        if (runLength >= MIN_RUN) {
          if (delta === 0) repeated = true
          else sequential = true
        }
      }
    }

    effectiveLength += runLength >= MIN_RUN ? 2 + (runLength - 2) * RUN_TAIL_WEIGHT : runLength
    i += runLength
  }

  return { effectiveLength, repeated, sequential }
}

/** True when the password contains a run of `MIN_WALK`+ adjacent keyboard keys. */
function hasKeyboardWalk(normalized: string): boolean {
  for (const row of KEYBOARD_ROWS) {
    const reversed = characters(row).reverse().join('')
    for (let start = 0; start + MIN_WALK <= row.length; start++) {
      if (normalized.includes(row.slice(start, start + MIN_WALK))) return true
      if (normalized.includes(reversed.slice(start, start + MIN_WALK))) return true
    }
  }
  return false
}

/**
 * Split `email@example.com` / `first.last` into the tokens an attacker would
 * actually try, rather than testing the whole string and matching nothing.
 */
function tokenize(inputs: string[]): string[] {
  const tokens: string[] = []
  for (const input of inputs) {
    // Split first, normalize second. The other order runs the leet table over
    // the delimiters — `@` becomes `a` — so `jonakrusze@gmail.com` collapses to
    // the single token `jonakruszeagmail` and the `gmail` an attacker would
    // actually try never appears in the list.
    for (const raw of input.toLowerCase().split(/[^a-z0-9]+/)) {
      const token = normalize(raw)
      if (token.length >= MIN_TOKEN) tokens.push(token)
    }
  }
  return tokens
}

/**
 * Score a password. Pure, synchronous, and stable: the same string always
 * produces the same verdict.
 *
 * The entropy figure is a *comparator*, not a security claim — see
 * {@link PasswordStrength.entropy}.
 */
export function estimateStrength(
  password: string,
  options: EstimateStrengthOptions = {},
): PasswordStrength {
  const { blocklist = [], userInputs = [], minLength = 8 } = options

  if (password === '') {
    return { score: 0, entropy: 0, penalties: ['too-short'], effectiveLength: 0 }
  }

  const lowered = password.toLowerCase()
  const normalized = normalize(password)
  const { pool, classes } = poolSize(password)
  const { effectiveLength, repeated, sequential } = collapse(password)

  const found = new Set<PasswordPenaltyCode>()
  if (repeated) found.add('repeated-characters')
  // Both forms again: the number row only survives in `lowered` (the leet table
  // rewrites its digits into letters), while a walk typed as `@sdf` only
  // surfaces in `normalized`.
  if (sequential || hasKeyboardWalk(lowered) || hasKeyboardWalk(normalized)) {
    found.add('sequential-characters')
  }
  if (classes === 1 && password.length < 12) found.add('single-class')
  if (characters(password).length < minLength) found.add('too-short')

  // Both forms are searched, because normalizing is lossy in the direction
  // that matters here. `P4ssw0rd` only matches `password` after the leet table
  // runs; `trustno1` and `abc123` only match *before* it runs, since the table
  // rewrites their own digits (`1` to `i`, `3` to `e`) out of existence. One
  // pass over either string alone silently misses half the corpus.
  const contains = (entry: string): boolean =>
    entry.length >= MIN_TOKEN && (lowered.includes(entry) || normalized.includes(entry))

  if ([...COMMON, ...blocklist.map((entry) => entry.toLowerCase())].some(contains)) {
    found.add('blocklisted')
  }

  if (tokenize(userInputs).some(contains)) found.add('contains-user-input')

  // log2 of a one-symbol pool is 0, which would make every entropy 0. A pool
  // that small is already the bottom bucket, so floor it at two symbols.
  let entropy = effectiveLength * Math.log2(Math.max(2, pool))

  // Caps rather than subtractions. A password that literally contains a corpus
  // entry has no meaningful entropy however long it is, and `Tr0ub4dor&3` being
  // eleven characters does not help once the word itself is in the list.
  if (found.has('blocklisted')) entropy = Math.min(entropy, 8)
  if (found.has('contains-user-input')) entropy = Math.min(entropy, 20)

  let score: PasswordScore = 0
  for (let bucket = 0; bucket < BUCKETS.length; bucket++) {
    const threshold = BUCKETS[bucket]
    if (threshold !== undefined && entropy >= threshold) score = (bucket + 1) as PasswordScore
  }

  // A password under the configured floor cannot be presented as acceptable,
  // however exotic its characters: the floor is the product's decision and the
  // meter must not appear to overrule it.
  if (found.has('too-short') && score > 1) score = 1

  return {
    score,
    entropy: Math.round(entropy * 100) / 100,
    penalties: PENALTY_ORDER.filter((code) => found.has(code)),
    effectiveLength: Math.round(effectiveLength * 100) / 100,
  }
}

/** Default meter captions, indexed by score. */
export const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'] as const
