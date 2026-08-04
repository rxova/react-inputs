/**
 * Pure tag-list arithmetic: normalising, splitting, deduplicating, validating.
 *
 * All of it is a function of its arguments — no DOM, no React, no clock — which
 * is what makes the rules testable without mounting anything, and what lets a
 * consumer reuse them on the server to re-check whatever the field submitted.
 */

/** Why a candidate tag was refused. Stable codes, safe to `switch` on. */
export type TagRejection =
  'empty' | 'duplicate' | 'max-reached' | 'too-short' | 'too-long' | 'invalid'

/** The outcome of trying to add one candidate. */
export interface TagAttempt {
  /** The normalised tag, present whether or not it was accepted. */
  tag: string
  accepted: boolean
  reason?: TagRejection
  /** A human-readable reason, when `validate` supplied one. */
  message?: string
}

export interface TagRules {
  /** Strip leading and trailing whitespace before anything else. @default true */
  trim?: boolean
  /** Allow the same tag twice. @default false */
  allowDuplicates?: boolean
  /** Compare tags case-sensitively when deduplicating. @default false */
  caseSensitive?: boolean
  /** Maximum number of tags. */
  max?: number
  /** Minimum length of one tag, in codepoints. */
  minLength?: number
  /** Maximum length of one tag, in codepoints. */
  maxLength?: number
  /** Rewrite a raw entry before it is checked — lowercasing, prefixing, and so on. */
  transform?: (raw: string) => string
  /**
   * Final say. Return `true` to accept, `false` to refuse, or a string to
   * refuse *and* explain — the string is passed to `onReject` and can be shown.
   */
  validate?: (tag: string, existing: string[]) => boolean | string
}

/** Count codepoints, not UTF-16 code units, so an emoji is one character. */
export function length(value: string): number {
  return Array.from(value).length
}

/** The form a tag is compared in when deduplicating. */
export function comparable(tag: string, caseSensitive: boolean): string {
  // `toLocaleLowerCase` rather than `toLowerCase`: in Turkish, `I` lowercases
  // to a dotless `ı`, and a tag list is exactly the place a user would notice
  // "İstanbul" and "istanbul" being treated as different words.
  return caseSensitive ? tag : tag.toLocaleLowerCase()
}

/** Whether `tag` is already in `existing`, under the configured comparison. */
export function contains(
  existing: readonly string[],
  tag: string,
  caseSensitive: boolean,
): boolean {
  const needle = comparable(tag, caseSensitive)
  return existing.some((entry) => comparable(entry, caseSensitive) === needle)
}

/**
 * Split a pasted string into candidate tags.
 *
 * Splits on the configured delimiters *and* on newlines regardless, because a
 * paste from a spreadsheet column arrives newline-separated whatever the field
 * was configured for. Empty fragments are dropped here rather than becoming
 * rejections, since `a,,b` is one careless keystroke and not two mistakes.
 */
