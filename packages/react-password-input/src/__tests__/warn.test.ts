import { describe, expect, it } from 'vitest'
import { inspectAutoComplete, inspectMaxLength, inspectMinLength, inspectRuleIds } from '../warn'
import { commonRules } from '../rules'

/**
 * These inspectors only *describe* a coercion the hook has already applied, so
 * the contract under test is: a usable prop returns `null`, and an unusable one
 * returns a warning whose message names both what arrived and what is being
 * used instead. A warning that does not say what it fell back to is noise.
 */
describe('inspectMinLength', () => {
  it('passes a non-negative integer', () => {
    expect(inspectMinLength(8, 8)).toBeNull()
    expect(inspectMinLength(0, 0)).toBeNull()
  })

  it('reports a negative minimum', () => {
    const warning = inspectMinLength(-3, 8)
    expect(warning?.code).toBe('min-length-negative')
    expect(warning?.prop).toBe('minLength')
    expect(warning?.message).toContain('-3')
    expect(warning?.message).toContain('8')
  })

  it('reports a non-finite minimum through the same code', () => {
    expect(inspectMinLength(Number.NaN, 8)?.code).toBe('min-length-negative')
    expect(inspectMinLength(Number.POSITIVE_INFINITY, 8)?.code).toBe('min-length-negative')
  })

  it('reports a fractional minimum separately, since it is a different mistake', () => {
    const warning = inspectMinLength(8.5, 8)
    expect(warning?.code).toBe('min-length-non-integer')
    expect(warning?.message).toContain('8.5')
  })
})

describe('inspectMaxLength', () => {
  it('passes an absent or sufficient maximum', () => {
    expect(inspectMaxLength(undefined, 8)).toBeNull()
    expect(inspectMaxLength(64, 8)).toBeNull()
    expect(inspectMaxLength(8, 8)).toBeNull()
  })

  it('reports a maximum below the minimum as unsatisfiable', () => {
    const warning = inspectMaxLength(4, 8)
    expect(warning?.code).toBe('max-length-below-min')
    expect(warning?.message).toContain('4')
    expect(warning?.message).toContain('8')
  })
})

describe('inspectRuleIds', () => {
  it('passes a set of unique ids', () => {
    expect(inspectRuleIds([commonRules.lowercase, commonRules.digit])).toBeNull()
    expect(inspectRuleIds([])).toBeNull()
  })

  it('reports a duplicate id and names it', () => {
    const warning = inspectRuleIds([
      commonRules.lowercase,
      commonRules.digit,
      { ...commonRules.symbol, id: 'digit' },
    ])
    expect(warning?.code).toBe('duplicate-rule-id')
    expect(warning?.message).toContain('"digit"')
  })
})

describe('inspectAutoComplete', () => {
  it('passes the values password managers understand', () => {
    expect(inspectAutoComplete('current-password')).toBeNull()
    expect(inspectAutoComplete('new-password')).toBeNull()
  })

  it('reports an empty or disabled autocomplete', () => {
    expect(inspectAutoComplete('')?.code).toBe('autocomplete-missing')
    expect(inspectAutoComplete('off')?.code).toBe('autocomplete-missing')
  })

  it('names both correct values so the fix does not need a search', () => {
    const message = inspectAutoComplete('off')?.message ?? ''
    expect(message).toContain('current-password')
    expect(message).toContain('new-password')
  })
})

describe('received', () => {
  it('is carried by every inspector, since it is half the dedupe key', () => {
    // `usePasswordInput` deduplicates on `code:received`. An inspector that
    // returned a warning without one would collapse every distinct mistake in
    // that prop into a single report.
    expect(inspectMinLength(-3, 8)?.received).toBe('-3')
    expect(inspectMinLength(8.5, 8)?.received).toBe('8.5')
    expect(inspectMaxLength(4, 8)?.received).toBe('4')
    expect(inspectAutoComplete('off')?.received).toBe('off')
    expect(inspectRuleIds([commonRules.digit, commonRules.digit])?.received).toBe(
      commonRules.digit.id,
    )
  })
})
