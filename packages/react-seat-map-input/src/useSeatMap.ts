import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FocusEvent } from 'react'
import {
  buildGrid,
  firstSeatIn,
  lastSeatIn,
  moveHorizontal,
  moveVertical,
  pageMove,
  positionOf,
  rowEdge,
  seatAt,
  seatLabel,
} from './geometry'
import type { Grid, Position } from './geometry'
import { applySelection } from './rules'
import { inspectLayout, inspectLimits, inspectValue } from './warn'
import type {
  Seat,
  SeatContext,
  SeatMapAnnouncement,
  SeatMapRejection,
  SeatMapRow,
  SeatMapSection,
  SeatMapWarning,
} from './types'

const DEFAULT_PAGE_SIZE = 5

/** A keyboard navigation intent, already resolved from key to meaning. */
export type SeatMapMove =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'row-start'
  | 'row-end'
  | 'section-start'
  | 'section-end'
  | 'page-up'
  | 'page-down'

export interface UseSeatMapOptions {
  sections?: SeatMapSection[]
  rows?: SeatMapRow[]
  value?: string[]
  defaultValue?: string[]
  onChange?: (ids: string[], seats: Seat[]) => void
  maxSeats?: number
  minSeats?: number
  contiguous?: boolean
  noOrphanSeats?: boolean
  isSelectable?: (seat: Seat, context: SeatContext) => boolean
  onReject?: (rejection: SeatMapRejection) => void
  onHoverChange?: (seat: Seat | null) => void
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  onWarn?: (warning: SeatMapWarning) => void
  formatAnnouncement?: (announcement: SeatMapAnnouncement) => string
  readOnly?: boolean
  disabled?: boolean
  required?: boolean
  pageSize?: number
  name?: string
  id?: string
}

export interface UseSeatMapResult {
  /** The indexed layout. Rows, cells and per-seat position, ready to render. */
  grid: Grid
  /** Selected seat ids, in selection order, filtered to ids the layout knows. */
  value: string[]
  selectedSeats: Seat[]
  /** True when the component renders as a control rather than a static diagram. */
  interactive: boolean
  /** True when the control will actually accept input. */
  canChange: boolean
  disabled: boolean
  /** How many more seats may be picked, or `null` when uncapped. */
  remaining: number | null
  /** `minSeats`, or 1 when only `required` was given. */
  minSeats: number
  /** Fewer seats chosen than `minSeats` — what the native validity message says. */
  belowMinimum: boolean
  hoveredId: string | null
  focusedId: string | null
  /** Focus arrived via the keyboard, so the ring should be painted. */
  focusVisible: boolean
  /** One tabbable seat id per section — the roving tabindex, already resolved. */
  tabbableIds: (string | null)[]
  /** Current live-region text. Empty until something has happened. */
  announcement: string
  name: string
  baseId: string
  /**
   * Structural rather than `RefObject`: in @types/react 18 `RefObject.current`
   * is readonly, in 19 it is mutable. Declaring the shape keeps this assignable
   * under both, which matters because `react >= 18` is a peer.
   */
  rootRef: { current: HTMLDivElement | null }
  /** Toggle a seat, running every rule. Deselecting is never refused. */
  toggle: (seatId: string) => void
  /** Replace the whole selection, skipping the rules — for `findBestSeats`. */
  setSelection: (ids: string[]) => void
  /** Where a navigation key lands, or `null` when it cannot move. */
  resolveMove: (fromId: string, move: SeatMapMove) => string | null
  setHovered: (seatId: string | null) => void
  setFocused: (seatId: string | null, visible: boolean) => void
  handleBlur: (event: FocusEvent<HTMLElement>) => void
}

function defaultAnnouncement(event: SeatMapAnnouncement, labelOf: (seat: Seat) => string): string {
  if (event.type === 'rejected') return event.rejection.message
  const verb = event.type === 'selected' ? 'selected' : 'cleared'
  const count =
    event.maxSeats === undefined
      ? `${String(event.selectedCount)} ${event.selectedCount === 1 ? 'seat' : 'seats'} chosen.`
      : `${String(event.selectedCount)} of ${String(event.maxSeats)} seats chosen.`
  return `${labelOf(event.seat)} ${verb}. ${count}`
}

/**
 * Headless state for a seat map: the indexed grid, controlled/uncontrolled
 * selection, the rule engine, roving focus, hover and the live-region text.
 *
 * `sections` is memoized by reference, so a layout built inline on every render
 * rebuilds the index on every render. Hoist it or `useMemo` it — a 300-seat
 * cabin is worth the one line.
 */
