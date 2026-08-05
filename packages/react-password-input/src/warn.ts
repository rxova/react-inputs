import type { PasswordRule, PasswordWarning } from './types'

/**
 * Development-only diagnostics.
 *
 * Every function here is reached exclusively from the `NODE_ENV !== 'production'`
 * branch in `usePasswordInput`, so a production bundler drops this whole module.
 * The coercion itself lives in the hook and always runs; this only *describes* a
 * coercion that already happened.
 */

/** Describe how `minLength` was coerced, or `null` if it was a non-negative integer. */
export function inspectMinLength(raw: number, used: number): PasswordWarning | null {
  if (!Number.isFinite(raw) || raw < 0) {
    return {
      code: 'min-length-negative',
      prop: 'minLength',
      received: String(raw),
      message: `\`minLength\` must be a non-negative number; received ${String(raw)}. Using ${String(used)}.`,
    }
  }
  if (!Number.isInteger(raw)) {
    return {
      code: 'min-length-non-integer',
      prop: 'minLength',
      received: String(raw),
      message: `\`minLength\` must be an integer; received ${String(raw)}. Using ${String(used)}.`,
    }
  }
  return null
}

/** Describe a `maxLength` that sits below `minLength`, which no password could satisfy. */
export function inspectMaxLength(
  maxLength: number | undefined,
  minLength: number,
): PasswordWarning | null {
  if (maxLength === undefined || maxLength >= minLength) return null
  return {
    code: 'max-length-below-min',
    prop: 'maxLength',
    received: String(maxLength),
    message: `\`maxLength\` (${String(maxLength)}) is below \`minLength\` (${String(minLength)}); no password can satisfy both. Ignoring \`maxLength\`.`,
  }
}

/**
 * Rule ids double as React keys and as `data-rule` values, so a duplicate makes
 * one row unreachable in tests and unstable across re-renders.
 */
export function inspectRuleIds(rules: PasswordRule[]): PasswordWarning | null {
  const seen = new Set<string>()
  for (const rule of rules) {
    if (seen.has(rule.id)) {
      return {
        code: 'duplicate-rule-id',
        prop: 'rules',
        received: rule.id,
        message: `Two rules share the id "${rule.id}". Ids are used as React keys and as \`data-rule\` values, so they must be unique.`,
      }
    }
    seen.add(rule.id)
  }
  return null
}

/**
 * A password field with no `autocomplete` breaks password managers, and a
 * sign-up form marked `current-password` makes them offer the *old* password
 * instead of generating a new one. Neither is visible in a screenshot, so it is
 * worth saying out loud.
 */
export function inspectAutoComplete(autoComplete: string): PasswordWarning | null {
  if (autoComplete !== '' && autoComplete !== 'off') return null
  return {
    code: 'autocomplete-missing',
    prop: 'autoComplete',
    received: autoComplete,
    message:
      '`autoComplete` is empty or "off", which stops password managers from filling or generating this field. Use "current-password" to sign in, or "new-password" to sign up or change a password.',
  }
}

/**
 * A custom `estimate` that threw. The meter falls back to the built-in
 * estimator so the field keeps working, but a silently-downgraded meter is
 * exactly the kind of thing that ships unnoticed.
 */
export function inspectEstimate(threw: boolean): PasswordWarning | null {
  if (!threw) return null
  return {
    code: 'estimate-threw',
    prop: 'estimate',
    received: 'threw',
    message:
      '`estimate` threw and was ignored; the built-in estimator was used for this password instead.',
  }
}
