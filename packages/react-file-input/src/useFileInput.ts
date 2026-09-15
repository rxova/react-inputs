import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FocusEvent } from 'react'
import { attemptAll, fileKey, formatBytes, isPreviewable } from './files'
import type { FileRejected, FileRules } from './files'
import {
  inspectAccept,
  inspectMaxFiles,
  inspectSingleWithMax,
  inspectSize,
  inspectSizeRange,
} from './warn'
import type { FileEntry, FileWarning } from './types'

export interface UseFileInputOptions extends FileRules {
  value?: File[]
  defaultValue?: File[]
  onChange?: (files: File[]) => void
  onAdd?: (file: File, files: File[]) => void
  onRemove?: (file: File, index: number, files: File[]) => void
  onReject?: (attempt: FileRejected) => void
  multiple?: boolean
  previews?: boolean
  announce?: (event: {
    type: 'add' | 'remove' | 'reject'
    files: File[]
    added?: number
    rejected?: FileRejected[]
  }) => string
  disabled?: boolean
  readOnly?: boolean
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void
  onWarn?: (warning: FileWarning) => void
  id?: string
}

export interface UseFileInputResult {
  /** The selected files. */
  files: File[]
  /** One entry per file, with a stable key and an optional preview URL. */
  entries: FileEntry[]
  /** A drag carrying files is currently over the drop zone. */
  dragging: boolean
  /** `maxFiles` reached, or a single-file field that already has one. */
  full: boolean
  /** Text for the polite live region. Changes only when there is something to say. */
  announcement: string
  disabled: boolean
  readOnly: boolean
  multiple: boolean
  ids: {
    root: string
    input: string
    /** Only referenced when `label` is a node rather than a string. */
    label: string
    zone: string
    list: string
    announcement: string
  }
  /**
   * Structural rather than `RefObject`: in @types/react 18 `RefObject.current`
   * is readonly, in 19 it is mutable. Declaring the shape keeps this assignable
   * under both, which matters because `react >= 18` is a peer.
   */
  inputRef: { current: HTMLInputElement | null }
  /** The drop zone, so focus can return to it when the last file goes. */
  zoneRef: { current: HTMLElement | null }
  /** One slot per rendered remove button, indexed like `entries`. */
  removeRefs: { current: (HTMLElement | null)[] }
  /** Open the native picker. The drop zone calls this on click and on Enter/Space. */
  open: () => void
  /** Add several candidates, applying every rule. */
  addFiles: (candidates: File[]) => void
  removeAt: (index: number) => void
  /** Remove every file. */
  clear: () => void
  /** A human-readable size for one file. */
  sizeOf: (file: File) => string
  handleInputChange: (event: ChangeEvent<HTMLInputElement>) => void
  /**
   * Bind to `onDragEnter`. This is the handler that counts the drag depth, so
   * binding `onDragOver` to it as well makes the highlight stick.
   */
  handleDragEnter: (event: DragEvent<HTMLElement>) => void
  handleDragOver: (event: DragEvent<HTMLElement>) => void
  handleDragLeave: (event: DragEvent<HTMLElement>) => void
  handleDrop: (event: DragEvent<HTMLElement>) => void
  handleBlur: (event: FocusEvent<HTMLElement>) => void
  handleFocus: (event: FocusEvent<HTMLElement>) => void
}

/**
 * Headless state for a file field: the selection, the drag state, validation,
 * announcements, and the object-URL lifecycle. Exported so a consumer can build
 * a completely custom renderer without reimplementing the fiddly parts — the
 * preview revocation and the drag-counter especially.
 */
