import { describe, expect, it } from 'vitest'
import { inspectBound, inspectLocale, inspectOutOfRange, inspectRange, inspectValue } from '../warn'

/**
 * The inspectors, driven directly.
 *
 * They only *describe* a coercion the hook has already applied, so the contract
 * is: a usable prop returns `null`, and an unusable one returns a warning that
 * names what arrived (`received`, which is half the dedupe key) and says what
 * the field does instead. A warning that does not say what it fell back to
 * leaves the developer looking at an empty field with no idea whether the
 * component or their data is at fault.
 *
 * Unit-level rather than through a mount, because every branch here is a pure
 * function of its arguments — and the pair `useDateInput` cannot reach from a
 * rendered component (`min` after `max` with both parseable, say) is exactly the
 * pair worth pinning.
 */
describe('inspectValue', () => {
  it('passes a real ISO date', () => {
    expect(inspectValue('2026-03-15', 'value')).toBeNull()
  })

  it('separates the wrong format from a date that does not exist', () => {
    // Both render an empty field, and neither is obvious from looking at one,
    // so the messages have to differ.
    expect(inspectValue('03/15/2026', 'value')?.message).toContain('"YYYY-MM-DD"')
    expect(inspectValue('2026-02-31', 'value')?.message).toContain('not a real date')
  })

  it('names the prop it was given, so defaultValue does not report as value', () => {
    const warning = inspectValue('nope', 'defaultValue')

    expect(warning?.prop).toBe('defaultValue')
    expect(warning?.received).toBe('nope')
  })
})

describe('inspectBound', () => {
  it('passes parseable bounds', () => {
    expect(inspectBound('2026-01-01', 'min')).toBeNull()
    expect(inspectBound('2026-12-31', 'max')).toBeNull()
  })

  it('codes each bound separately', () => {
    expect(inspectBound('yesterday', 'min')?.code).toBe('min-unparseable')
    expect(inspectBound('tomorrow', 'max')?.code).toBe('max-unparseable')
  })
})

describe('inspectRange', () => {
  it('passes a range a date can satisfy, including a single-day one', () => {
    expect(inspectRange('2026-01-01', '2026-12-31')).toBeNull()
    expect(inspectRange('2026-01-01', '2026-01-01')).toBeNull()
  })

  it('says nothing when a bound is missing or unparseable', () => {
    // That is the other inspector's report; two warnings for one mistake is
    // noise, and the second would be a guess about which end is wrong.
    expect(inspectRange(undefined, '2026-01-01')).toBeNull()
    expect(inspectRange('nope', '2026-01-01')).toBeNull()
  })

  it('reports an inverted range and says both bounds are dropped', () => {
    const warning = inspectRange('2026-12-31', '2026-01-01')

    expect(warning?.code).toBe('min-after-max')
    expect(warning?.received).toBe('2026-12-31')
    expect(warning?.message).toContain('Ignoring both bounds')
  })
})

describe('inspectOutOfRange', () => {
  it('passes a date inside the range, and one with no range at all', () => {
    expect(inspectOutOfRange('2026-06-01', '2026-01-01', '2026-12-31')).toBeNull()
    expect(inspectOutOfRange('2026-06-01', undefined, undefined)).toBeNull()
  })

  it('names the bound that was crossed', () => {
    expect(inspectOutOfRange('2025-01-01', '2026-01-01', undefined)?.message).toContain('before')
    expect(inspectOutOfRange('2027-01-01', undefined, '2026-12-31')?.message).toContain('after')
  })
})

describe('inspectLocale', () => {
  it('passes a tag Intl accepts', () => {
    expect(inspectLocale('en-GB')).toBeNull()
  })

  it('reports an underscore, which is the mistake people actually make', () => {
    const warning = inspectLocale('en_US')

    expect(warning?.code).toBe('locale-invalid')
    expect(warning?.received).toBe('en_US')
    expect(warning?.message).toContain('note the hyphen')
  })
})
