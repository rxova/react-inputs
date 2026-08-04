import { describe, expect, it } from 'vitest'
import {
  inspectDelimiters,
  inspectLengthRange,
  inspectMax,
  inspectValueEntries,
  inspectValueShape,
} from '../warn'

/**
 * These inspectors only *describe* a coercion `sanitize` has already applied, so
 * the contract is: a usable prop returns nothing, and an unusable one returns a
 * warning naming what arrived and what happens instead.
 */
const defaults = { allowDuplicates: false, caseSensitive: false }

describe('inspectValueShape', () => {
  it('passes any array', () => {
    expect(inspectValueShape([], 'value')).toBeNull()
    expect(inspectValueShape(['a'], 'value')).toBeNull()
  })

  it('reports a non-array with its type, not its contents', () => {
    // A log line is not the place to stringify a caller's object.
    expect(inspectValueShape('a,b', 'value')?.received).toBe('string')
    expect(inspectValueShape(42, 'value')?.received).toBe('number')
    expect(inspectValueShape({}, 'defaultValue')?.received).toBe('object')
  })

  it('names the prop it was given', () => {
    expect(inspectValueShape(null, 'defaultValue')?.prop).toBe('defaultValue')
  })
})

describe('inspectValueEntries', () => {
  it('says nothing about a clean array', () => {
    expect(inspectValueEntries(['a', 'b'], 'value', defaults)).toEqual([])
  })

  it('says nothing at all when the value is not an array', () => {
    // That case is `inspectValueShape`'s to report; two warnings for one
    // mistake is noise.
    expect(inspectValueEntries('nope', 'value', defaults)).toEqual([])
  })

  it('reports non-strings, and gets the singular right', () => {
    const [one] = inspectValueEntries(['a', 1], 'value', defaults)
    expect(one?.code).toBe('value-had-non-strings')
    expect(one?.received).toContain('1 non-string entry')

    const [many] = inspectValueEntries(['a', 1, 2], 'value', defaults)
    expect(many?.received).toContain('2 non-string entries')
  })

  it('reports duplicates, honouring the comparison settings', () => {
    const folded = inspectValueEntries(['a', 'A'], 'value', defaults)
    expect(folded.map((warning) => warning.code)).toContain('value-had-duplicates')

    const cased = inspectValueEntries(['a', 'A'], 'value', {
      ...defaults,
      caseSensitive: true,
    })
    expect(cased.map((warning) => warning.code)).not.toContain('value-had-duplicates')

    const allowed = inspectValueEntries(['a', 'a'], 'value', {
      ...defaults,
      allowDuplicates: true,
    })
    expect(allowed).toEqual([])
  })

  it('ignores blanks when counting duplicates', () => {
    expect(inspectValueEntries(['a', '  ', ''], 'value', defaults)).toEqual([])
  })

  it('reports going over max separately from duplicates', () => {
    // Different mistakes with different fixes, so different codes.
    const codes = inspectValueEntries(['a', 'A', 'b', 'c'], 'value', {
      ...defaults,
      max: 2,
    }).map((warning) => warning.code)
    expect(codes).toContain('value-had-duplicates')
    expect(codes).toContain('value-over-max')
  })

  it('says nothing about max when the list fits', () => {
    expect(inspectValueEntries(['a', 'b'], 'value', { ...defaults, max: 2 })).toEqual([])
  })
})

describe('inspectMax', () => {
  it('passes a usable maximum, or none at all', () => {
    expect(inspectMax(undefined)).toBeNull()
    expect(inspectMax(1)).toBeNull()
    expect(inspectMax(50)).toBeNull()
  })

  it('reports a maximum that cannot bound anything', () => {
    for (const max of [0, -1, 1.5, Number.NaN]) {
      expect(inspectMax(max)?.code).toBe('max-invalid')
    }
  })
})

describe('inspectLengthRange', () => {
  it('passes an ordered or partial range', () => {
    expect(inspectLengthRange(1, 10)).toBeNull()
    expect(inspectLengthRange(3, 3)).toBeNull()
    expect(inspectLengthRange(undefined, 10)).toBeNull()
    expect(inspectLengthRange(1, undefined)).toBeNull()
  })

  it('reports a range no tag could satisfy', () => {
    const warning = inspectLengthRange(10, 3)
    expect(warning?.code).toBe('length-range-invalid')
    expect(warning?.message).toContain('Ignoring both')
  })
})

describe('inspectDelimiters', () => {
  it('passes a non-empty list', () => {
    expect(inspectDelimiters(['Enter'])).toBeNull()
  })

  it('reports an empty list, which makes the field look broken', () => {
    expect(inspectDelimiters([])?.code).toBe('no-delimiters')
  })
})
