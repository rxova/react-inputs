import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ClipboardEvent, FocusEvent, KeyboardEvent } from 'react'
import { attempt, attemptAll, sanitize, splitPasted } from './tags'
import type { TagAttempt, TagRules } from './tags'
import {
  inspectDelimiters,
  inspectLengthRange,
  inspectMax,
  inspectValueEntries,
  inspectValueShape,
} from './warn'
import type { TagsWarning } from './types'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'

const DEFAULT_DELIMITERS = ['Enter', ',']

export interface UseTagsInputOptions extends TagRules {
  value?: string[]
  defaultValue?: string[]
  onChange?: (tags: string[]) => void
  onAdd?: (tag: string, tags: string[]) => void
  onRemove?: (tag: string, index: number, tags: string[]) => void
  onReject?: (attempt: TagAttempt) => void
  delimiters?: string[]
  splitPaste?: boolean
  addOnBlur?: boolean
  announce?: (event: { type: 'add' | 'remove' | 'reject'; tag: string; tags: string[] }) => string
  disabled?: boolean
  readOnly?: boolean
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void
  onWarn?: (warning: TagsWarning) => void
  id?: string
}

export interface UseTagsInputResult {
  /** The committed tags. */
  tags: string[]
  /** What is currently typed but not yet committed. */
  text: string
  /**
   * The tag that holds the list's single tab stop. `-1` when there are no tags.
   * See the roving-tabindex note on `tagProps` in the README.
   */
  activeIndex: number
  /** The tag that actually has DOM focus, or `null` when focus is elsewhere. */
  focusedIndex: number | null
  /** Wire to each tag's `onFocus`/`onBlur` so `focusedIndex` stays truthful. */
  setFocusedIndex: (index: number | null) => void
  /** Text for the polite live region. Changes only when there is something to say. */
  announcement: string
  /** `max` has been reached, so the entry box will refuse anything more. */
  full: boolean
  disabled: boolean
  readOnly: boolean
  ids: {
    root: string
    list: string
    input: string
    /** Only referenced when `label` is a node rather than a string. */
    label: string
    announcement: string
  }
  /**
   * Structural rather than `RefObject`: in @types/react 18 `RefObject.current`
   * is readonly, in 19 it is mutable. Declaring the shape keeps this assignable
   * under both, which matters because `react >= 18` is a peer.
   */
  inputRef: { current: HTMLInputElement | null }
  tagRefs: { current: (HTMLElement | null)[] }
  setText: (next: string) => void
  /** Commit whatever is in the entry box. Returns whether anything was added. */
  commit: () => boolean
  /** Empty the field — every tag and the entry box — and announce it. */
  clear: () => void
  /** Add one candidate directly, applying every rule. */
  addTag: (raw: string) => boolean
  removeAt: (index: number) => void
  /** Move the roving tab stop, and focus, by `delta` tags. */
  moveActive: (delta: number) => void
  focusTag: (index: number) => void
  focusInput: () => void
  handleInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  handleTagKeyDown: (event: KeyboardEvent<HTMLElement>, index: number) => void
  handlePaste: (event: ClipboardEvent<HTMLInputElement>) => void
  handleBlur: (event: FocusEvent<HTMLElement>) => void
  handleFocus: (event: FocusEvent<HTMLElement>) => void
}

/**
 * Headless state for a tag field: the list, the entry box, the roving tab stop
 * and the announcements. Exported so a consumer can build a completely custom
 * renderer without reimplementing the fiddly parts — the roving tabindex and
 * the focus bookkeeping after a removal especially.
 */
