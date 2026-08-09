import { describe, expect, it } from 'vitest'
import { buildGrid } from '../geometry'
import { parseLayout } from '../layout'
import { inspectLayout, inspectLimits, inspectValue } from '../warn'

/**
 * These describe decisions that have already been taken — the grid is built and
 * the value filtered before any of this runs. A test that had to change
 * behaviour to make a warning fire would be testing the wrong module.
 */
describe('inspectLayout', () => {
  it('says nothing about a healthy layout', () => {
    expect(inspectLayout(buildGrid(parseLayout('1: ##')))).toEqual([])
  })

  it('flags a map with no seats at all', () => {
    expect(inspectLayout(buildGrid([]))).toEqual([expect.objectContaining({ code: 'no-layout' })])
  })

  it('flags a duplicate id once, however many times it repeats', () => {
    const grid = buildGrid([
      {
        id: 's',
        label: 'S',
        rows: [
          { label: '1', cells: [{ id: 'dup' }, { id: 'dup' }] },
          { label: '2', cells: [{ id: 'dup' }, { id: 'ok' }] },
        ],
      },
    ])
    const warnings = inspectLayout(grid)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({ code: 'duplicate-seat-id', seatId: 'dup' })
    expect(warnings[0]?.message).toContain('appears more than once')
  })
})

describe('inspectValue', () => {
  it('says nothing when every id is real', () => {
    expect(inspectValue(buildGrid(parseLayout('1: ##')), ['1A'])).toEqual([])
  })

  it('names each id the layout does not know', () => {
    const warnings = inspectValue(buildGrid(parseLayout('1: ##')), ['1A', '9Z'])
    expect(warnings).toEqual([expect.objectContaining({ code: 'unknown-seat-id', seatId: '9Z' })])
  })
})

describe('inspectLimits', () => {
  it('says nothing about sensible limits', () => {
    expect(inspectLimits(4, 2)).toEqual([])
    expect(inspectLimits(undefined, undefined)).toEqual([])
  })

  it('flags a cap that is not a positive integer', () => {
    expect(inspectLimits(0)).toEqual([expect.objectContaining({ code: 'max-seats-invalid' })])
    expect(inspectLimits(2.5)).toEqual([expect.objectContaining({ code: 'max-seats-invalid' })])
    expect(inspectLimits(-1)).toEqual([expect.objectContaining({ code: 'max-seats-invalid' })])
  })

  it('flags a floor above the cap', () => {
    expect(inspectLimits(2, 4)).toEqual([expect.objectContaining({ code: 'min-above-max' })])
  })

  it('does not compare against a cap it has already rejected', () => {
    // Reporting "min above max" on a max of 0 would send the developer to fix
    // the wrong prop.
    expect(inspectLimits(0, 4).map((warning) => warning.code)).toEqual(['max-seats-invalid'])
  })
})
