// Temporary: exercises the changeset gate on this branch, and is removed before merge.
import type { OtpMode, OtpSlotState } from './types'

/** One-character allowed-set testers per mode. Anchored, single-char. */
const MODE_PATTERN: Record<OtpMode, RegExp> = {
  numeric: /^[0-9]$/,
  alphanumeric: /^[a-zA-Z0-9]$/,
  alpha: /^[a-zA-Z]$/,
}

/** Positive integer, else fall back to 6 — a length of 0 or NaN is garbage config, not a crash. */
export function normalizeLength(length: number | undefined): number {
  if (length === undefined || !Number.isFinite(length)) return 6
  const n = Math.floor(length)
  return n >= 1 ? n : 6
}

/**
 * Build the per-character predicate. An explicit `pattern` beats `mode`.
 *
 * A caller's `RegExp` may carry the `g` flag, whose `lastIndex` makes repeated
 * `.test()` calls alternate true/false on the same input. The expression is
 * rebuilt without `g`/`y` so the predicate is pure, and tested one code point
 * at a time so a multi-character class cannot match a two-character paste
 * fragment as a unit.
 */
export function resolveIsAllowed(
  mode: OtpMode,
  pattern: RegExp | string | undefined,
): (char: string) => boolean {
  if (pattern === undefined) {
    const re = MODE_PATTERN[mode]
    return (char) => re.test(char)
  }
  const source = typeof pattern === 'string' ? pattern : pattern.source
  const flags = typeof pattern === 'string' ? '' : pattern.flags.replace(/[gy]/g, '')
  let re: RegExp
  try {
    re = new RegExp(source, flags)
  } catch {
    // A malformed custom pattern must not throw during render. Fall back to the
    // mode's built-in set — a broken filter that still accepts sane characters
    // beats a blank screen.
    re = MODE_PATTERN[mode]
  }
  // Reject genuine multi-character fragments, but count by code point so an
  // astral character (a length-2 surrogate pair) still passes as one slot.
  return (char) => Array.from(char).length === 1 && re.test(char)
}

/**
 * Coerce anything to a valid value: drop disallowed characters, apply the
 * caller's `transform`, then clamp to `length`. Never throws — a controlled
 * `value` of `undefined`, a number, an over-length string, or SMS garbage all
 * resolve to a clean string. Order matters: filter first so `transform` (e.g.
 * `toUpperCase`) sees only real characters, clamp last so `transform` can't
 * push the value past `length`.
 */
export function sanitize(
  raw: unknown,
  length: number,
  isAllowed: (char: string) => boolean,
  transform?: (value: string) => string,
): string {
  // A value should be a string (or a number, e.g. `123456`). Anything else is
  // garbage config, not a code — coerce it to empty rather than to
  // "[object Object]" and then filtering that down to noise.
  const str =
    typeof raw === 'string'
      ? raw
      : typeof raw === 'number' && Number.isFinite(raw)
        ? String(raw)
        : ''
  let out = ''
  // Iterate by code point so an astral character counts as one slot, not two.
  for (const char of str) {
    if (isAllowed(char)) out += char
  }
  if (transform) out = transform(out)
  // Clamp by code point, not UTF-16 unit, so the count matches buildSlots' chars.
  const points = Array.from(out)
  return points.length > length ? points.slice(0, length).join('') : out
}

/** Default paste cleaner: strip whitespace and the `- . _` separators formatted codes carry. */
export function defaultPasteTransform(pasted: string): string {
  return pasted.replace(/[\s._-]/g, '')
}

/**
 * Replace the `[start, end)` range of `value` with `insert`, then clamp to
 * `length`. Returns the new string and where the caret should land. Used for
 * paste (and paste-over-selection); native typing is left to the platform.
 */
export function spliceValue(
  value: string,
  start: number,
  end: number,
  insert: string,
  length: number,
): { value: string; caret: number } {
  const lo = Math.max(0, Math.min(start, end, value.length))
  const hi = Math.max(0, Math.max(start, end))
  const next = (value.slice(0, lo) + insert + value.slice(hi)).slice(0, length)
  const caret = Math.min(lo + insert.length, length)
  return { value: next, caret }
}

/** `value.length === length`, and `length > 0` so an empty field is never "complete". */
export function isComplete(value: string, length: number): boolean {
  return length > 0 && value.length === length
}

export interface SelectionRange {
  start: number
  end: number
}