export function splitPasted(text: string, delimiters: string[]): string[] {
  const separators = new Set([...delimiters, '\n', '\r'])
  // Single-character delimiters only; a multi-character one would need a real
  // parser and is not something a tag field should invite.
  const single = [...separators].filter((entry) => entry.length === 1)
  if (single.length === 0) return text === '' ? [] : [text]

  const parts: string[] = []
  let current = ''
  for (const char of text) {
    if (single.includes(char)) {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts.filter((part) => part.trim() !== '')
}

/**
 * Try to add one candidate to a list.
 *
 * Returns what *would* happen without mutating anything, so the caller can
 * report a rejection and leave the text in the box for the user to fix rather
 * than silently swallowing it.
 */
export function attempt(existing: string[], raw: string, rules: TagRules = {}): TagAttempt {
  return attemptWith(existing, raw, rules)
}

/**
 * `attempt` with an optional pre-built index of what `existing` already holds.
 *
 * The duplicate check is the only part of the rule set that has to look at
 * every tag already committed. Called once, a scan is the right shape. Called
 * once per candidate — which is what {@link attemptAll} does for a paste — it
 * makes the whole batch quadratic: a 5,000-tag paste is 12.5M comparisons, and
 * the cost lands on the main thread while the user watches.
 *
 * So `attemptAll` hands down a duplicate test backed by {@link accumulate}'s
 * index. This function never learns what that index is — it asks a question
 * and gets an answer. The array is still what `validate` and the `max` check
 * see, so nothing about the outcome changes, only how the duplicate is found.
 */
function attemptWith(
  existing: readonly string[],
  raw: string,
  rules: TagRules = {},
  isDuplicate?: (tag: string) => boolean,
): TagAttempt {
  const {
    trim = true,
    allowDuplicates = false,
    caseSensitive = false,
    max,
    minLength,
    maxLength,
    transform,
    validate,
  } = rules

  let tag = trim ? raw.trim() : raw
  if (transform) {
    try {
      tag = transform(tag)
    } catch {
      // `transform` is consumer code running on every entry. A throwing one
      // degrades to "no transform" rather than taking the field down.
      tag = trim ? raw.trim() : raw
    }
  }

  if (tag === '') return { tag, accepted: false, reason: 'empty' }
  if (max !== undefined && existing.length >= max) {
    return { tag, accepted: false, reason: 'max-reached' }
  }
  if (minLength !== undefined && length(tag) < minLength) {
    return { tag, accepted: false, reason: 'too-short' }
  }
  if (maxLength !== undefined && length(tag) > maxLength) {
    return { tag, accepted: false, reason: 'too-long' }
  }
  if (!allowDuplicates) {
    const duplicate = isDuplicate ? isDuplicate(tag) : contains(existing, tag, caseSensitive)
    if (duplicate) return { tag, accepted: false, reason: 'duplicate' }
  }

  if (validate) {
    let verdict: boolean | string
    try {
      verdict = validate(tag, existing as string[])
    } catch {
      // Same reasoning as `transform`: a broken predicate refuses the tag
      // rather than unmounting the form.
      verdict = false
    }
    if (verdict !== true) {
      return {
        tag,
        accepted: false,
        reason: 'invalid',
        message: typeof verdict === 'string' ? verdict : undefined,
      }
    }
  }

  return { tag, accepted: true }
}

/**
 * The growing tag list, with the duplicate index that belongs to it.
 *
 * A batch needs two things at once: the list in order — which is what
 * `validate` is handed and what the caller gets back — and an O(1) answer to
 * "is this one already here". No single structure gives both, because the
 * array is the shape the public API is obliged to produce, so an index has to
 * sit beside it.
 *
 * What that costs, left in the open, is an invariant the calling code has to
 * remember on every mutation: push to the array, add to the index, never one
 * without the other. Forgetting the second is not a crash — it is a duplicate
 * silently accepted, found much later by someone looking at data.
 *
 * So the pair lives behind one handle and `add` is the only way in. There is
 * no sequence of calls that can put the two out of step.
 */
function accumulate(
  initial: string[],
  caseSensitive: boolean,
): {
  list: readonly string[]
  has: (tag: string) => boolean
  add: (tag: string) => void
} {
  const list = [...initial]
  const keys = new Set(list.map((tag) => comparable(tag, caseSensitive)))

  return {
    /**
     * The tags so far, in order. `readonly` to callers while `add` keeps the
     * mutable binding in this closure: growing the list without touching the
     * index is not something a caller can express, rather than something a
     * comment asks them not to do.
     */
    list,
    has: (tag: string) => keys.has(comparable(tag, caseSensitive)),
    add: (tag: string) => {
      list.push(tag)
      keys.add(comparable(tag, caseSensitive))
    },
  }
}

/**
 * Add several candidates in order, each checked against the list as it grows.
 *
 * Order matters: pasting `a, a, b` with duplicates off must accept the first
 * `a`, refuse the second, and accept `b` — which only works if each candidate
 * sees the accumulated result rather than the original list.
 */
export function attemptAll(
  existing: string[],
  candidates: string[],
  rules: TagRules = {},
): { tags: string[]; results: TagAttempt[] } {
  const accepted = accumulate(existing, rules.caseSensitive ?? false)
  const results: TagAttempt[] = []

  for (const candidate of candidates) {
    const result = attemptWith(accepted.list, candidate, rules, accepted.has)
    results.push(result)
    if (result.accepted) accepted.add(result.tag)
  }
  return { tags: [...accepted.list], results }
}

/**
 * Clean a `value` prop into something the component can render.
 *
 * Non-strings are dropped rather than coerced: `String(undefined)` is the
 * string "undefined", and a tag reading "undefined" in someone's UI is a worse
 * failure than a missing one.
 */
export function sanitize(value: unknown, rules: TagRules = {}): string[] {
  if (!Array.isArray(value)) return []
  const { allowDuplicates = false, caseSensitive = false, trim = true, max } = rules
  const out: string[] = []
  for (const entry of value as unknown[]) {
    if (typeof entry !== 'string') continue
    const tag = trim ? entry.trim() : entry
    if (tag === '') continue
    if (!allowDuplicates && contains(out, tag, caseSensitive)) continue
    if (max !== undefined && out.length >= max) break
    out.push(tag)
  }
  return out
}
