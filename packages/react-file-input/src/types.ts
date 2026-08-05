import type { CSSProperties, FocusEvent, ReactNode } from 'react'
import type { FileAttempt, FileRejection } from './files'

/** Stable machine code for a coerced or misconfigured input. Safe to `switch` on. */
export type FileWarningCode =
  | 'max-files-invalid'
  | 'size-range-invalid'
  | 'negative-size'
  | 'accept-suspicious'
  | 'single-with-max'

/**
 * Emitted when the component keeps itself functional despite a prop it cannot
 * use as given — a `maxFiles` below one, a `minSize` above `maxSize`, an
 * `accept` string that will match nothing. What renders is the coerced result,
 * so this is a development-only heads-up, never an error.
 */
export interface FileWarning {
  code: FileWarningCode
  /** The prop that carried the offending value. */
  prop: string
  /** The value as received. */
  received: string
  /** Human-readable explanation, safe to log as-is. */
  message: string
}

/** One selected file, with everything the renderer needs. */
export interface FileEntry {
  file: File
  /** Stable across renders for the same file — safe as a React key. */
  key: string
  /**
   * An object URL for an image, or `undefined`. Created lazily and revoked
   * automatically when the file is removed or the component unmounts.
   */
  preview?: string
}

/** State handed to the `renderFile` render prop. */
export interface FileEntryState extends FileEntry {
  index: number
  /** Human-readable size, e.g. `1.2 MB`. */
  size: string
  disabled: boolean
  readOnly: boolean
}

export interface FileInputProps {
  // ---- Value ----------------------------------------------------------------
  /** Controlled list of files. */
  value?: File[]
  /** Uncontrolled initial list. Ignored when `value` is provided. */
  defaultValue?: File[]
  onChange?: (files: File[]) => void
  /** Fires for each file actually added, after it passed every rule. */
  onAdd?: (file: File, files: File[]) => void
  /** Fires for each file removed, with the index it occupied. */
  onRemove?: (file: File, index: number, files: File[]) => void
  /** Fires for each file refused, with a machine-readable reason. */
  onReject?: (attempt: FileAttempt) => void

  // ---- Rules ----------------------------------------------------------------
  /** `accept` string, exactly as `<input accept>` takes it. */
  accept?: string
  /** Largest allowed file, in bytes. */
  maxSize?: number
  /** Smallest allowed file, in bytes. */
  minSize?: number
  /** Maximum number of files. Ignored when `multiple` is false. */
  maxFiles?: number
  /** Accept more than one file. @default false, like the native input */
  multiple?: boolean
  /** Treat same name + size + timestamp as the same file. @default true */
  dedupe?: boolean
  /** Final say: `true`, `false`, or a string explaining the refusal. */
  validate?: (file: File, existing: File[]) => boolean | string

  // ---- Previews -------------------------------------------------------------
  /**
   * Create object URLs for image files, revoked automatically on removal and
   * unmount. Off by default: a URL that is never revoked is a memory leak, and
   * the caller should opt into the lifecycle deliberately.
   * @default false
   */
  previews?: boolean

  // ---- Presentation ---------------------------------------------------------
  /**
   * Accessible name for the field. **Not rendered** — supply your own visible
   * `<label htmlFor={`${id}-input`}>` when the design calls for one, exactly as
   * every other input in the suite expects. A node is exposed through a hidden
   * element, since `aria-label` only takes a string.
   */
  label?: ReactNode
  /** Text inside the drop zone. @default a stock sentence */
  hint?: ReactNode
  /** Accessible name for one file's remove button. @default ``Remove ${name}`` */
  removeLabel?: (file: File) => string
  /** Custom rendering for one file row. */
  renderFile?: (state: FileEntryState) => ReactNode
  /** Announcement text for the live region. Return `''` to say nothing. */
  announce?: (event: {
    type: 'add' | 'remove' | 'reject'
    files: File[]
    added?: number
    rejected?: FileAttempt[]
  }) => string
  className?: string
  style?: CSSProperties

  // ---- Form integration -----------------------------------------------------
  /** Name for the underlying `<input type="file">`. */
  name?: string
  required?: boolean
  disabled?: boolean
  /** Show the selection but refuse changes. */
  readOnly?: boolean
  /** Sets `aria-invalid` and `data-invalid`. */
  invalid?: boolean
  /** ids of external error/help text. */
  'aria-describedby'?: string
  /** Base id; the input, drop zone, list and live region derive ids from it. */
  id?: string
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void

  // ---- Diagnostics ----------------------------------------------------------
  /**
   * Called in development whenever a prop is rejected or coerced — see
   * {@link FileWarning}. When omitted, the same warnings go to `console.warn`.
   * The entire path is stripped from production builds.
   */
  onWarn?: (warning: FileWarning) => void
}

export type { FileAttempt, FileRejection }
