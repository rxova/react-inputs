/**
 * Pure file-list arithmetic: matching `accept`, sizing, deduplicating,
 * validating.
 *
 * `File` is a browser type, but nothing here touches the DOM or React — these
 * are functions from a file's *metadata* to a verdict, which is what lets a
 * consumer re-run the same rules on the server against whatever was uploaded.
 * The client-side check stops a mistake; it does not secure anything.
 */

/** Why a file was refused. Stable codes, safe to `switch` on. */
export type FileRejection =
  'type' | 'too-large' | 'too-small' | 'duplicate' | 'max-files' | 'invalid'

/** The outcome of trying to accept one file. */
export interface FileAttempt {
  file: File
  accepted: boolean
  reason?: FileRejection
  /** A human-readable reason, when `validate` supplied one. */
  message?: string
}

export interface FileRules {
  /**
   * Comma-separated `accept` string, exactly as `<input accept>` takes it:
   * extensions (`.png`), full types (`image/png`), and wildcards (`image/*`).
   */
  accept?: string
  /** Largest allowed file, in bytes. */
  maxSize?: number
  /** Smallest allowed file, in bytes. Catches the 0-byte file a failed copy leaves behind. */
  minSize?: number
  /** Maximum number of files. */
  maxFiles?: number
  /** Treat two files with the same name, size and timestamp as the same file. @default true */
  dedupe?: boolean
  /** Final say. Return `true`, `false`, or a string explaining the refusal. */
  validate?: (file: File, existing: File[]) => boolean | string
}

/**
 * Identity for deduplication.
 *
 * Name, size and last-modified together: the browser gives no stable id for a
 * file, and hashing the contents would mean reading every byte of a 2 GB video
 * to answer a question the user does not care much about. Two files matching on
 * all three are the same file for any practical purpose.
 */
export function fileKey(file: File): string {
  return `${file.name}:${String(file.size)}:${String(file.lastModified)}`
}

/** The lowercase extension including the dot, or `''` when there is none. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  // A leading dot is a Unix hidden file, not an extension: `.gitignore` has no
  // extension, and treating it as one would match it against `.gitignore` only.
  return dot <= 0 ? '' : name.slice(dot).toLowerCase()
}

/**
 * Whether a file satisfies an `accept` string.
 *
 * Follows the HTML spec's three forms, and is deliberately lenient about a
 * missing MIME type: browsers report `''` for plenty of real files (anything
 * the OS has no association for), and refusing those would reject files the
 * native picker itself offered. When the type is unknown, only the extension
 * can decide.
 */
export function matchesAccept(file: File, accept: string | undefined): boolean {
  if (accept === undefined || accept.trim() === '') return true

  const patterns = accept
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== '')
  if (patterns.length === 0) return true

  const type = file.type.toLowerCase()
  const extension = extensionOf(file.name)

  return patterns.some((pattern) => {
    if (pattern.startsWith('.')) return extension === pattern
    if (pattern.endsWith('/*')) {
      const group = pattern.slice(0, -1)
      return type !== '' && type.startsWith(group)
    }
    return type !== '' && type === pattern
  })
}

/** Bytes as a short human string. Used in the default rejection messages. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  const units = ['B', 'kB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit++
  }
  // Decimal units, not binary: `1 kB` here means 1000 bytes, which is what
  // every operating system's file browser shows the user.
  const rounded = value >= 100 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10
  // The `?? 'B'` can never fire — the loop stops at the last unit — but
  // `noUncheckedIndexedAccess` requires the fallback to be written.
  /* v8 ignore next */
  return `${String(rounded)} ${units[unit] ?? 'B'}`
}

/**
 * Try to accept one file against a list.
 *
 * Returns what *would* happen without mutating anything, so the caller can
 * report each rejection with its own reason rather than silently dropping half
 * a selection.
 */
export function attempt(existing: File[], file: File, rules: FileRules = {}): FileAttempt {
  return attemptWith(existing, file, rules)
}

/**
 * `attempt` with an optional pre-built index of what `existing` already holds.
 *
 * The duplicate check is the only rule that has to look at every file already
 * selected. Called once, a scan is the right shape. Called once per candidate
 * — which is what {@link attemptAll} does when someone selects a whole photo
 * library — it makes the batch quadratic, and it recomputed the incoming
 * file's key on every comparison as well.
 *
 * So `attemptAll` hands down a duplicate test backed by {@link accumulate}'s
 * index. This function never learns what that index is — it asks a question
 * and gets an answer. The array is still what `validate` and the `maxFiles`
 * check see, so nothing about the outcome changes, only how it is found.
 */
