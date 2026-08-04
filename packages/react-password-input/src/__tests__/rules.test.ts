import { describe, expect, it } from 'vitest'
import { commonRules, defaultRules, evaluateRules, rulesSatisfied } from '../rules'

describe('defaultRules', () => {
  it('is a single length rule, not a composition checklist', () => {
    const rules = defaultRules(8)
    expect(rules).toHaveLength(1)
    expect(rules[0]!.id).toBe('min-length')
    expect(rules[0]!.label).toBe('At least 8 characters')
  })

  it('reflects the configured minimum in its label and its test', () => {
    const [rule] = defaultRules(12)
    expect(rule!.label).toBe('At least 12 characters')
    expect(rule!.test('elevenchars')).toBe(false)
    expect(rule!.test('twelvechars!')).toBe(true)
  })

  it('counts codepoints, so an emoji is one character and not two', () => {
    const [rule] = defaultRules(4)
    // Four glyphs, eight UTF-16 code units. `.length` would wrongly pass this
    // at a minimum of 8.
    expect(rule!.test('🔐🔑🗝️🛡️')).toBe(true)
    expect(defaultRules(8)[0]!.test('🔐🔑🗝️🛡️')).toBe(false)
  })
})

describe('commonRules', () => {
  it('matches letters and digits outside ASCII, not just the English alphabet', () => {
    // Unicode property escapes rather than [a-z]: a German or Greek password
    // that is genuinely mixed-case must not be told it has no uppercase.
    expect(commonRules.lowercase.test('ß')).toBe(true)
    expect(commonRules.uppercase.test('Ä')).toBe(true)
    expect(commonRules.uppercase.test('Δ')).toBe(true)
    // Arabic-Indic digits are digits.
    expect(commonRules.digit.test('٤')).toBe(true)
  })

  it('rejects the absent class in each case', () => {
    expect(commonRules.lowercase.test('ABC123')).toBe(false)
    expect(commonRules.uppercase.test('abc123')).toBe(false)
    expect(commonRules.digit.test('abcDEF')).toBe(false)
    expect(commonRules.symbol.test('abcDEF123')).toBe(false)
  })

  it('treats both punctuation and symbols as symbols', () => {
    expect(commonRules.symbol.test('a!')).toBe(true)
    expect(commonRules.symbol.test('a+')).toBe(true)
    expect(commonRules.symbol.test('a€')).toBe(true)
  })
})

describe('evaluateRules', () => {
  it('reports each rule with its met flag and preserves order', () => {
    const states = evaluateRules(
      [commonRules.lowercase, commonRules.digit, commonRules.uppercase],
      'abc1',
    )
    expect(states.map((rule) => [rule.id, rule.met])).toEqual([
      ['lowercase', true],
      ['digit', true],
      ['uppercase', false],
    ])
  })

  it('reports a throwing predicate as unmet instead of taking the field down', () => {
    // `test` is consumer code running on every keystroke. A typo in someone's
    // custom rule should degrade the checklist, not the login form.
    const states = evaluateRules(
      [
        {
          id: 'broken',
          label: 'Never works',
          test: () => {
            throw new Error('boom')
          },
        },
        commonRules.lowercase,
      ],
      'abc',
    )
    expect(states[0]!.met).toBe(false)
    expect(states[1]!.met).toBe(true)
  })

  it('carries the optional flag through to the evaluated state', () => {
    const [state] = evaluateRules(
      [{ id: 'nice', label: 'Nice to have', test: () => false, optional: true }],
      '',
    )
    expect(state!.optional).toBe(true)
    expect(state!.met).toBe(false)
  })

  it('returns an empty list for an empty rule set', () => {
    expect(evaluateRules([], 'anything')).toEqual([])
  })
})

describe('rulesSatisfied', () => {
  it('requires every non-optional rule', () => {
    expect(rulesSatisfied(evaluateRules([commonRules.lowercase], 'abc'))).toBe(true)
    expect(rulesSatisfied(evaluateRules([commonRules.uppercase], 'abc'))).toBe(false)
  })

  it('ignores a failing optional rule', () => {
    const states = evaluateRules(
      [commonRules.lowercase, { ...commonRules.symbol, optional: true }],
      'abc',
    )
    expect(states[1]!.met).toBe(false)
    expect(rulesSatisfied(states)).toBe(true)
  })

  it('treats an empty rule set as satisfied', () => {
    expect(rulesSatisfied([])).toBe(true)
  })
})
