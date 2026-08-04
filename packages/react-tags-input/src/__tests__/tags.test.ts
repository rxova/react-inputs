import { describe, expect, it } from 'vitest'
import { attempt, attemptAll, comparable, contains, length, sanitize, splitPasted } from '../tags'

/**
 * Pure list arithmetic, so these run in the node project. Everything here is a
 * function of its arguments, which is what lets a consumer re-run the same
 * rules on the server against whatever the field submitted.
 */
describe('length', () => {
  it('counts codepoints, not UTF-16 code units', () => {
    // `.length` would say 8 for four emoji, and a `maxLength` of 5 would then
    // refuse a four-character tag.
    expect(length('abc')).toBe(3)
    expect(length('🔐🔑🗝🛡')).toBe(4)
  })
})

describe('comparable and contains', () => {
  it('folds case by default', () => {
    expect(comparable('React', false)).toBe('react')
    expect(contains(['React'], 'react', false)).toBe(true)
  })

  it('respects case when asked', () => {
    expect(comparable('React', true)).toBe('React')
    expect(contains(['React'], 'react', true)).toBe(false)
  })

  it('uses locale-aware lowercasing', () => {
    // A tag list is exactly where someone would notice "İstanbul" folding
    // wrongly, so the fold is `toLocaleLowerCase`.
    expect(comparable('İ', false)).toBe('İ'.toLocaleLowerCase())
  })
})

describe('splitPasted', () => {
  it('splits on the configured delimiters', () => {
    expect(splitPasted('a,b,c', [','])).toEqual(['a', 'b', 'c'])
    expect(splitPasted('a;b', [';'])).toEqual(['a', 'b'])
  })

  it('always splits on newlines, whatever the delimiters', () => {
    // A paste from a spreadsheet column arrives newline-separated regardless of
    // what the field was configured for.
    expect(splitPasted('a\nb\nc', [','])).toEqual(['a', 'b', 'c'])
    expect(splitPasted('a\r\nb', [','])).toEqual(['a', 'b'])
  })

  it('drops empty fragments rather than turning them into rejections', () => {
    // `a,,b` is one careless keystroke, not two mistakes.
    expect(splitPasted('a,,b', [','])).toEqual(['a', 'b'])
    expect(splitPasted(',a,', [','])).toEqual(['a'])
    expect(splitPasted('   ,a', [','])).toEqual(['a'])
  })

  it('returns the whole string when there is nothing to split on', () => {
    expect(splitPasted('a,b', ['Enter'])).toEqual(['a,b'])
    expect(splitPasted('', ['Enter'])).toEqual([])
  })

  it('ignores multi-character delimiters, which would need a parser', () => {
    expect(splitPasted('a::b', ['::'])).toEqual(['a::b'])
  })

  it('returns nothing for empty text with no usable delimiter', () => {
    expect(splitPasted('', ['::'])).toEqual([])
  })
})