export function useFileInput(options: UseFileInputOptions): UseFileInputResult {
  const {
    value: valueProp,
    defaultValue,
    onChange,
    onAdd,
    onRemove,
    onReject,
    accept,
    maxSize: maxSizeProp,
    minSize: minSizeProp,
    maxFiles: maxFilesProp,
    multiple = false,
    dedupe = true,
    validate,
    previews = false,
    announce,
    disabled = false,
    readOnly = false,
    onBlur,
    onFocus,
    onWarn,
    id: idProp,
  } = options

  const reactId = useId()
  const baseId = idProp ?? `rx-file-${reactId}`

  // A bound that cannot bound anything is dropped rather than enforced.
  const usableMax =
    maxFilesProp !== undefined && Number.isInteger(maxFilesProp) && maxFilesProp >= 1
      ? maxFilesProp
      : undefined
  // A single-file field is capped at one whatever `maxFiles` says.
  const maxFiles = multiple ? usableMax : 1

  const sizesUsable =
    minSizeProp === undefined || maxSizeProp === undefined || minSizeProp <= maxSizeProp
  const validSize = (size: number | undefined) =>
    size !== undefined && Number.isFinite(size) && size >= 0 ? size : undefined
  const minSize = sizesUsable ? validSize(minSizeProp) : undefined
  const maxSize = sizesUsable ? validSize(maxSizeProp) : undefined

  const rules: FileRules = useMemo(
    () => ({ accept, maxSize, minSize, maxFiles, dedupe, validate }),
    [accept, maxSize, minSize, maxFiles, dedupe, validate],
  )

  const isControlled = valueProp !== undefined
  const [uncontrolled, setUncontrolled] = useState<File[]>(() => defaultValue ?? [])
  const files = isControlled ? valueProp : uncontrolled

  const [dragging, setDragging] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const zoneRef = useRef<HTMLElement | null>(null)
  const removeRefs = useRef<(HTMLElement | null)[]>([])
  /**
   * Set when a removal should move focus, applied after the list re-renders.
   *
   * `expect` is the length the list should have when the move is applied. A
   * controlled parent is free to refuse the removal, and refusing still causes
   * renders — the announcement is state — so an unvalidated stash gets replayed
   * against a list that never changed, moving focus to a different file's
   * button while the one the user tried to remove is still on screen. Worse,
   * the stash survives until the parent's *next* unrelated render, so the yank
   * arrives several interactions later.
   */
  const pendingFocus = useRef<{ target: number | 'zone'; expect: number } | null>(null)

  /**
   * Depth counter for the drag state.
   *
   * `dragleave` fires every time the pointer crosses into a *child* of the drop
   * zone, so a naive `onDragLeave -> setDragging(false)` flickers the highlight
   * off and on as the user moves over the hint text or an existing file row.
   * Counting enters and leaves is the only thing that survives nesting.
   *
   * Only `dragenter` and `dragleave` are counted. `dragover` repeats for as
   * long as the pointer hovers — every few hundred milliseconds and on every
   * pointer move — so counting it too made the depth climb without bound, and
   * the one matching `dragleave` could never bring it back to zero: the zone
   * stayed lit for the life of the page after a drag that left without
   * dropping.
   */
  const dragDepth = useRef(0)

  const full = maxFiles !== undefined && files.length >= maxFiles

  const ids = useMemo(
    () => ({
      root: baseId,
      input: `${baseId}-input`,
      label: `${baseId}-label`,
      zone: `${baseId}-zone`,
      list: `${baseId}-list`,
      announcement: `${baseId}-announcement`,
    }),
    [baseId],
  )

  /**
   * Object URLs, keyed by file, minted after commit and revoked when the file
   * goes.
   *
   * This is the part every alternative leaves to the caller — `react-dropzone`'s
   * documentation says in so many words that you must revoke them yourself, and
   * almost nobody does. An unrevoked URL pins the whole file in memory for the
   * lifetime of the document, so a user who adds and removes ten 5 MB photos
   * has leaked 50 MB.
   */
  // Held in state rather than a ref, and never replaced — only mutated. A ref
  // would be the reflexive choice, but a lazily-initialised state value is
  // stable for the life of the component without the refs rules to reason
  // about. Only the effects below touch it.
  const [urls] = useState(() => new Map<string, string>())
  /**
   * A snapshot of the map above, which is what render reads.
   *
   * Two values for one thing, and the split is the point: the map is mutated so
   * the unmount cleanup can close over one stable object, and a mutated object
   * can never be the state that triggers a re-render. The snapshot is replaced
   * on every mint or revoke, so it can.
   */
  const [previewUrls, setPreviewUrls] = useState<ReadonlyMap<string, string>>(() => new Map())

  /**
   * Mint and revoke, in an effect rather than while deriving the rendered list.
   *
   * `createObjectURL` allocates, which makes it the textbook thing not to do
   * during render — and this is not a theoretical objection. React 18's
   * StrictMode mounts by rendering twice and keeping the *second* pass's hooks,
   * so the first pass minted URLs into a `Map` that was then thrown away with
   * nothing left holding it: one leaked URL per previewable file, on every
   * StrictMode mount, unreachable by any cleanup. An effect only runs for a
   * pass that committed, so mint and revoke pair up by construction.
   *
   * It also settles server rendering for free — no effects run there, so the
   * markup carries no URL that could never be revoked.
   */
  useEffect(() => {
    const live = new Set<string>()
    let changed = false

    if (previews) {
      for (const file of files) {
        if (!isPreviewable(file)) continue
        const key = fileKey(file)
        live.add(key)
        // Existing URLs are kept, so a file that survives a change keeps its
        // `src`. Re-minting on every list change would reload every thumbnail.
        if (urls.has(key)) continue
        urls.set(key, URL.createObjectURL(file))
        changed = true
      }
    }

    // Anything no longer in the list is revoked immediately rather than waiting
    // for unmount, which is what makes add-then-remove cycles safe. Deleting
    // while iterating a Map is well-defined.
    for (const [key, url] of urls) {
      if (live.has(key)) continue
      URL.revokeObjectURL(url)
      urls.delete(key)
      changed = true
    }

    // The one case the rule is written to allow: an external system — the
    // document's object-URL registry — has changed, and the handles it gave
    // back have to reach render somehow. It cannot cascade, because the state
    // is only set when a URL was actually minted or revoked, and this effect's
    // own dependencies do not include it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (changed) setPreviewUrls(new Map(urls))
  }, [files, previews, urls])

  useEffect(() => {
    // Safe to close over because the effect above mutates this same Map rather
    // than replacing it.
    //
    // Declared *after* that effect on purpose. React runs every cleanup before
    // every setup, so on StrictMode's simulated remount this empties the map
    // first and the effect above re-mints into it — the order the other way
    // round would revoke what had just been minted.
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [urls])

  const entries = useMemo<FileEntry[]>(
    () =>
      files.map((file) => {
        const key = fileKey(file)
        const preview = previewUrls.get(key)
        return preview === undefined ? { file, key } : { file, key, preview }
      }),
    [files, previewUrls],
  )

  // Development-only configuration diagnostics. Guarded so a production bundler
  // drops the branch — and with it `warn.ts` entirely. Deduped per instance so
  // a re-rendering parent warns once, not once per selection.
  const warned = useRef<Set<string> | null>(null)
  useEffect(() => {
    // A bundler folds this to a constant and drops the whole effect body in a
    // production build, so the branch is unreachable once compiled and cannot
    // be exercised by the (always-development) test build.
    /* v8 ignore next */
    if (process.env.NODE_ENV === 'production') return
    const seen = (warned.current ??= new Set<string>())
    const emit = (warning: FileWarning | null) => {
      if (!warning) return
      const key = `${warning.code}:${warning.received}`
      if (seen.has(key)) return
      seen.add(key)
      if (onWarn) onWarn(warning)
      // The library ships no console noise in production; this line is only
      // reached in development and is dropped from production builds.
      // eslint-disable-next-line no-console
      else console.warn(`[react-file-input] ${warning.message}`)
    }
    emit(inspectMaxFiles(maxFilesProp))
    emit(inspectSizeRange(minSizeProp, maxSizeProp))
    emit(inspectSize(minSizeProp, 'minSize'))
    emit(inspectSize(maxSizeProp, 'maxSize'))
    emit(inspectAccept(accept))
    emit(inspectSingleWithMax(multiple, maxFilesProp))
  }, [maxFilesProp, minSizeProp, maxSizeProp, accept, multiple, onWarn])

  const commitFiles = useCallback(
    (next: File[]) => {
      if (!isControlled) setUncontrolled(next)
      onChange?.(next)
    },
    [isControlled, onChange],
  )

  const sizeOf = useCallback((file: File) => formatBytes(file.size), [])

  const addFiles = useCallback(
    (candidates: File[]) => {
      if (disabled || readOnly || candidates.length === 0) return

      // A single-file field replaces rather than appends: the native input does
      // the same, and appending would silently ignore the user's second pick.
      const base = multiple ? files : []
      const { files: next, results } = attemptAll(base, candidates, rules)
      const added = results.filter((result) => result.accepted)
      const rejected = results.filter((result) => !result.accepted)

      for (const result of rejected) onReject?.(result)
      if (added.length === 0) {
        if (announce) setAnnouncement(announce({ type: 'reject', files, rejected }))
        // Rejections are otherwise not announced by default — the caller shows
        // them, and interrupting the user to say "nothing happened" is noise.
        return
      }

      commitFiles(next)
      for (const result of added) onAdd?.(result.file, next)

      if (announce) {
        setAnnouncement(announce({ type: 'add', files: next, added: added.length, rejected }))
        return
      }
      // One announcement for the batch, whatever the count.
      const what =
        added.length === 1
          ? // The `?? 'file'` cannot fire: the length check guarantees the
            // element exists. `noUncheckedIndexedAccess` demands it anyway.
            /* v8 ignore next */
            (added[0]?.file.name ?? 'file')
          : `${String(added.length)} files`
      const refused = rejected.length === 0 ? '' : ` ${String(rejected.length)} refused.`
      setAnnouncement(`Added ${what}.${refused} ${String(next.length)} selected.`)
    },
    [disabled, readOnly, multiple, files, rules, onReject, commitFiles, onAdd, announce],
  )

  const removeAt = useCallback(
    (index: number) => {
      if (disabled || readOnly) return
      const file = files[index]
      if (file === undefined) return
      const next = files.filter((_entry, position) => position !== index)
      commitFiles(next)
      onRemove?.(file, index, next)
      setAnnouncement(
        announce
          ? announce({ type: 'remove', files: next })
          : `Removed ${file.name}. ${String(next.length)} selected.`,
      )
      /*
       * The button that was just clicked is about to leave the DOM, and focus
       * goes with it — straight to <body>, which is the single most common
       * accessibility failure in this widget. The next file's button takes it,
       * or the previous one if that was the last, or the drop zone if the list
       * is now empty.
       */
      pendingFocus.current = {
        target: next.length === 0 ? 'zone' : Math.min(index, next.length - 1),
        expect: next.length,
      }
    },
    [disabled, readOnly, files, commitFiles, onRemove, announce],
  )

  useEffect(() => {
    const pending = pendingFocus.current
    if (pending === null) return
    // Dropped, not deferred, when the list that arrived is not the one the
    // removal asked for: a controlled parent refused it, and the button the
    // user is on is still there.
    if (files.length !== pending.expect) {
      pendingFocus.current = null
      return
    }
    pendingFocus.current = null
    if (pending.target === 'zone') {
      zoneRef.current?.focus()
      return
    }
    removeRefs.current[pending.target]?.focus()
  }, [files])

  const clear = useCallback(() => {
    if (disabled || readOnly || files.length === 0) return
    commitFiles([])
    setAnnouncement(announce ? announce({ type: 'remove', files: [] }) : 'Removed all files.')
  }, [disabled, readOnly, files.length, commitFiles, announce])

  const open = useCallback(() => {
    if (disabled || readOnly) return
    inputRef.current?.click()
  }, [disabled, readOnly])

  /**
   * Bumped by every pick, so the effect below runs even when nothing else
   * re-renders: a pick refused outright with no `announce`, or a second pick
   * into a controlled `value={[]}` that repeats the first announcement word for
   * word.
   */
  const [picks, setPicks] = useState(0)

  /**
   * The native control holds only files the field is showing.
   *
   * A browser fires `change` only when a new selection differs from what the
   * input already holds. A file left in the control after the field let go of
   * it — refused, removed, handed off by a controlled parent that keeps
   * `value={[]}`, dropped from `value` by the parent — can then never be picked
   * again, and a native submit posts it although the field does not show it.
   *
   * Blanking the value after every pick, the usual trick, breaks the other
   * direction: the field would show a file a native submit never posts. So a
   * held file stays while it is in the list and only the rest go. The control
   * cannot drop one file of several, so a pick that was partly refused gets its
   * `FileList` rebuilt from the files that survived.
   *
   * After render rather than in the handlers: a controlled parent decides what
   * the list is, and its answer arrives as `files`.
   */
  useEffect(() => {
    const input = inputRef.current
    if (!input?.files) return
    const shown = new Set(files.map(fileKey))
    const held = Array.from(input.files)
    const kept = held.filter((file) => shown.has(fileKey(file)))
    if (kept.length === held.length) return
    if (kept.length === 0) {
      input.value = ''
      return
    }
    const data = new DataTransfer()
    for (const file of kept) data.items.add(file)
    input.files = data.files
  }, [files, picks])

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      addFiles(Array.from(event.target.files ?? []))
      setPicks((count) => count + 1)
    },
    [addFiles],
  )

  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled || readOnly) return
      // Only react to a drag that actually carries files — dragging selected
      // text over the zone should not light it up.
      if (!Array.from(event.dataTransfer.types).includes('Files')) return
      event.preventDefault()
      dragDepth.current += 1
      setDragging(true)
    },
    [disabled, readOnly],
  )

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled || readOnly) return
      if (!Array.from(event.dataTransfer.types).includes('Files')) return
      // Preventing `dragover` on every tick is what makes the browser fire
      // `drop` at all, so this cannot be skipped. It deliberately does not
      // touch the depth counter — see the counter's own comment.
      event.preventDefault()
      // Still lights the zone, without counting: dragging in from outside the
      // viewport does not always produce a `dragenter` the zone sees, and the
      // depth reaching zero on the matching `dragleave` turns it off again.
      setDragging(true)
    },
    [disabled, readOnly],
  )

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled || readOnly) return
      if (!Array.from(event.dataTransfer.types).includes('Files')) return
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setDragging(false)
    },
    [disabled, readOnly],
  )

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled || readOnly) return
      // Whatever was dropped, the drag is over: clear the highlight even for a
      // payload this field will not take.
      dragDepth.current = 0
      setDragging(false)
      // Symmetry with the drag handlers, which both refuse a drag carrying no
      // files. Consuming the drop anyway would swallow the browser's own
      // default for a dragged link or text selection.
      if (!Array.from(event.dataTransfer.types).includes('Files')) return
      event.preventDefault()
      addFiles(Array.from(event.dataTransfer.files))
    },
    [disabled, readOnly, addFiles],
  )

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      onFocus?.(event)
    },
    [onFocus],
  )

  /**
   * Only emit blur when focus genuinely leaves the field. Moving between the
   * drop zone and a file's remove button is still inside it, and a naive
   * per-element onBlur marks the field touched mid-interaction.
   */
  const handleBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      const next = event.relatedTarget
      if (next instanceof Node && event.currentTarget.contains(next)) return
      onBlur?.(event)
    },
    [onBlur],
  )

  return {
    files,
    entries,
    dragging,
    full,
    announcement,
    disabled,
    readOnly,
    multiple,
    ids,
    inputRef,
    zoneRef,
    removeRefs,
    open,
    addFiles,
    removeAt,
    clear,
    sizeOf,
    handleInputChange,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleBlur,
    handleFocus,
  }
}