/**
 * When the value is full, a collapsed caret has nowhere to insert — the
 * input's `maxLength` silently drops every keystroke — so typing on a focused
 * mid slot would be dead. Decide the one-character range the caret should
 * cover instead, so the next key natively *replaces* that character
 * (input-otp lineage). Returns `null` when the selection must be left alone:
 * a real range, a field with room to insert, or a caret parked at the very
 * end without `clampEnd` (continuous overflow typing stays ignored rather
 * than eating the last slot; a pointer press on the last slot passes
 * `clampEnd` so a deliberate tap still overwrites it).
 *
 * `prev` is the selection before this move: a caret collapsing onto the start
 * of the previous one-slot range is an arrow-left step, so the overwrite
 * target advances one slot further left.
 */
export function expandOverwriteRange(
  start: number,
  end: number,
  valueLength: number,
  length: number,
  prev: SelectionRange | null,
  clampEnd: boolean,
): SelectionRange | null {
  if (start !== end || valueLength < length) return null
  if (start >= length && !clampEnd) return null
  const caret = Math.min(start, length - 1)
  const movedBack = prev !== null && prev.start !== prev.end && caret === prev.start && caret > 0
  const slot = movedBack ? caret - 1 : caret
  return { start: slot, end: slot + 1 }
}

interface BuildSlotsInput {
  value: string
  length: number
  selectionStart: number
  selectionEnd: number
  isFocused: boolean
  isDisabled: boolean
  isReadOnly: boolean
  placeholder: string | null
  maskChar: string | null
}

/**
 * Map a value + selection onto per-slot state. Pure index arithmetic — no
 * geometry — so it is fully testable in node; the browser project owns the
 * click-to-caret geometry that produces `selectionStart` in the first place.
 *
 * Active/caret model (input-otp lineage): a collapsed caret activates the slot
 * it sits in (clamped to the last slot when the value is full, so the caret
 * shows on the final character rather than vanishing off the end); a range
 * selection activates every slot it covers.
 */
export function buildSlots({
  value,
  length,
  selectionStart,
  selectionEnd,
  isFocused,
  isDisabled,
  isReadOnly,
  placeholder,
  maskChar,
}: BuildSlotsInput): OtpSlotState[] {
  const chars = Array.from(value)
  const collapsed = selectionStart === selectionEnd
  const caretSlot = collapsed ? Math.min(selectionStart, length - 1) : -1

  const slots: OtpSlotState[] = new Array<OtpSlotState>(length)
  for (let i = 0; i < length; i++) {
    const raw = chars[i] ?? null
    const char = raw !== null && maskChar !== null ? maskChar : raw
    const hasFakeCaret = isFocused && collapsed && caretSlot === i
    const inRange = !collapsed && i >= selectionStart && i < selectionEnd
    slots[i] = {
      index: i,
      char,
      isFilled: raw !== null,
      isActive: isFocused && (hasFakeCaret || inRange),
      hasFakeCaret,
      placeholder: raw === null ? placeholder : null,
      isDisabled,
      isReadOnly,
    }
  }
  return slots
}

/** Resolve the `mask` prop to the character to paint, or `null` for no masking. */
export function resolveMaskChar(mask: boolean | string | undefined): string | null {
  if (!mask) return null
  return typeof mask === 'string' && mask.length > 0 ? mask : '•'
}

/** `inputMode` for the soft keyboard. Only `numeric` gets the digit pad. */
export function inputModeFor(mode: OtpMode): 'numeric' | 'text' {
  return mode === 'numeric' ? 'numeric' : 'text'
}

export interface SpatialLayout {
  /** Extra tracking so each glyph advances by one slot pitch. */
  letterSpacing: number
  /** Left inset so the first glyph centres in the first slot; the rest follow by pitch. */
  textIndent: number
}

/**
 * The letter-spacing + indent (in px) that lay a monospace input's glyphs at the
 * true slot pitch, so a tap lands the caret on the slot under the finger. Pure
 * geometry, unit-tested here; the component only measures `slotWidth` / `gap` /
 * `charWidth` and applies the result. Returns `null` when geometry isn't
 * measurable yet (zero/NaN width), so the caller simply leaves the input as-is.
 */
export function spatialLayout(
  slotWidth: number,
  gap: number,
  charWidth: number,
): SpatialLayout | null {
  if (!(charWidth > 0) || !(slotWidth > 0)) return null
  return { letterSpacing: slotWidth + gap - charWidth, textIndent: (slotWidth - charWidth) / 2 }
}
