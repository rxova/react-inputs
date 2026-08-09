import { describe, expect, it } from 'vitest'
import { parseLayout } from '../layout'

/**
 * `parseLayout` is authoring sugar, but it is also what the docs, the demo and
 * half of this package's own fixtures are written in — a silent
 * misinterpretation here would quietly invalidate every example.
 */
describe('parseLayout', () => {
  it('reads a single unheaded row into an implicit section', () => {
    const [section] = parseLayout('12: ##')
    expect(section?.id).toBe('seats')
    expect(section?.label).toBe('Seats')
    expect(section?.rows).toHaveLength(1)
  })

  it('names seats from the row label and the column letter', () => {
    const [section] = parseLayout('12: ##_##')
    expect(section?.rows[0]?.cells.map((cell) => cell?.id ?? null)).toEqual([
      '12A',
      '12B',
      null,
      '12C',
      '12D',
    ])
  })

  it('leaves aisle columns unlettered', () => {
    expect(parseLayout('12: ##_##')[0]?.columns).toEqual(['A', 'B', '', 'C', 'D'])
  })

  it('maps every status character', () => {
    const cells = parseLayout('1: #xo.')[0]?.rows[0]?.cells
    expect(cells?.map((cell) => cell?.status)).toEqual([
      // `available` is the default and is left off the object entirely.
      undefined,
      'occupied',
      'held',
      'blocked',
    ])
  })

  it('starts a new section on a line without a colon', () => {
    const sections = parseLayout(`
      Main cabin
      1: ##
      Upper deck
      1: ##
    `)
    expect(sections.map((section) => [section.id, section.label])).toEqual([
      ['main-cabin', 'Main cabin'],
      ['upper-deck', 'Upper deck'],
    ])
  })

  it('prefixes seat ids with the section once there is more than one', () => {
    // A theatre has a row A in the stalls and a row A in the circle. The ids
    // have to differ; the labels deliberately do not.
    const sections = parseLayout('Stalls\nA: ##\nCircle\nA: ##')
    expect(sections[0]?.rows[0]?.cells[0]?.id).toBe('stalls-AA')
    expect(sections[1]?.rows[0]?.cells[0]?.id).toBe('circle-AA')
  })

  it('leaves a single section unprefixed', () => {
    expect(parseLayout('Main cabin\n12: ##')[0]?.rows[0]?.cells[0]?.id).toBe('12A')
  })

  it('falls back to a positional id when the label slugs to nothing', () => {
    expect(parseLayout('!!!\n1: ##')[0]?.id).toBe('section-1')
  })

  it('falls back to a positional id when two sections share a label', () => {
    const sections = parseLayout('Tier\n1: ##\nTier\n2: ##')
    expect(sections.map((section) => section.id)).toEqual(['tier', 'section-2'])
  })

  it('ignores blank lines and surrounding indentation', () => {
    const sections = parseLayout('\n\n   1: ##   \n\n')
    expect(sections[0]?.rows).toHaveLength(1)
  })

  it('ignores whitespace inside a row', () => {
    expect(parseLayout('12: ## _ ##')).toEqual(parseLayout('12:##_##'))
  })

  it('pads short rows so the section stays rectangular', () => {
    const [section] = parseLayout('1: ####\n2: ##')
    expect(section?.rows[1]?.cells).toHaveLength(4)
    expect(section?.rows[1]?.cells[3]).toBeNull()
  })

  it('throws on an unknown character, naming it and the line', () => {
    expect(() => parseLayout('1: ##\n2: #?#')).toThrow(/unknown character "\?" on line 2/)
  })

  it('throws on a row with no label', () => {
    expect(() => parseLayout(' : ##')).toThrow(/row on line 1 has no label/)
  })

  it('accepts an empty spec', () => {
    expect(parseLayout('')).toEqual([])
  })

  it('accepts a row that is all aisle', () => {
    const [section] = parseLayout('1: ___')
    expect(section?.columns).toEqual(['', '', ''])
    expect(section?.rows[0]?.cells).toEqual([null, null, null])
  })

  it('accepts a multi-word row label', () => {
    const [section] = parseLayout('Box 1: ##')
    expect(section?.rows[0]?.label).toBe('Box 1')
    expect(section?.rows[0]?.cells[0]?.id).toBe('Box 1A')
  })

  it('rejects a second colon rather than guessing where the row ends', () => {
    expect(() => parseLayout('1: ##: ##')).toThrow(/unknown character ":"/)
  })
})