export function useTagsInput(options: UseTagsInputOptions): UseTagsInputResult {
  const {
    value: valueProp,
    defaultValue,
    onChange,
    onAdd,
    onRemove,
    onReject,
    delimiters: delimitersProp = DEFAULT_DELIMITERS,
    splitPaste: splitOnPaste = true,
    addOnBlur = true,
    announce,
    trim = true,
    allowDuplicates = false,
    caseSensitive = false,
    max: maxProp,
    minLength: minLengthProp,
    maxLength: maxLengthProp,
    transform,
    validate,
    disabled = false,
    readOnly = false,
    onBlur,
    onFocus,
    onWarn,
    id: idProp,
  } = options

  const reactId = useId()
  const baseId = idProp ?? `rx-tags-${reactId}`

  // A `max` that cannot bound anything is dropped rather than enforced: a field
  // that can hold no tags is not a field.
  const max =
    maxProp !== undefined && Number.isInteger(maxProp) && maxProp >= 1 ? maxProp : undefined
  // A length range nothing can satisfy is dropped whole, rather than leaving
  // one half enforced and the other silently ignored.
  const rangeUsable =
    minLengthProp === undefined || maxLengthProp === undefined || minLengthProp <= maxLengthProp
  const minLength = rangeUsable ? minLengthProp : undefined
  const maxLength = rangeUsable ? maxLengthProp : undefined
  // Memoised so the fallback array is not a fresh reference on every render,
  // which would rebuild every handler that depends on it.
  const delimiters = useMemo(
    () => (delimitersProp.length > 0 ? delimitersProp : ['Enter']),
    [delimitersProp],
  )

  const rules: TagRules = useMemo(
    () => ({
      trim,
      allowDuplicates,
      caseSensitive,
      max,
      minLength,
      maxLength,
      transform,
      validate,
    }),
    [trim, allowDuplicates, caseSensitive, max, minLength, maxLength, transform, validate],
  )

  const isControlled = valueProp !== undefined
  const [uncontrolled, setUncontrolled] = useState(() => sanitize(defaultValue, rules))
  /**
   * A controlled `value` is sanitised on every render rather than stored.
   *
   * The alternative — copying it into state — would let the two drift when a
   * parent passes something the rules reject, and the field would keep showing
   * a tag the parent no longer believes in.
   */
  const tags = isControlled ? sanitize(valueProp, rules) : uncontrolled

  const [text, setText] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const inputRef = useRef<HTMLInputElement | null>(null)
  const tagRefs = useRef<(HTMLElement | null)[]>([])
  /**
   * Set when a removal should move focus, applied after the list re-renders.
   *
   * `expect` is the length the list should have when the move is applied. A
   * controlled parent may refuse the removal, and refusing still causes renders
   * — the announcement is state — so an unvalidated stash gets replayed against
   * a list that never changed, and survives until the parent's next unrelated
   * render before yanking focus off whatever the user is on.
   */
  const pendingFocus = useRef<{ target: number | 'input'; expect: number } | null>(null)
  /** Where the caret belongs after a paste the component consumed. */
  const pendingCaret = useRef<number | null>(null)

  const full = max !== undefined && tags.length >= max

  const ids = useMemo(
    () => ({
      root: baseId,
      list: `${baseId}-list`,
      input: `${baseId}-input`,
      label: `${baseId}-label`,
      announcement: `${baseId}-announcement`,
    }),
    [baseId],
  )

  // Development-only configuration diagnostics. Guarded so a production bundler
  // drops the branch — and with it `warn.ts` entirely. Deduped per instance so
  // a re-rendering parent warns once, not once per keystroke.
  const warned = useRef<Set<string> | null>(null)
  useEffect(() => {
    // A bundler folds this to a constant and drops the whole effect body in a
    // production build, so the branch is unreachable once compiled and cannot
    // be exercised by the (always-development) test build.
    /* v8 ignore next */
    if (process.env.NODE_ENV === 'production') return
    const seen = (warned.current ??= new Set<string>())
    const emit = (warning: TagsWarning | null) => {
      if (!warning) return
      const key = `${warning.code}:${warning.received}`
      if (seen.has(key)) return
      seen.add(key)
      if (onWarn) onWarn(warning)
      // The library ships no console noise in production; this line is only
      // reached in development and is dropped from production builds.
      // eslint-disable-next-line no-console
      else console.warn(`[react-tags-input] ${warning.message}`)
    }

    const raw: unknown = isControlled ? valueProp : defaultValue
    const prop = isControlled ? 'value' : 'defaultValue'
    if (raw !== undefined) {
      emit(inspectValueShape(raw, prop))
      for (const warning of inspectValueEntries(raw, prop, {
        allowDuplicates,
        caseSensitive,
        max,
      })) {
        emit(warning)
      }
    }
    emit(inspectMax(maxProp))
    emit(inspectLengthRange(minLengthProp, maxLengthProp))
    emit(inspectDelimiters(delimitersProp))
  }, [
    isControlled,
    valueProp,
    defaultValue,
    allowDuplicates,
    caseSensitive,
    max,
    maxProp,
    minLengthProp,
    maxLengthProp,
    delimitersProp,
    onWarn,
  ])

  const say = useCallback(
    (type: 'add' | 'remove' | 'reject', tag: string, next: string[]) => {
      if (announce) {
        setAnnouncement(announce({ type, tag, tags: next }))
        return
      }
      const count = `${String(next.length)} tag${next.length === 1 ? '' : 's'}`
      // A rejection is deliberately not announced by default: the text stays in
      // the box and the visible rejection is the feedback. Announcing every
      // duplicate keystroke would talk over the user as they type.
      setAnnouncement(type === 'add' ? `Added ${tag}. ${count}.` : `Removed ${tag}. ${count}.`)
    },
    [announce],
  )

  const commitTags = useCallback(
    (next: string[]) => {
      if (!isControlled) setUncontrolled(next)
      onChange?.(next)
    },
    [isControlled, onChange],
  )

  const addTag = useCallback(
    (raw: string): boolean => {
      if (disabled || readOnly) return false
      const result = attempt(tags, raw, rules)
      if (!result.accepted) {
        onReject?.(result)
        return false
      }
      const next = [...tags, result.tag]
      commitTags(next)
      onAdd?.(result.tag, next)
      say('add', result.tag, next)
      return true
    },
    [disabled, readOnly, tags, rules, onReject, commitTags, onAdd, say],
  )

  const commit = useCallback((): boolean => {
    if (text === '') return false
    const added = addTag(text)
    // The text is cleared only on success. A refused entry stays in the box so
    // the user can correct it rather than retyping from memory.
    if (added) setText('')
    return added
  }, [text, addTag])

  const clear = useCallback(() => {
    if (disabled || readOnly) return
    setText('')
    if (tags.length === 0) return
    commitTags([])
    setAnnouncement(
      announce ? announce({ type: 'remove', tag: '', tags: [] }) : 'Removed all tags.',
    )
  }, [disabled, readOnly, tags.length, commitTags, announce])

  const focusTag = useCallback((index: number) => {
    tagRefs.current[index]?.focus()
  }, [])

  const focusInput = useCallback(() => {
    inputRef.current?.focus()
  }, [])

  const removeAt = useCallback(
    (index: number) => {
      if (disabled || readOnly) return
      const tag = tags[index]
      if (tag === undefined) return
      const next = tags.filter((_entry, position) => position !== index)
      commitTags(next)
      onRemove?.(tag, index, next)
      say('remove', tag, next)

      /**
       * Where focus goes after a removal.
       *
       * Leaving it on a button that no longer exists drops focus to `<body>`,
       * which is the single most common accessibility failure in this widget:
       * a keyboard user deletes a tag and loses their place on the page. So the
       * next tag takes it, or the previous one if that was the last, or the
       * entry box if the list is now empty.
       */
      pendingFocus.current = {
        target: next.length === 0 ? 'input' : Math.min(index, next.length - 1),
        expect: next.length,
      }
    },
    [disabled, readOnly, tags, commitTags, onRemove, say],
  )

  useEffect(() => {
    const pending = pendingFocus.current
    if (pending === null) return
    // Dropped, not deferred, when the list that arrived is not the one the
    // removal asked for: a controlled parent refused it, and the control the
    // user is on is still there.
    if (tags.length !== pending.expect) {
      pendingFocus.current = null
      return
    }
    pendingFocus.current = null
    if (pending.target === 'input') {
      focusInput()
      setActiveIndex(0)
      return
    }
    setActiveIndex(pending.target)
    focusTag(pending.target)
  }, [tags, focusInput, focusTag])

  const moveActive = useCallback(
    (delta: number) => {
      if (tags.length === 0) return
      const from = focusedIndex ?? activeIndex
      const next = from + delta
      // Past the last tag is the entry box, which is where a user arrowing
      // right expects to end up — not wrapped back to the first tag.
      if (next >= tags.length) {
        focusInput()
        return
      }
      const clamped = Math.max(0, next)
      setActiveIndex(clamped)
      focusTag(clamped)
    },
    [tags.length, focusedIndex, activeIndex, focusInput, focusTag],
  )

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (disabled || readOnly) return
      if (event.altKey || event.ctrlKey || event.metaKey) return
      /**
       * Every key belongs to the IME while a composition is in flight.
       *
       * With a Japanese, Chinese or Korean IME the `Enter` that *confirms a
       * candidate* arrives as an ordinary keydown. Treating it as a delimiter
       * committed the half-composed text and ate the keystroke meant to accept
       * the candidate, which made the field unusable in those languages;
       * Backspace, which deletes a candidate character, reached for the last
       * tag instead.
       */
      if (event.nativeEvent.isComposing) return

      if (delimiters.includes(event.key)) {
        // Tab is only a delimiter if the caller asked for it, and even then it
        // must not commit an empty box — that would trap the user in the field.
        if (event.key === 'Tab' && text === '') return
        event.preventDefault()
        commit()
        return
      }

      if (event.key === 'Backspace' && text === '' && tags.length > 0) {
        /**
         * Two steps, not one.
         *
         * A single Backspace that deletes the last tag outright is the common
         * implementation and it destroys data the user cannot see they are
         * about to lose. This moves focus onto the tag first; the next
         * Backspace — now on the tag itself, where it is visibly selected —
         * removes it.
         */
        event.preventDefault()
        const last = tags.length - 1
        setActiveIndex(last)
        focusTag(last)
        return
      }

      if (event.key === 'ArrowLeft' && text === '' && tags.length > 0) {
        event.preventDefault()
        const last = tags.length - 1
        setActiveIndex(last)
        focusTag(last)
      }
    },
    [disabled, readOnly, delimiters, text, tags.length, commit, focusTag],
  )

  const handleTagKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, index: number) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      switch (event.key) {
        case 'Backspace':
        case 'Delete':
          event.preventDefault()
          removeAt(index)
          break
        case 'ArrowLeft':
          event.preventDefault()
          moveActive(-1)
          break
        case 'ArrowRight':
          event.preventDefault()
          moveActive(1)
          break
        case 'Home':
          event.preventDefault()
          setActiveIndex(0)
          focusTag(0)
          break
        case 'End':
          event.preventDefault()
          focusInput()
          break
        default:
          // Typing a printable character while a tag has focus means the user
          // wants to keep going, so hand them the entry box with the keystroke
          // intact rather than swallowing it.
          if (event.key.length === 1 && !disabled && !readOnly) focusInput()
          break
      }
    },
    [removeAt, moveActive, focusTag, focusInput, disabled, readOnly],
  )

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>) => {
      if (disabled || readOnly || !splitOnPaste) return
      const pasted = event.clipboardData.getData('text')
      const candidates = splitPasted(pasted, delimiters)
      // A paste with nothing to split on is left to the browser, so the text
      // simply lands in the box the way the user expects.
      if (candidates.length <= 1) return

      event.preventDefault()
      /**
       * What the box keeps.
       *
       * Preventing the paste makes the surrounding text the component's
       * responsibility. Clearing the box outright — which is what this did —
       * destroyed anything the user had already typed: it was neither committed
       * as a tag nor left behind to be corrected. Only the range the paste
       * would have replaced is consumed.
       */
      const element = event.currentTarget
      const start = element.selectionStart ?? text.length
      const end = element.selectionEnd ?? start
      const kept = text.slice(0, start) + text.slice(end)
      const { tags: next, results } = attemptAll(tags, candidates, rules)
      const added = results.filter((result) => result.accepted)
      for (const result of results) if (!result.accepted) onReject?.(result)
      if (added.length === 0) return

      commitTags(next)
      for (const result of added) onAdd?.(result.tag, next)
      setText(kept)
      pendingCaret.current = start
      // One announcement for the batch. Saying each of forty pasted tags in
      // turn is not information, it is a denial of service on the screen reader.
      // `added` is non-empty here, so the lookup always hits; the `??` exists
      // because indexing is typed as possibly-undefined.
      /* v8 ignore next 2 */
      const label = added.length === 1 ? (added[0]?.tag ?? '') : `${String(added.length)} tags`
      setAnnouncement(`Added ${label}. ${String(next.length)} tags.`)
    },
    [disabled, readOnly, splitOnPaste, delimiters, text, tags, rules, onReject, commitTags, onAdd],
  )

  useIsomorphicLayoutEffect(() => {
    const caret = pendingCaret.current
    if (caret === null) return
    pendingCaret.current = null
    const element = inputRef.current
    /* v8 ignore next */
    if (element === null) return
    if (document.activeElement !== element) return
    element.setSelectionRange(caret, caret)
  }, [text])

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      onFocus?.(event)
    },
    [onFocus],
  )

  /**
   * Only emit blur when focus genuinely leaves the field. Moving between a tag
   * and the entry box is still inside it, and a naive per-element onBlur marks
   * the field touched mid-interaction — firing validation while the user is
   * still adding tags.
   */
  const handleBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      const next = event.relatedTarget
      if (next instanceof Node && event.currentTarget.contains(next)) return
      setFocusedIndex(null)
      if (addOnBlur) commit()
      onBlur?.(event)
    },
    [addOnBlur, commit, onBlur],
  )

  return {
    tags,
    text,
    activeIndex: tags.length === 0 ? -1 : Math.min(activeIndex, tags.length - 1),
    focusedIndex,
    announcement,
    full,
    disabled,
    readOnly,
    ids,
    inputRef,
    tagRefs,
    setText,
    commit,
    clear,
    addTag,
    removeAt,
    moveActive,
    focusTag,
    focusInput,
    handleInputKeyDown,
    handleTagKeyDown,
    handlePaste,
    handleBlur,
    handleFocus,
    setFocusedIndex,
  }
}