export function useSeatMap(options: UseSeatMapOptions): UseSeatMapResult {
  const {
    sections: sectionsProp,
    rows,
    value: valueProp,
    defaultValue,
    onChange,
    maxSeats,
    minSeats,
    contiguous,
    noOrphanSeats,
    isSelectable,
    onReject,
    onHoverChange,
    onBlur,
    onWarn,
    formatAnnouncement,
    readOnly,
    disabled = false,
    required = false,
    pageSize = DEFAULT_PAGE_SIZE,
    name: nameProp,
    id: idProp,
  } = options

  const reactId = useId()
  const baseId = idProp ?? `rx-seat-map-${reactId}`
  const name = nameProp ?? `rx-seat-map-name-${reactId}`

  const sections = useMemo<SeatMapSection[]>(() => {
    if (sectionsProp) return sectionsProp
    // The single-section shorthand still gets a real section, so every code
    // path below has exactly one shape to reason about.
    if (rows) return [{ id: 'seats', label: 'Seats', rows }]
    return []
  }, [sectionsProp, rows])

  const grid = useMemo(() => buildGrid(sections), [sections])

  const isControlled = valueProp !== undefined
  const [uncontrolled, setUncontrolled] = useState<string[]>(() => defaultValue ?? [])
  const rawValue = isControlled ? valueProp : uncontrolled

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [focusVisible, setFocusVisible] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)

  // `disabled` deliberately does NOT clear `interactive`. A disabled control
  // must still be exposed as a disabled control — degrading it to a static
  // diagram would hide the field from screen-reader users filling the form.
  // `canChange` is what actually gates mutation.
  const interactive = readOnly === undefined ? onChange !== undefined : !readOnly
  const canChange = interactive && !disabled

  /** Ids the layout does not know are dropped rather than rendered nowhere. */
  const value = useMemo(() => {
    const seen = new Set<string>()
    return rawValue.filter((id) => {
      if (seen.has(id) || !grid.byId.has(id)) return false
      seen.add(id)
      return true
    })
  }, [rawValue, grid])

  const selectedSeats = useMemo(
    () =>
      value.flatMap((id) => {
        const found = grid.byId.get(id)
        return found ? [found.seat] : []
      }),
    [value, grid],
  )

  const validMax = maxSeats !== undefined && Number.isInteger(maxSeats) && maxSeats >= 1
  // `validMax` narrows `maxSeats` to a number in the true branch, so no second
  // undefined check is needed here.
  const remaining = validMax ? Math.max(0, maxSeats - value.length) : null
  const effectiveMin = minSeats ?? (required ? 1 : 0)
  const belowMinimum = value.length < effectiveMin

  // Development-only input diagnostics. Nothing here changes behaviour: the
  // grid is already built and the value already filtered. Guarded so a
  // production bundler drops the branch — and with it `warn.ts` entirely.
  // Deduped per instance so a controlled `value` re-rendering many times warns
  // only once.
  const warnedRef = useRef<Set<string> | null>(null)
  useEffect(() => {
    // A bundler folds this to a constant and drops the whole effect body in a
    // production build, so the branch is unreachable once compiled and cannot
    // be exercised by the (always-development) test build.
    /* v8 ignore next */
    if (process.env.NODE_ENV === 'production') return
    const seen = (warnedRef.current ??= new Set<string>())
    for (const warning of [
      ...inspectLayout(grid),
      ...inspectValue(grid, rawValue),
      ...inspectLimits(maxSeats, minSeats),
    ]) {
      const key = `${warning.code}:${warning.seatId ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      if (onWarn) onWarn(warning)
      // The library ships no console noise in production; this line is only
      // reached in development and is dropped from production builds.
      // eslint-disable-next-line no-console
      else console.warn(`[react-seat-map-input] ${warning.message}`)
    }
  }, [grid, rawValue, maxSeats, minSeats, onWarn])

  const announce = useCallback(
    (event: SeatMapAnnouncement) => {
      const text =
        formatAnnouncement?.(event) ??
        defaultAnnouncement(event, (seat) => {
          const found = grid.byId.get(seat.id)
          return found ? seatLabel(found) : seat.id
        })
      // React only touches the text node when the string actually changes, so
      // pressing Space twice on the same sold seat would announce it once. The
      // alternating trailing space forces a new text node; it is not spoken.
      setAnnouncement((previous) => (previous === text ? `${text} ` : text))
    },
    [formatAnnouncement, grid],
  )

  const commit = useCallback(
    (next: string[]) => {
      if (!isControlled) setUncontrolled(next)
      onChange?.(
        next,
        next.flatMap((id) => {
          const found = grid.byId.get(id)
          return found ? [found.seat] : []
        }),
      )
    },
    [isControlled, onChange, grid],
  )

  const toggle = useCallback(
    (seatId: string) => {
      if (!canChange) return
      const seat = grid.byId.get(seatId)
      if (!seat) return

      // An invalid `maxSeats` is dropped rather than honoured: a cap of 0 or 2.5
      // would silently make every seat unpickable, which reads as a broken map.
      const cap = validMax ? maxSeats : undefined
      const result = applySelection(grid, value, seatId, {
        maxSeats: cap,
        contiguous,
        noOrphanSeats,
        isSelectable,
      })

      if (result.rejection) {
        onReject?.(result.rejection)
        announce({ type: 'rejected', seat: seat.seat, rejection: result.rejection })
        return
      }

      commit(result.next)
      announce({
        type: result.next.includes(seatId) ? 'selected' : 'deselected',
        seat: seat.seat,
        selectedCount: result.next.length,
        maxSeats: cap,
      })
    },
    [
      canChange,
      grid,
      value,
      validMax,
      maxSeats,
      contiguous,
      noOrphanSeats,
      isSelectable,
      onReject,
      announce,
      commit,
    ],
  )

  const setSelection = useCallback(
    (ids: string[]) => {
      if (!canChange) return
      commit(ids.filter((id) => grid.byId.has(id)))
    },
    [canChange, commit, grid],
  )

  const resolveMove = useCallback(
    (fromId: string, move: SeatMapMove): string | null => {
      const from = grid.byId.get(fromId)
      if (!from) return null
      const position = positionOf(from)
      const section = grid.sections[from.sectionIndex]
      if (!section) return null

      let next: Position | null
      switch (move) {
        case 'left':
          next = moveHorizontal(grid, position, -1)
          break
        case 'right':
          next = moveHorizontal(grid, position, 1)
          break
        case 'up':
          next = moveVertical(grid, position, -1)
          break
        case 'down':
          next = moveVertical(grid, position, 1)
          break
        case 'row-start':
          next = rowEdge(grid, position, 'start')
          break
        case 'row-end':
          next = rowEdge(grid, position, 'end')
          break
        case 'section-start':
          next = firstSeatIn(section, from.sectionIndex)
          break
        case 'section-end':
          next = lastSeatIn(section, from.sectionIndex)
          break
        case 'page-up':
          next = pageMove(grid, position, -pageSize)
          break
        default:
          next = pageMove(grid, position, pageSize)
      }

      if (!next) return null
      const landed = seatAt(grid, next)
      return landed && landed.seat.id !== fromId ? landed.seat.id : null
    },
    [grid, pageSize],
  )

  /**
   * One tab stop per section. Preference order is focused seat, then the first
   * seat already chosen there, then the first seat that can still be chosen,
   * then the first seat at all — so tabbing in lands somewhere useful rather
   * than in the corner of a sold-out block.
   */
  const tabbableIds = useMemo(
    () =>
      grid.sections.map((section, sectionIndex) => {
        const focused = focusedId === null ? undefined : grid.byId.get(focusedId)
        if (focused?.sectionIndex === sectionIndex) return focused.seat.id

        const inSection = grid.order.filter((seat) => seat.sectionIndex === sectionIndex)
        const chosen = inSection.find((seat) => value.includes(seat.seat.id))
        if (chosen) return chosen.seat.id

        const free = inSection.find((seat) => seat.status === 'available')
        if (free) return free.seat.id

        const first = firstSeatIn(section, sectionIndex)
        const fallback = first ? seatAt(grid, first) : null
        return fallback ? fallback.seat.id : null
      }),
    [grid, focusedId, value],
  )

  const setHovered = useCallback(
    (seatId: string | null) => {
      if (!canChange) return
      setHoveredId((previous) => {
        if (previous === seatId) return previous
        const seat = seatId === null ? null : (grid.byId.get(seatId)?.seat ?? null)
        onHoverChange?.(seat)
        return seatId
      })
    },
    [canChange, grid, onHoverChange],
  )

  const setFocused = useCallback((seatId: string | null, visible: boolean) => {
    setFocusedId(seatId)
    setFocusVisible(visible)
  }, [])

  /**
   * Only emit blur when focus genuinely leaves the map. Arrowing between seats
   * moves focus between sibling checkboxes, and a naive per-input onBlur marks
   * the field touched mid-selection — firing validation errors while the user
   * is still choosing.
   */
  const handleBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      const next = event.relatedTarget
      if (next instanceof Node && rootRef.current?.contains(next)) return
      setFocusedId(null)
      setFocusVisible(false)
      setHoveredId((previous) => {
        if (previous !== null) onHoverChange?.(null)
        return null
      })
      onBlur?.(event)
    },
    [onBlur, onHoverChange],
  )

  return {
    grid,
    value,
    selectedSeats,
    interactive,
    canChange,
    disabled,
    remaining,
    minSeats: effectiveMin,
    belowMinimum,
    hoveredId,
    focusedId,
    focusVisible,
    tabbableIds,
    announcement,
    name,
    baseId,
    rootRef,
    toggle,
    setSelection,
    resolveMove,
    setHovered,
    setFocused,
    handleBlur,
  }
}
