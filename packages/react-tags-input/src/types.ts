import type { CSSProperties, FocusEvent, ReactNode } from 'react'
import type { TagAttempt, TagRejection } from './tags'

/** Stable machine code for a coerced or misconfigured input. Safe to `switch` on. */
export type TagsWarningCode =
  | 'value-not-array'
  | 'value-had-non-strings'
  | 'value-had-duplicates'
  | 'value-over-max'
  | 'max-invalid'
  | 'length-range-invalid'
  | 'no-delimiters'

/**
 * Emitted when the component keeps itself functional despite a prop it cannot
 * use as given — a `value` that is not an array of strings, a `max` below zero,
 * an empty `delimiters` list. What renders is the coerced result, so this is a
 * development-only heads-up, never an error.
 */
export interface TagsWarning {
  code: TagsWarningCode
  /** The prop that carried the offending value. */
  prop: string
  /** The value as received, summarised. */
  received: string
  /** Human-readable explanation, safe to log as-is. */
  message: string
}

/** State handed to the `renderTag` render prop. */
export interface TagState {
  tag: string
  index: number
  /** This tag currently holds focus in the roving tab order. */
  focused: boolean
  disabled: boolean
  readOnly: boolean
}

export interface TagsInputProps {
  // ---- Value ----------------------------------------------------------------
  /** Controlled list of tags. */
  value?: string[]
  /** Uncontrolled initial list. Ignored when `value` is provided. */
  defaultValue?: string[]
  onChange?: (tags: string[]) => void
  /** Fires for each tag actually added, after it passed every rule. */
  onAdd?: (tag: string, tags: string[]) => void
  /** Fires for each tag removed, with the index it occupied. */
  onRemove?: (tag: string, index: number, tags: string[]) => void
  /**
   * Fires for a candidate that was refused, with a machine-readable reason and
   * the message `validate` supplied, if any. The text stays in the box so the
   * user can fix it.
   */
  onReject?: (attempt: TagAttempt) => void

  // ---- Entry ----------------------------------------------------------------
  /**
   * Keys and characters that commit the current text. `'Enter'` and `','` by
   * default; `'Tab'` is accepted but changes what Tab means, so it is opt-in.
   */
  delimiters?: string[]
  /** Split a paste on the delimiters (and on newlines regardless). @default true */
  splitPaste?: boolean
  /** Commit whatever is in the box when focus leaves the field. @default true */
  addOnBlur?: boolean
  /** Text in the entry box. */
  placeholder?: string

  // ---- Rules ----------------------------------------------------------------
  /** Strip leading and trailing whitespace. @default true */
  trim?: boolean
  /** Allow the same tag twice. @default false */
  allowDuplicates?: boolean
  /** Compare case-sensitively when deduplicating. @default false */
  caseSensitive?: boolean
  /** Maximum number of tags. */
  max?: number
  /** Minimum length of one tag, in codepoints. */
  minLength?: number
  /** Maximum length of one tag, in codepoints. */
  maxLength?: number
  /** Rewrite an entry before it is checked. */
  transform?: (raw: string) => string
  /** Final say: `true`, `false`, or a string explaining the refusal. */
  validate?: (tag: string, existing: string[]) => boolean | string

  // ---- Presentation ---------------------------------------------------------
  /**
   * Accessible name for the field. **Not rendered** — supply your own visible
   * `<label htmlFor={`${id}-input`}>` when the design calls for one, exactly as
   * every other input in the suite expects. A node is exposed through a hidden
   * element, since `aria-label` only takes a string.
   */
  label?: ReactNode
  /** Accessible name for one tag's remove button. @default ``Remove ${tag}`` */
  removeLabel?: (tag: string) => string
  /** Custom rendering for one tag's contents. */
  renderTag?: (state: TagState) => ReactNode
  /**
   * Announcement text for the live region. Return `''` to say nothing.
   * @default `Added ${tag}, 3 tags` / `Removed ${tag}, 2 tags`
   */
  announce?: (event: { type: 'add' | 'remove' | 'reject'; tag: string; tags: string[] }) => string
  /** Writing direction for the field. Inherited from the document when unset. */
  dir?: 'ltr' | 'rtl'
  className?: string
  style?: CSSProperties

  // ---- Form integration -----------------------------------------------------
  /** Emits one hidden input per tag, so a native `<form>` posts an array. */
  name?: string
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
  /** Focus the field on mount. @default false */
  autoFocus?: boolean
  /**
   * Accessible name, when there is no visible text to point `label` at. Wins
   * over `label` if both are given.
   */
  'aria-label'?: string
  /** Sets `aria-invalid` and `data-invalid`. */
  invalid?: boolean
  /** ids of external error/help text. */
  'aria-describedby'?: string
  /** Base id; the list, the entry box and the live region derive ids from it. */
  id?: string
  /** Fires when focus leaves the whole field, not when moving between its parts. */
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void

  // ---- Diagnostics ----------------------------------------------------------
  /**
   * Called in development whenever a prop is rejected or coerced — see
   * {@link TagsWarning}. When omitted, the same warnings go to `console.warn`.
   * The entire path is stripped from production builds.
   */
  onWarn?: (warning: TagsWarning) => void
}

export type { TagAttempt, TagRejection }
