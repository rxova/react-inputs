import { describe, expect, it } from 'vitest'
import { STRENGTH_LABELS, estimateStrength } from '../strength'

/**
 * The estimator is a pure function, so it is tested as one: no DOM, no React,
 * no browser cost. The assertions are deliberately about *ordering and
 * bucketing* rather than exact bit counts wherever the exact number is an
 * implementation detail — pinning every entropy figure would make any future
 * tuning a 40-line test diff for no added confidence.
 */
describe('estimateStrength', () => {
  it('scores an empty password as unusable and short', () => {
    expect(estimateStrength('')).toEqual({
      score: 0,
      entropy: 0,
      penalties: ['too-short'],
      effectiveLength: 0,
    })
  })

  it('climbs through every bucket as length and variety grow', () => {
    const ladder = [
      'a',
      'ab7x',
      'ab7xQ!',
      'ab7xQ!z',
      'k4Tm9pR2',
      'k4Tm9pR2wZ',
      'k4Tm9pR2wZ!vQ',
      'k4Tm9pR2wZ!vQ8yBn#Lm',
    ]
    const scores = ladder.map((password) => estimateStrength(password).score)
    // Monotonic: a longer, more varied password never scores lower.
    expect(scores).toEqual([...scores].sort((a, b) => a - b))
    expect(scores.at(0)).toBe(0)
    expect(scores.at(-1)).toBe(4)
  })

  it('covers all five buckets across the ladder', () => {
    const seen = new Set(
      ['a', 'ab7xQ!', 'k4Tm9pR2', 'k4Tm9pR2wZ!vQ', 'k4Tm9pR2wZ!vQ8yBn#Lm'].map(
        (p) => estimateStrength(p).score,
      ),
    )
    expect(seen.size).toBeGreaterThanOrEqual(4)
  })

  describe('penalties', () => {
    it('flags a password under the configured minimum and caps its score', () => {
      // Seven characters of genuine variety: enough entropy to bucket at 2 or
      // more, but the length floor is the product's decision and wins.
      const short = estimateStrength('xK7#mQ2', { minLength: 8 })
      expect(short.penalties).toContain('too-short')
      expect(short.score).toBeLessThanOrEqual(1)
      // The same string with a lower floor is no longer short and scores freely.
      const allowed = estimateStrength('xK7#mQ2', { minLength: 4 })
      expect(allowed.penalties).not.toContain('too-short')
      expect(allowed.score).toBeGreaterThan(short.score)
    })

    it('flags a single character class only while the password is short', () => {
      expect(estimateStrength('abcdefgh').penalties).toContain('single-class')
      // Past twelve characters, length is doing the work and the class count
      // stops being the interesting fact about the password.
      expect(estimateStrength('abcdefghijklmnop').penalties).not.toContain('single-class')
    })

    it('flags repeated characters and discounts the tail of the run', () => {
      const result = estimateStrength('aaaaaaaaaaaa')
      expect(result.penalties).toContain('repeated-characters')
      // Twelve characters, but only the first two are a real choice.
      expect(result.effectiveLength).toBeLessThan(6)
    })

    it('flags ascending and descending codepoint runs alike', () => {
      expect(estimateStrength('abcdefgh').penalties).toContain('sequential-characters')
      expect(estimateStrength('hgfedcba').penalties).toContain('sequential-characters')
      expect(estimateStrength('987654321').penalties).toContain('sequential-characters')
    })

    it('does not treat a two-character run as a pattern', () => {
      // `ab` is a run of two, which is under MIN_RUN and must not be discounted.
      const result = estimateStrength('ab!7Qz#mXp')
      expect(result.penalties).not.toContain('sequential-characters')
      expect(result.effectiveLength).toBe(10)
    })

    it('flags keyboard walks that codepoint arithmetic cannot see', () => {
      // `asdf` is four apart in ASCII in no consistent direction, but adjacent
      // under the fingers.
      expect(estimateStrength('asdf9Q!zX').penalties).toContain('sequential-characters')
      // Backwards along the row, too.
      expect(estimateStrength('fdsa9Q!zX').penalties).toContain('sequential-characters')
    })

    it('does not flag a three-key fragment as a walk', () => {
      expect(estimateStrength('asd9Q!zXmv2').penalties).not.toContain('sequential-characters')
    })

    it('flags corpus staples and floors their entropy however long they are', () => {
      for (const password of ['password', 'letmein', 'iloveyou', 'trustno1']) {
        expect(estimateStrength(password).penalties).toContain('blocklisted')
        expect(estimateStrength(password).score).toBe(0)
      }
      // Length does not rescue a blocklisted substring.
      const padded = estimateStrength('password-password-password')
      expect(padded.penalties).toContain('blocklisted')
      expect(padded.score).toBe(0)
    })

    it('sees through leet substitutions', () => {
      expect(estimateStrength('P4ssw0rd').penalties).toContain('blocklisted')
      expect(estimateStrength('l3tm3in').penalties).toContain('blocklisted')
      expect(estimateStrength('@dmin').penalties).toContain('blocklisted')
    })

    it('accepts a caller-supplied blocklist', () => {
      const result = estimateStrength('AcmeCorp2026!', { blocklist: ['acmecorp'] })
      expect(result.penalties).toContain('blocklisted')
      expect(result.score).toBe(0)
    })

    it('ignores blocklist entries too short to be meaningful', () => {
      // A two-character entry would match almost everything.
      expect(estimateStrength('xK9#mQ2wLp', { blocklist: ['xk'] }).penalties).not.toContain(
        'blocklisted',
      )
    })

    it('penalises a password built from what the user already typed', () => {
      const result = estimateStrength('Kruszewski2026!', {
        userInputs: ['jonakrusze@gmail.com', 'Jonatan Kruszewski'],
      })
      expect(result.penalties).toContain('contains-user-input')
      expect(result.entropy).toBeLessThanOrEqual(20)
    })

    it('splits emails and names into the tokens an attacker would try', () => {
      // The whole string never appears in the password; the token does.
      expect(
        estimateStrength('gmail-9x!Qz', { userInputs: ['jonakrusze@gmail.com'] }).penalties,
      ).toContain('contains-user-input')
    })

    it('ignores user-input tokens shorter than three characters', () => {
      expect(estimateStrength('xK9#mQ2wLp', { userInputs: ['a b c'] }).penalties).not.toContain(
        'contains-user-input',
      )
    })

    it('orders penalties by impact, not by discovery', () => {
      const result = estimateStrength('password', { userInputs: ['password'] })
      expect(result.penalties.indexOf('blocklisted')).toBeLessThan(
        result.penalties.indexOf('contains-user-input'),
      )
    })
  })

  describe('character pool', () => {
    it('rewards spanning more classes at equal length', () => {
      const lower = estimateStrength('mqxzbvkw').entropy
      const mixed = estimateStrength('mQxZbVkW').entropy
      const symbols = estimateStrength('mQ#zbV2W').entropy
      expect(mixed).toBeGreaterThan(lower)
      expect(symbols).toBeGreaterThan(mixed)
    })

    it('counts non-ASCII characters without overstating them', () => {
      const result = estimateStrength('日本語のパスワード')
      expect(result.score).toBeGreaterThan(0)
      // Nine characters from a 100-symbol pool is ~60 bits — good, not
      // automatically maximal.
      expect(result.entropy).toBeLessThan(70)
    })

    it('measures length in codepoints, not UTF-16 code units', () => {
      // Four glyphs, eight code units. It must still read as four characters.
      expect(estimateStrength('🔐🔑🗝️🛡️', { minLength: 8 }).penalties).toContain('too-short')
    })
  })

  it('is stable — the same password always produces the same verdict', () => {
    const once = estimateStrength('k4Tm9pR2wZ')
    const twice = estimateStrength('k4Tm9pR2wZ')
    expect(once).toEqual(twice)
  })

  it('rounds the reported numbers so the UI is not rendering float dust', () => {
    const { entropy, effectiveLength } = estimateStrength('aaaaaaa')
    expect(entropy).toBe(Math.round(entropy * 100) / 100)
    expect(effectiveLength).toBe(Math.round(effectiveLength * 100) / 100)
  })
})

describe('STRENGTH_LABELS', () => {
  it('has one caption per bucket', () => {
    expect(STRENGTH_LABELS).toHaveLength(5)
    expect(STRENGTH_LABELS[estimateStrength('').score]).toBe('Very weak')
  })
})