describe('attempt', () => {
  it('accepts a plain new tag', () => {
    expect(attempt([], 'react')).toEqual({ tag: 'react', accepted: true })
  })

  it('trims by default and can be told not to', () => {
    expect(attempt([], '  react  ').tag).toBe('react')
    expect(attempt([], '  react  ', { trim: false }).tag).toBe('  react  ')
  })

  it('refuses an empty or whitespace-only entry', () => {
    expect(attempt([], '').reason).toBe('empty')
    expect(attempt([], '   ').reason).toBe('empty')
  })

  it('refuses a duplicate, case-insensitively by default', () => {
    expect(attempt(['react'], 'React').reason).toBe('duplicate')
    expect(attempt(['react'], 'React', { caseSensitive: true }).accepted).toBe(true)
    expect(attempt(['react'], 'React', { allowDuplicates: true }).accepted).toBe(true)
  })

  it('refuses once the list is full', () => {
    expect(attempt(['a', 'b'], 'c', { max: 2 }).reason).toBe('max-reached')
    expect(attempt(['a'], 'b', { max: 2 }).accepted).toBe(true)
  })

  it('enforces length in codepoints', () => {
    expect(attempt([], 'ab', { minLength: 3 }).reason).toBe('too-short')
    expect(attempt([], 'abcd', { maxLength: 3 }).reason).toBe('too-long')
    expect(attempt([], '🔐🔑', { minLength: 2 }).accepted).toBe(true)
  })

  it('applies transform before every other rule', () => {
    // Lowercasing in `transform` must make `React` a duplicate of `react`.
    const rules = { transform: (raw: string) => raw.toLowerCase() }
    expect(attempt([], '  REACT ', rules).tag).toBe('react')
    expect(attempt(['react'], 'REACT', rules).reason).toBe('duplicate')
  })

  it('keeps whitespace in the fallback when trim is off and transform throws', () => {
    // Both the transform and the trim have to be undone, not just one.
    const result = attempt([], ' react ', {
      trim: false,
      transform: () => {
        throw new Error('boom')
      },
    })
    expect(result.tag).toBe(' react ')
  })

  it('degrades to no transform when transform throws', () => {
    // Consumer code running on every entry: a broken one must not take the
    // field down.
    const result = attempt([], ' react ', {
      transform: () => {
        throw new Error('boom')
      },
    })
    expect(result).toEqual({ tag: 'react', accepted: true })
  })

  it('gives validate the final say, with an optional reason', () => {
    expect(attempt([], 'react', { validate: () => true }).accepted).toBe(true)
    expect(attempt([], 'react', { validate: () => false }).reason).toBe('invalid')
    const explained = attempt([], 'react', { validate: () => 'no frameworks' })
    expect(explained.reason).toBe('invalid')
    expect(explained.message).toBe('no frameworks')
  })

  it('refuses rather than crashing when validate throws', () => {
    expect(
      attempt([], 'react', {
        validate: () => {
          throw new Error('boom')
        },
      }).reason,
    ).toBe('invalid')
  })

  it('checks the cheap rules before calling validate', () => {
    // An empty entry must never reach consumer code.
    let called = false
    attempt([], '  ', {
      validate: () => {
        called = true
        return true
      },
    })
    expect(called).toBe(false)
  })

  it('never mutates the list it was given', () => {
    const existing = ['a']
    attempt(existing, 'b')
    expect(existing).toEqual(['a'])
  })
})

describe('attemptAll', () => {
  it('checks each candidate against the list as it grows', () => {
    // `a, a, b` with duplicates off must accept the first `a`, refuse the
    // second, and accept `b` — which only works if each sees the running result.
    const { tags, results } = attemptAll([], ['a', 'a', 'b'])
    expect(tags).toEqual(['a', 'b'])
    expect(results.map((result) => result.accepted)).toEqual([true, false, true])
    expect(results[1]?.reason).toBe('duplicate')
  })

  it('stops accepting once max is reached, but keeps reporting', () => {
    const { tags, results } = attemptAll([], ['a', 'b', 'c'], { max: 2 })
    expect(tags).toEqual(['a', 'b'])
    expect(results[2]?.reason).toBe('max-reached')
  })

  it('appends to an existing list without mutating it', () => {
    const existing = ['a']
    const { tags } = attemptAll(existing, ['b'])
    expect(tags).toEqual(['a', 'b'])
    expect(existing).toEqual(['a'])
  })
})

describe('sanitize', () => {
  it('drops non-strings rather than stringifying them', () => {
    // `String(undefined)` is "undefined", and a tag reading "undefined" is a
    // worse failure than a missing one.
    expect(sanitize(['a', 1, null, undefined, {}, 'b'])).toEqual(['a', 'b'])
  })

  it('returns an empty list for anything that is not an array', () => {
    for (const bad of [undefined, null, 'a,b', 42, {}]) {
      expect(sanitize(bad)).toEqual([])
    }
  })

  it('trims, drops empties and deduplicates by the configured comparison', () => {
    expect(sanitize([' a ', 'a', '', '  ', 'A'])).toEqual(['a'])
    expect(sanitize([' a ', 'A'], { caseSensitive: true })).toEqual(['a', 'A'])
    expect(sanitize(['a', 'a'], { allowDuplicates: true })).toEqual(['a', 'a'])
  })

  it('truncates to max rather than refusing the whole list', () => {
    expect(sanitize(['a', 'b', 'c'], { max: 2 })).toEqual(['a', 'b'])
  })

  it('keeps surrounding whitespace when trim is off', () => {
    expect(sanitize([' a '], { trim: false })).toEqual([' a '])
  })
})
