import { describe, expect, it } from 'vitest'
import {
  GAP,
  dimensionOfUnits,
  measurementPieces,
  unitName,
  unitSuffix,
  usableUnits,
} from '../segments'
import type { MeasurementUnit } from '../units'

const FALLBACK: MeasurementUnit[] = ['meter', 'centimeter']

describe('unit suffixes', () => {
  it('takes the locale abbreviation from Intl', () => {
    expect(unitSuffix('foot', 'en-GB').trim()).toBe('ft')
    expect(unitSuffix('inch', 'en-GB').trim()).toBe('in')
    expect(unitSuffix('centimeter', 'en-GB').trim()).toBe('cm')
    expect(unitSuffix('celsius', 'en-GB').trim()).toBe('°C')
  })

  /**
   * The two ICU outputs that decided `unitDisplay: 'short'` over the duration
   * field's `'narrow'`. Asserted rather than described, because "narrow is
   * shorter" is the obvious choice and this is why it is wrong here.
   */
  it('avoids the narrow forms that would be unreadable in this field', () => {
    // `unitDisplay: 'narrow'` gives `#` for a pound and a bare `°` for
    // Fahrenheit — the same character Celsius uses.
    const narrowPound = new Intl.NumberFormat('en', {
      style: 'unit',
      unit: 'pound',
      unitDisplay: 'narrow',
    }).format(11)
    expect(narrowPound).toContain('#')
    expect(unitSuffix('pound', 'en').trim()).toBe('lb')

    const narrowFahrenheit = new Intl.NumberFormat('en', {
      style: 'unit',
      unit: 'fahrenheit',
      unitDisplay: 'narrow',
    }).format(70)
    expect(narrowFahrenheit.trim()).toBe('70°')
    expect(unitSuffix('fahrenheit', 'en').trim()).toBe('°F')
  })

  it('keeps the spacing the locale itself chose', () => {
    // `en` writes `5 ft` with a space and `3°C` without one; that spacing is
    // locale data, not ours to normalise.
    expect(unitSuffix('foot', 'en').startsWith(' ')).toBe(true)
    expect(unitSuffix('celsius', 'en').startsWith(' ')).toBe(false)
  })

  it('translates', () => {
    expect(unitSuffix('meter', 'fr-FR').trim()).toBe('m')
    expect(unitName('foot', 'en-GB')).toBe('feet')
    expect(unitName('meter', 'fr-FR')).toBe('mètres')
  })

  /**
   * Formatted against 3, not 1. A locale that inflects hands back the singular
   * for 1, and a segment called "foot" reads as though it holds exactly one.
   * (3 rather than 2 because Arabic has a dual, which would name the segment
   * after a quantity it does not hold either.)
   */
  it('names a segment in the generic plural', () => {
    const singular = new Intl.NumberFormat('en', {
      style: 'unit',
      unit: 'foot',
      unitDisplay: 'long',
    }).format(1)
    expect(singular).toBe('1 foot')
    expect(unitName('foot', 'en')).toBe('feet')
  })

  /**
   * The two fallbacks, forced. Neither is reachable on a modern engine — every
   * unit here is in `Intl.supportedValuesOf('unit')` and every locale writes
   * these after the number — so an engine has to be simulated to prove the
   * field degrades instead of rendering two indistinguishable empty
   * spinbuttons.
   */
  it('falls back to the identifier when Intl reports nothing usable', () => {
    const real = Intl.NumberFormat
    // An engine that puts the unit before the number leaves nothing after it,
    // which is the shape this guards against.
    const Silent = function Silent() {
      return { formatToParts: () => [{ type: 'integer', value: '3' }] }
    }
    try {
      // @ts-expect-error — deliberately replacing the global for one assertion.
      Intl.NumberFormat = Silent
      expect(unitSuffix('meter', 'en')).toBe(' meter')
      expect(unitName('meter', 'en')).toBeNull()
    } finally {
      Intl.NumberFormat = real
    }
  })

  it('returns nothing at all on an engine with no unit formatting', () => {
    const real = Intl.NumberFormat
    const Broken = function Broken(): never {
      throw new RangeError('no unit formatting here')
    }
    try {
      // @ts-expect-error — deliberately replacing the global for one assertion.
      Intl.NumberFormat = Broken
      expect(unitSuffix('meter', 'en')).toBe(' meter')
      expect(unitName('meter', 'en')).toBeNull()
    } finally {
      Intl.NumberFormat = real
    }
  })

  it('falls back to the runtime locale rather than throwing on a bad tag', () => {
    // `en_US` with an underscore is the classic mistake, and a field that blanks
    // the page over it is worse than one that renders in the default locale.
    expect(() => unitSuffix('meter', 'en_US')).not.toThrow()
    expect(unitSuffix('meter', 'en_US').trim()).not.toBe('')
    expect(unitName('meter', 'en_US')).not.toBeNull()
  })
})

