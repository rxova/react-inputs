import type { FileWarning } from './types'

/**
 * Development-only diagnostics.
 *
 * Every function here is reached exclusively from the `NODE_ENV !== 'production'`
 * branch in `useFileInput`, so a production bundler drops this whole module.
 * The coercion itself lives in the hook and always runs; this only *describes*
 * a coercion that already happened.
 */

/** Describe a `maxFiles` that cannot bound anything. */
export function inspectMaxFiles(maxFiles: number | undefined): FileWarning | null {
  if (maxFiles === undefined) return null
  if (Number.isInteger(maxFiles) && maxFiles >= 1) return null
  return {
    code: 'max-files-invalid',
    prop: 'maxFiles',
    received: String(maxFiles),
    message: `\`maxFiles\` must be a whole number of at least 1; received ${String(maxFiles)}. Ignoring it — a field that can hold no files is not a field.`,
  }
}

/** Describe a size range no file could satisfy. */
export function inspectSizeRange(
  minSize: number | undefined,
  maxSize: number | undefined,
): FileWarning | null {
  if (minSize === undefined || maxSize === undefined) return null
  if (minSize <= maxSize) return null
  return {
    code: 'size-range-invalid',
    prop: 'minSize',
    received: `${String(minSize)} > ${String(maxSize)}`,
    message: `\`minSize\` (${String(minSize)}) is greater than \`maxSize\` (${String(maxSize)}); no file can satisfy both. Ignoring both.`,
  }
}

/** Describe a negative size bound, which would refuse everything or nothing. */
export function inspectSize(size: number | undefined, prop: string): FileWarning | null {
  if (size === undefined) return null
  if (Number.isFinite(size) && size >= 0) return null
  return {
    code: 'negative-size',
    prop,
    received: String(size),
    message: `\`${prop}\` must be a non-negative number of bytes; received ${String(size)}. Ignoring it.`,
  }
}

/**
 * Describe an `accept` string that will match nothing.
 *
 * The two mistakes are writing a bare extension without the dot (`png`) and
 * writing a wildcard the spec does not have (`*.png`, `image/*.png`). Both look
 * plausible and both silently refuse every file, which reads as a broken field
 * rather than a typo.
 */
export function inspectAccept(accept: string | undefined): FileWarning | null {
  if (accept === undefined || accept.trim() === '') return null
  const patterns = accept
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')

  const suspicious = patterns.filter((pattern) =>
    pattern.includes('*')
      ? !/^[a-z]+\/\*$/i.test(pattern)
      : !pattern.startsWith('.') && !pattern.includes('/'),
  )
  if (suspicious.length === 0) return null

  return {
    code: 'accept-suspicious',
    prop: 'accept',
    received: suspicious.join(', '),
    message: `\`accept\` contains ${suspicious.join(', ')}, which will match nothing. Use an extension with its dot (".png"), a full type ("image/png"), or a group wildcard ("image/*").`,
  }
}

/** Describe a `maxFiles` on a single-file field, where it does nothing. */
export function inspectSingleWithMax(
  multiple: boolean,
  maxFiles: number | undefined,
): FileWarning | null {
  if (multiple || maxFiles === undefined) return null
  return {
    code: 'single-with-max',
    prop: 'maxFiles',
    received: String(maxFiles),
    message: `\`maxFiles\` is set but \`multiple\` is not, so the field already holds at most one file. Add \`multiple\` if you meant to accept several.`,
  }
}
