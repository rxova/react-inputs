import { contains } from './tags'
import type { TagsWarning } from './types'

/**
 * Development-only diagnostics.
 *
 * Every function here is reached exclusively from the `NODE_ENV !== 'production'`
 * branch in `useTagsInput`, so a production bundler drops this whole module.
 * The coercion itself lives in `sanitize` and always runs; this only *describes*
 * a coercion that already happened.
 */

/** Describe a `value` that is not an array at all. */
export function inspectValueShape(value: unknown, prop: string): TagsWarning | null {
  if (Array.isArray(value)) return null
  // Only the type name: the value itself could be anything, and a log line is
  // not the place to stringify a caller's object.
  const received = typeof value
  return {
    code: 'value-not-array',
    prop,
    received,
    message: `\`${prop}\` must be an array of strings; received ${received}. Rendering an empty list.`,
  }
}

/**
 * Describe entries that were dropped from a `value` array.
 *
 * Three separate mistakes, and they are worth separating: a non-string entry is
 * a type error, a duplicate is a data error, and going over `max` is a config
 * mismatch. Coercing all three into one message would leave the caller guessing
 * which of their tags vanished and why.
 */
export function inspectValueEntries(
  value: unknown,
  prop: string,
  options: { allowDuplicates: boolean; caseSensitive: boolean; max?: number },
): TagsWarning[] {
  if (!Array.isArray(value)) return []
  const warnings: TagsWarning[] = []
  const entries = value as unknown[]

  const nonStrings = entries.filter((entry) => typeof entry !== 'string')
  if (nonStrings.length > 0) {
    warnings.push({
      code: 'value-had-non-strings',
      prop,
      received: `${String(nonStrings.length)} non-string entr${nonStrings.length === 1 ? 'y' : 'ies'}`,
      message: `\`${prop}\` contained ${String(nonStrings.length)} entry/entries that are not strings; they were dropped rather than stringified, because a tag reading "undefined" is worse than a missing one.`,
    })
  }

  if (!options.allowDuplicates) {
    const seen: string[] = []
    let duplicates = 0
    for (const entry of entries) {
      if (typeof entry !== 'string') continue
      const tag = entry.trim()
      if (tag === '') continue
      if (contains(seen, tag, options.caseSensitive)) duplicates++
      else seen.push(tag)
    }
    if (duplicates > 0) {
      warnings.push({
        code: 'value-had-duplicates',
        prop,
        received: `${String(duplicates)} duplicate(s)`,
        message: `\`${prop}\` contained ${String(duplicates)} duplicate tag(s), which were dropped. Pass \`allowDuplicates\` if repeats are meaningful here.`,
      })
    }
  }

  const usable = entries.filter((entry) => typeof entry === 'string' && entry.trim() !== '').length
  if (options.max !== undefined && usable > options.max) {
    warnings.push({
      code: 'value-over-max',
      prop,
      received: `${String(usable)} tags`,
      message: `\`${prop}\` has ${String(usable)} tags but \`max\` is ${String(options.max)}; the extras were dropped.`,
    })
  }

  return warnings
}

/** Describe a `max` that cannot bound anything. */
export function inspectMax(max: number | undefined): TagsWarning | null {
  if (max === undefined) return null
  if (Number.isInteger(max) && max >= 1) return null
  return {
    code: 'max-invalid',
    prop: 'max',
    received: String(max),
    message: `\`max\` must be a whole number of at least 1; received ${String(max)}. Ignoring it — a field that can hold no tags is not a field.`,
  }
}

/** Describe a length range no tag could satisfy. */
export function inspectLengthRange(
  minLength: number | undefined,
  maxLength: number | undefined,
): TagsWarning | null {
  if (minLength === undefined || maxLength === undefined) return null
  if (minLength <= maxLength) return null
  return {
    code: 'length-range-invalid',
    prop: 'minLength',
    received: `${String(minLength)} > ${String(maxLength)}`,
    message: `\`minLength\` (${String(minLength)}) is greater than \`maxLength\` (${String(maxLength)}); no tag can satisfy both. Ignoring both.`,
  }
}

/**
 * Describe an empty `delimiters` list.
 *
 * With nothing to commit on, the only way to add a tag is to blur the field —
 * which looks exactly like a field that does not work.
 */
export function inspectDelimiters(delimiters: string[]): TagsWarning | null {
  if (delimiters.length > 0) return null
  return {
    code: 'no-delimiters',
    prop: 'delimiters',
    received: '[]',
    message:
      '`delimiters` is empty, so nothing commits a tag except blurring the field. Falling back to Enter.',
  }
}
