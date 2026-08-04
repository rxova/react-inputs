import type { PasswordRule, PasswordRuleState } from './types'

/**
 * The default requirement set: one rule, about length.
 *
 * This is a deliberate reading of NIST SP 800-63B, which requires a length
 * minimum, requires accepting long passphrases, and explicitly says verifiers
 * "SHOULD NOT impose other composition rules" — the upper/lower/digit/symbol
 * checklist trains users into `Password1!` and measurably lowers real entropy.
 * Anyone who needs the checklist for a compliance regime that predates that
 * advice can pass `rules` and get it; the default should not be the bad option.
 */
export function defaultRules(minLength: number): PasswordRule[] {
  return [
    {
      id: 'min-length',
      label: `At least ${String(minLength)} characters`,
      // Spread, not `.length`: a string's `.length` counts UTF-16 code units,
      // so an emoji or an astral-plane character would count as two and let a
      // 4-glyph password satisfy an 8-character rule.
      test: (password) => Array.from(password).length >= minLength,
    },
  ]
}

/** Ready-made rules for products that must ship a composition checklist. */
export const commonRules = {
  lowercase: {
    id: 'lowercase',
    label: 'A lowercase letter',
    test: (password: string) => /\p{Ll}/u.test(password),
  },
  uppercase: {
    id: 'uppercase',
    label: 'An uppercase letter',
    test: (password: string) => /\p{Lu}/u.test(password),
  },
  digit: {
    id: 'digit',
    label: 'A number',
    test: (password: string) => /\p{Nd}/u.test(password),
  },
  symbol: {
    id: 'symbol',
    label: 'A symbol',
    test: (password: string) => /[\p{P}\p{S}]/u.test(password),
  },
} satisfies Record<string, PasswordRule>

/**
 * Evaluate every rule against the current password.
 *
 * A rule that throws is reported as unmet rather than taking the field down
 * with it: `test` is consumer code running on every keystroke, and a typo in
 * someone's custom predicate should degrade the checklist, not the login form.
 */
export function evaluateRules(rules: PasswordRule[], password: string): PasswordRuleState[] {
  return rules.map((rule) => {
    let met: boolean
    try {
      met = rule.test(password)
    } catch {
      met = false
    }
    return { ...rule, met }
  })
}

/** True when every non-optional rule passes. */
export function rulesSatisfied(states: PasswordRuleState[]): boolean {
  return states.every((rule) => rule.optional === true || rule.met)
}