function attemptWith(
  existing: readonly File[],
  file: File,
  rules: FileRules = {},
  isDuplicate?: (file: File) => boolean,
): FileAttempt {
  const { accept, maxSize, minSize, maxFiles, dedupe = true, validate } = rules

  if (maxFiles !== undefined && existing.length >= maxFiles) {
    return { file, accepted: false, reason: 'max-files' }
  }
  if (!matchesAccept(file, accept)) return { file, accepted: false, reason: 'type' }
  if (maxSize !== undefined && file.size > maxSize) {
    return { file, accepted: false, reason: 'too-large' }
  }
  if (minSize !== undefined && file.size < minSize) {
    return { file, accepted: false, reason: 'too-small' }
  }
  if (dedupe) {
    const duplicate = isDuplicate
      ? isDuplicate(file)
      : existing.some((entry) => fileKey(entry) === fileKey(file))
    if (duplicate) return { file, accepted: false, reason: 'duplicate' }
  }

  if (validate) {
    let verdict: boolean | string
    try {
      verdict = validate(file, existing as File[])
    } catch {
      // `validate` is consumer code running on every selected file. A broken
      // predicate refuses the file rather than taking the form down.
      verdict = false
    }
    if (verdict !== true) {
      return {
        file,
        accepted: false,
        reason: 'invalid',
        message: typeof verdict === 'string' ? verdict : undefined,
      }
    }
  }

  return { file, accepted: true }
}

/**
 * The growing file list, with the duplicate index that belongs to it.
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
 * silently accepted, found much later by someone looking at an upload.
 *
 * So the pair lives behind one handle and `add` is the only way in. There is
 * no sequence of calls that can put the two out of step.
 */
function accumulate(initial: File[]): {
  list: readonly File[]
  has: (file: File) => boolean
  add: (file: File) => void
} {
  const list = [...initial]
  const keys = new Set(list.map(fileKey))

  return {
    /**
     * The files so far, in order. `readonly` to callers while `add` keeps the
     * mutable binding in this closure: growing the list without touching the
     * index is not something a caller can express, rather than something a
     * comment asks them not to do.
     */
    list,
    has: (file: File) => keys.has(fileKey(file)),
    add: (file: File) => {
      list.push(file)
      keys.add(fileKey(file))
    },
  }
}

/**
 * Accept several files in order, each checked against the list as it grows.
 *
 * Order matters: dropping the same file twice with `dedupe` on must accept the
 * first and refuse the second, which only works if each candidate sees the
 * accumulated result rather than the original list.
 */
export function attemptAll(
  existing: File[],
  candidates: File[],
  rules: FileRules = {},
): { files: File[]; results: FileAttempt[] } {
  const accepted = accumulate(existing)
  const results: FileAttempt[] = []

  for (const candidate of candidates) {
    const result = attemptWith(accepted.list, candidate, rules, accepted.has)
    results.push(result)
    if (result.accepted) accepted.add(result.file)
  }
  return { files: [...accepted.list], results }
}

/** A default, human-readable explanation for a rejection. */
export function describeRejection(result: FileAttempt, rules: FileRules = {}): string {
  const { accept, maxSize, minSize, maxFiles } = rules
  switch (result.reason) {
    case 'type':
      return `${result.file.name} is not an accepted file type${accept === undefined ? '' : ` (${accept})`}.`
    case 'too-large':
      return `${result.file.name} is ${formatBytes(result.file.size)}; the limit is ${formatBytes(maxSize ?? 0)}.`
    case 'too-small':
      return `${result.file.name} is ${formatBytes(result.file.size)}, below the ${formatBytes(minSize ?? 0)} minimum.`
    case 'duplicate':
      return `${result.file.name} has already been added.`
    case 'max-files':
      return `You can add at most ${String(maxFiles ?? 0)} files.`
    default:
      return result.message ?? `${result.file.name} was not accepted.`
  }
}

/** Files a preview URL can meaningfully be made for. */
export function isPreviewable(file: File): boolean {
  return file.type.startsWith('image/')
}