describe('usableUnits', () => {
  it('passes a well-formed array through', () => {
    expect(usableUnits(['foot', 'inch'], FALLBACK)).toEqual(['foot', 'inch'])
    expect(usableUnits(['meter', 'centimeter', 'millimeter'], FALLBACK)).toEqual([
      'meter',
      'centimeter',
      'millimeter',
    ])
  })

  it('falls back when it is given nothing usable', () => {
    expect(usableUnits(undefined, FALLBACK)).toEqual(FALLBACK)
    expect(usableUnits([], FALLBACK)).toEqual(FALLBACK)
    expect(usableUnits(['furlong', 'parsec'], FALLBACK)).toEqual(FALLBACK)
  })

  it('drops the time units, which belong to the duration field', () => {
    expect(usableUnits(['hour', 'minute'], FALLBACK)).toEqual(FALLBACK)
    expect(usableUnits(['meter', 'second'], FALLBACK)).toEqual(['meter'])
  })

  it('drops percent and degree, which have no conversion partner', () => {
    expect(usableUnits(['percent'], FALLBACK)).toEqual(FALLBACK)
    expect(usableUnits(['degree'], FALLBACK)).toEqual(FALLBACK)
  })

  it('sorts largest first rather than rendering an array upside down', () => {
    // As written, a bounded inches segment would sit in front of an unbounded
    // feet one: `14` refused in the first box and accepted in the second.
    expect(usableUnits(['inch', 'foot'], FALLBACK)).toEqual(['foot', 'inch'])
    expect(usableUnits(['centimeter', 'meter'], FALLBACK)).toEqual(['meter', 'centimeter'])
  })

  it('dedupes', () => {
    expect(usableUnits(['foot', 'foot', 'inch'], FALLBACK)).toEqual(['foot', 'inch'])
  })

  it('keeps one dimension and drops the rest', () => {
    expect(usableUnits(['meter', 'pound'], FALLBACK)).toEqual(['meter'])
    expect(usableUnits(['pound', 'meter'], FALLBACK)).toEqual(['pound'])
    expect(usableUnits(['stone', 'pound', 'liter'], FALLBACK)).toEqual(['stone', 'pound'])
  })

  /**
   * The repair that makes this field's premise hold: a segment carries into the
   * one above it, so the pair has to divide.
   */
  it('drops a unit with no whole-number ratio to the one above it', () => {
    expect(usableUnits(['meter', 'inch'], FALLBACK)).toEqual(['meter'])
    expect(usableUnits(['hectare', 'acre'], FALLBACK)).toEqual(['hectare'])
    expect(usableUnits(['mile', 'kilometer'], FALLBACK)).toEqual(['mile'])
    // The survivor still carries with whatever remains below it.
    expect(usableUnits(['meter', 'inch', 'centimeter'], FALLBACK)).toEqual(['meter', 'centimeter'])
  })

  it('keeps a temperature field to one unit', () => {
    expect(usableUnits(['celsius', 'fahrenheit'], FALLBACK)).toEqual(['celsius'])
    expect(usableUnits(['fahrenheit', 'celsius'], FALLBACK)).toEqual(['fahrenheit'])
    expect(usableUnits(['celsius'], FALLBACK)).toEqual(['celsius'])
  })

  it('ignores entries that are not strings at all', () => {
    expect(usableUnits([null, 5, {}, 'foot', 'inch'] as unknown as string[], FALLBACK)).toEqual([
      'foot',
      'inch',
    ])
  })
})

describe('pieces', () => {
  it('lays out a segment, its suffix, and a gap between units', () => {
    const pieces = measurementPieces(['foot', 'inch'], 'en-GB')
    expect(pieces.map((piece) => piece.kind)).toEqual([
      'segment',
      'literal',
      'literal',
      'segment',
      'literal',
    ])
    expect(pieces[2]).toEqual({ kind: 'literal', text: GAP })
  })

  it('puts no gap after the last unit', () => {
    const pieces = measurementPieces(['centimeter'], 'en-GB')
    expect(pieces).toHaveLength(2)
    expect(pieces.filter((piece) => piece.kind === 'literal' && piece.text === GAP)).toHaveLength(0)
  })

  it('uses a thin space, not an ordinary one', () => {
    // Written as an escape in the source for exactly this reason: pasted, the
    // two are indistinguishable in a diff.
    expect(GAP).toBe('\u2009')
    expect(GAP).not.toBe(' ')
  })

  it('reports the dimension a repaired set of units belongs to', () => {
    expect(dimensionOfUnits(['foot', 'inch'])).toBe('length')
    expect(dimensionOfUnits(['celsius'])).toBe('temperature')
    expect(dimensionOfUnits([])).toBeNull()
  })
})
