import { describe, expect, it } from 'vitest'
import {
  inspectAccept,
  inspectMaxFiles,
  inspectSingleWithMax,
  inspectSize,
  inspectSizeRange,
} from '../warn'

/**
 * The inspectors, driven directly.
 *
 * They only *describe* a coercion the hook has already applied, so the contract
 * is: a usable prop returns `null`, and an unusable one returns a warning that
 * names what arrived (`received`, which is half the dedupe key) and says what
 * the field does instead.
 *
 * `inspectAccept` is the one that earns a unit test on its own. Its failure mode
 * is a field that silently refuses every file, which looks like a broken
 * component rather than a typo in a prop — and the two typos it catches (`png`
 * without the dot, `image/*.png`) are both things a reasonable person writes.
 */
describe('inspectMaxFiles', () => {
  it('passes a whole number of at least one, and an absent prop', () => {
    expect(inspectMaxFiles(3)).toBeNull()
    expect(inspectMaxFiles(1)).toBeNull()
    expect(inspectMaxFiles(undefined)).toBeNull()
  })

  it('refuses a bound that would make the field hold nothing', () => {
    expect(inspectMaxFiles(0)?.code).toBe('max-files-invalid')
    expect(inspectMaxFiles(-2)?.received).toBe('-2')
    expect(inspectMaxFiles(2.5)?.code).toBe('max-files-invalid')
  })
})

describe('inspectSizeRange', () => {
  it('passes a satisfiable range and any half-open one', () => {
    expect(inspectSizeRange(1_000, 5_000)).toBeNull()
    expect(inspectSizeRange(undefined, 5_000)).toBeNull()
    expect(inspectSizeRange(1_000, undefined)).toBeNull()
  })

  it('reports a range no file could satisfy', () => {
    expect(inspectSizeRange(5_000, 1_000)?.code).toBe('size-range-invalid')
  })
})

describe('inspectSize', () => {
  it('passes a non-negative size', () => {
    expect(inspectSize(0, 'minSize')).toBeNull()
    expect(inspectSize(1_000, 'maxSize')).toBeNull()
    expect(inspectSize(undefined, 'maxSize')).toBeNull()
  })

  it('reports a negative or non-finite size against the prop it came from', () => {
    expect(inspectSize(-1, 'minSize')?.prop).toBe('minSize')
    expect(inspectSize(Number.POSITIVE_INFINITY, 'maxSize')?.code).toBe('negative-size')
  })
})

describe('inspectAccept', () => {
  it('passes every shape the platform actually takes', () => {
    expect(inspectAccept('.png')).toBeNull()
    expect(inspectAccept('image/png')).toBeNull()
    expect(inspectAccept('image/*')).toBeNull()
    expect(inspectAccept('.pdf, image/*, text/plain')).toBeNull()
    expect(inspectAccept(undefined)).toBeNull()
    expect(inspectAccept('  ')).toBeNull()
  })

  it('catches an extension written without its dot', () => {
    const warning = inspectAccept('png')

    expect(warning?.code).toBe('accept-suspicious')
    expect(warning?.received).toBe('png')
  })

  it('catches a wildcard the spec does not have', () => {
    expect(inspectAccept('*.png')?.code).toBe('accept-suspicious')
    expect(inspectAccept('image/*.png')?.code).toBe('accept-suspicious')
  })

  it('reports only the bad entries, so the message points at the typo', () => {
    expect(inspectAccept('.pdf, png, image/*')?.received).toBe('png')
  })
})

describe('inspectSingleWithMax', () => {
  it('passes when the two props agree', () => {
    expect(inspectSingleWithMax(true, 5)).toBeNull()
    expect(inspectSingleWithMax(false, undefined)).toBeNull()
  })

  it('reports a maxFiles that cannot do anything, and says what was meant', () => {
    const warning = inspectSingleWithMax(false, 5)

    expect(warning?.code).toBe('single-with-max')
    expect(warning?.message).toContain('Add `multiple`')
  })
})
