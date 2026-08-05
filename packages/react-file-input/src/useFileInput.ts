import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FocusEvent } from 'react'
import { attemptAll, fileKey, formatBytes, isPreviewable } from './files'
import type { FileAttempt, FileRules } from './files'
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
  onReject?: (attempt: FileAttempt) => void
  multiple?: boolean
  previews?: boolean
  announce?: (event: {
    type: 'add' | 'remove' | 'reject'
    files: File[]
    added?: number
    rejected?: FileAttempt[]
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
  /** Set when a removal should move focus, applied after the list re-renders. */
  const pendingFocus = useRef<number | 'zone' | null>(null)

  /**
   * Depth counter for the drag state.
   *
   * `dragleave` fires every time the pointer crosses into a *child* of the drop
   * zone, so a naive `onDragLeave -> setDragging(false)` flickers the highlight
   * off and on as the user moves over the hint text or an existing file row.
   * Counting enters and leaves is the only thing that survives nesting.
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
   * Object URLs, keyed by file, created lazily and revoked when the file goes.
   *
   * This is the part every alternative leaves to the caller — `react-dropzone`'s
   * documentation says in so many words that you must revoke them yourself, and
   * almost nobody does. An unrevoked URL pins the whole file in memory for the
   * lifetime of the document, so a user who adds and removes ten 5 MB photos
   * has leaked 50 MB.
   */
  // Held in state rather than a ref, and never replaced — only mutated. A ref
  // would be the reflexive choice, but reading `.current` while deriving the
  // rendered list is exactly what the refs-during-render rule forbids, and a
  // lazily-initialised state value is stable for the life of the component
  // without that caveat.
  const [urls] = useState(() => new Map<string, string>())

  const entries = useMemo<FileEntry[]>(() => {
    // No previews on the server: an object URL minted during server rendering
    // could never be revoked (there is no unmount) and would be meaningless in
    // the HTML anyway. The client mints them on hydration instead.
    if (!previews || typeof document === 'undefined') {
      return files.map((file) => ({ file, key: fileKey(file) }))
    }

    // The map is *mutated*, never replaced. Swapping in a fresh Map here was a
    // real bug: the unmount cleanup below captures this same object, so
    // replacing it left that cleanup holding the original empty map and every
    // URL alive for the lifetime of the document — the exact leak this code
    // exists to prevent.
    const map = urls
    const live = new Set<string>()

    const result = files.map((file) => {
      const key = fileKey(file)
      if (!isPreviewable(file)) return { file, key }
      live.add(key)
      let url = map.get(key)
      if (url === undefined) {
        url = URL.createObjectURL(file)
        map.set(key, url)
      }
      return { file, key, preview: url }
    })

    // Anything no longer in the list is revoked immediately rather than waiting
    // for unmount, which is what makes add-then-remove cycles safe. Deleting
    // while iterating a Map is well-defined.
    for (const [key, url] of map) {
      if (!live.has(key)) {
        URL.revokeObjectURL(url)
        map.delete(key)
      }
    }
    return result
  }, [files, previews, urls])

  useEffect(() => {
    // Safe to close over because the memo above mutates this same Map rather
    // than replacing it.
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [urls])

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
      // The native input keeps its own value, and a browser will not fire
      // `change` for the same file twice. Clearing it means re-picking a file
      // the user just removed actually works.
      if (inputRef.current) inputRef.current.value = ''
      /*
       * The button that was just clicked is about to leave the DOM, and focus
       * goes with it — straight to <body>, which is the single most common
       * accessibility failure in this widget. The next file's button takes it,
       * or the previous one if that was the last, or the drop zone if the list
       * is now empty.
       */
      pendingFocus.current = next.length === 0 ? 'zone' : Math.min(index, next.length - 1)
    },
    [disabled, readOnly, files, commitFiles, onRemove, announce],
  )

  useEffect(() => {
    const target = pendingFocus.current
    if (target === null) return
    pendingFocus.current = null
    if (target === 'zone') {
      zoneRef.current?.focus()
      return
    }
    removeRefs.current[target]?.focus()
  }, [files])

  const clear = useCallback(() => {
    if (disabled || readOnly || files.length === 0) return
    commitFiles([])
    setAnnouncement(announce ? announce({ type: 'remove', files: [] }) : 'Removed all files.')
    if (inputRef.current) inputRef.current.value = ''
  }, [disabled, readOnly, files.length, commitFiles, announce])

  const open = useCallback(() => {
    if (disabled || readOnly) return
    inputRef.current?.click()
  }, [disabled, readOnly])

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const picked = Array.from(event.target.files ?? [])
      addFiles(picked)
      /*
       * Deliberately *not* cleared here, only in `removeAt` and `clear`.
       * Blanking the native value after every pick is the usual trick for
       * "let the user re-pick the same file", but it also empties the control
       * a native form submit posts — so the field would render a file the
       * server never receives. Clearing on removal covers the same case
       * without lying about what would be submitted.
       */
    },
    [addFiles],
  )

  const handleDragOver = useCallback(
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
      event.preventDefault()
      dragDepth.current = 0
      setDragging(false)
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
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleBlur,
    handleFocus,
  }
}
