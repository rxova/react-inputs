import { forwardRef, useCallback, useEffect, useRef } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { seatLabel } from './geometry'
import type { GridRow, GridSeat } from './geometry'
import { contextFor } from './rules'
import { useSeatMap } from './useSeatMap'
import type { SeatMapMove } from './useSeatMap'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'
import type { SeatContext, SeatMapProps, SeatState, SeatStatus } from './types'

/**
 * Non-colour status marks. Conveying "sold" with a grey fill alone fails WCAG
 * 1.4.1, and it is the single most common defect in the seat pickers this
 * component competes with. Characters rather than SVG so they inherit
 * `font-size` and cost nothing in the bundle.
 */
const STATUS_MARK: Record<SeatStatus | 'selected', string> = {
  available: '',
  selected: '✓',
  occupied: '×',
  held: '•',
  blocked: '/',
}

const STATUS_WORD: Record<SeatStatus, string> = {
  available: '',
  occupied: 'taken',
  held: 'on hold',
  blocked: 'unavailable',
}

const BORDER_STYLE: Record<SeatStatus, string> = {
  available: 'solid',
  occupied: 'solid',
  held: 'dashed',
  blocked: 'dotted',
}

// Only layout-critical declarations are inlined. Everything visual is a CSS
// custom property so there is no stylesheet to import (design pillar 3).
const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--rx-seat-map-section-gap, 1.5rem)',
  position: 'relative',
}

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--rx-seat-map-row-gap, 0.25rem)',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--rx-seat-map-gap, 0.25rem)',
}

const headerCellStyle: CSSProperties = {
  flexShrink: 0,
  width: 'var(--rx-seat-map-row-header-width, 2rem)',
  fontSize: 'var(--rx-seat-map-label-size, 0.75rem)',
  color: 'var(--rx-seat-map-label-color, #525252)',
  textAlign: 'center',
  lineHeight: 1,
}

const cellStyle: CSSProperties = {
  position: 'relative',
  flexShrink: 0,
  // The 1.75rem default is 28px, comfortably over the 24×24 floor WCAG 2.2
  // §2.5.8 sets — a seat map that only passes at a custom size is a seat map
  // that ships failing.
  width: 'var(--rx-seat-map-seat-size, 1.75rem)',
  height: 'var(--rx-seat-map-seat-size, 1.75rem)',
}

const gapStyle: CSSProperties = {
  flexShrink: 0,
  width: 'var(--rx-seat-map-aisle-width, 1rem)',
  height: 'var(--rx-seat-map-seat-size, 1.75rem)',
}

const inputStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  margin: 0,
  opacity: 0,
  cursor: 'inherit',
}

/**
 * Off-screen but still in the accessibility tree. `display: none` and
 * `visibility: hidden` would remove it from that tree too, which is the one
 * thing this element exists to stay in.
 */
const visuallyHidden: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
}

function visualStyle(status: SeatStatus, selected: boolean, animate: boolean): CSSProperties {
  const token = selected ? 'selected' : status
  return {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    borderRadius: 'var(--rx-seat-map-radius, 0.25rem)',
    borderWidth: 'var(--rx-seat-map-border-width, 1px)',
    borderStyle: selected ? 'solid' : BORDER_STYLE[status],
    borderColor: `var(--rx-seat-map-border-${token}, var(--rx-seat-map-border, #767676))`,
    background: `var(--rx-seat-map-bg-${token}, #ffffff)`,
    color: `var(--rx-seat-map-color-${token}, #1a1a1a)`,
    fontSize: 'var(--rx-seat-map-mark-size, 0.75rem)',
    lineHeight: 1,
    transition: animate ? 'var(--rx-seat-map-transition, background 120ms ease)' : 'none',
  }
}

/** `12A, premium, window, exit row, taken` — position first, then why it matters. */
function defaultSeatName(gridSeat: GridSeat, row: GridRow): string {
  const parts = [seatLabel(gridSeat)]
  if (gridSeat.seat.category) parts.push(gridSeat.seat.category)
  if (row.note) parts.push(row.note)
  if (gridSeat.seat.features) parts.push(...gridSeat.seat.features)
  const word = STATUS_WORD[gridSeat.status]
  if (word) parts.push(word)
  return parts.join(', ')
}

/**
 * Consumer formatters run once per seat, during render. One that throws would
 * take the whole map down; one that returns a non-string would leave a seat
 * with no accessible name at all, which is the single worst outcome this
 * component has. Both degrade to the built-in name instead.
 */
function seatName(
  format: SeatMapProps['formatSeatLabel'],
  gridSeat: GridSeat,
  row: GridRow,
  context: SeatContext,
): string {
  if (format) {
    try {
      const custom = format(gridSeat.seat, context)
      if (typeof custom === 'string' && custom !== '') return custom
    } catch {
      // fall through to the built-in name
    }
  }
  return defaultSeatName(gridSeat, row)
}

const MOVE_BY_KEY: Record<string, SeatMapMove> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  PageUp: 'page-up',
  PageDown: 'page-down',
}

/**
 * `forwardRef` rather than reading `props.ref`.
 *
 * React 19 passes `ref` as an ordinary prop, so `props.ref` works there — but
 * React 18 strips it before props are built, so the ref would silently never
 * populate. We declare `react >= 18` as a peer, so the version that needs
 * forwardRef is the one that decides.
 *
 * The `@__PURE__` annotation is load-bearing: `forwardRef(...)` is a top-level
 * call, and without it bundlers must assume side effects and cannot drop this
 * component from a build that only imports `useSeatMap` or `findBestSeats`.
 */
export const SeatMap = /* @__PURE__ */ forwardRef<HTMLDivElement, SeatMapProps>(
  function SeatMap(props, ref) {
    const {
      className,
      style,
      dir,
      label,
      invalid,
      disabled = false,
      renderSeat,
      formatSeatLabel,
      formatValidationMessage,
      'aria-describedby': describedBy,
    } = props

    const animate = !usePrefersReducedMotion()
    const map = useSeatMap(props)
    const {
      grid,
      value,
      selectedIds,
      interactive,
      canChange,
      minSeats,
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
      resolveMove,
      setHovered,
      setFocused,
      handleBlur,
    } = map

    /** Keyed by seat id so navigation can focus a seat it only knows by id. */
    const seatNodes = useRef(new Map<string, HTMLElement>())
    const firstInput = useRef<HTMLInputElement | null>(null)

    /**
     * `minSeats` is a group constraint, and HTML has none for checkboxes:
     * `required` on one box would demand *that seat*. Borrowing the constraint
     * API on the first control instead means a real `<form>` refuses to submit
     * and reports the problem itself, with no JavaScript validation layer.
     */
    useEffect(() => {
      const node = firstInput.current
      if (!node) return
      if (!belowMinimum || !canChange) {
        node.setCustomValidity('')
        return
      }
      const built = `Choose at least ${String(minSeats)} ${minSeats === 1 ? 'seat' : 'seats'}.`
      let message = built
      try {
        const custom = formatValidationMessage?.({ selected: value.length, min: minSeats })
        if (typeof custom === 'string' && custom !== '') message = custom
      } catch {
        message = built
      }
      // An empty custom validity means "valid" to the browser, so a formatter
      // that returns nothing must not be allowed to silently pass the form.
      node.setCustomValidity(message)
    }, [belowMinimum, canChange, formatValidationMessage, minSeats, value.length])

    const focusSeat = useCallback(
      (seatId: string) => {
        const node = seatNodes.current.get(seatId)
        if (!node) return
        // Focus first with the browser's own scrolling suppressed, then scroll
        // deliberately: `nearest` keeps a large cabin from jumping the viewport
        // to centre every seat the user arrows past.
        node.focus({ preventScroll: true })
        node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
        setFocused(seatId, true)
      },
      [setFocused],
    )

    /**
     * The one place this component reimplements platform behaviour, and the
     * reason is that there is no platform behaviour to reimplement: no native
     * element navigates a two-dimensional selection. Everything a checkbox
     * already does — Space, checked state, form submission, the role
     * announcement — is left to the checkbox.
     */
    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.altKey) return
        const target = event.target as HTMLElement
        const seatId = target.getAttribute('data-rx-seat-map-seat')
        if (seatId === null) return

        if (event.key === 'Enter') {
          // Space is native on a checkbox; Enter is not, and a user who has
          // been tabbing through a form arrives expecting it to work.
          event.preventDefault()
          toggle(seatId)
          return
        }

        let move: SeatMapMove
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          // Read the resolved direction rather than the `dir` prop: the map may
          // inherit RTL from an ancestor, and an arrow key that moves the wrong
          // way is worse than no arrow key at all.
          const rtl = rootRef.current
            ? getComputedStyle(rootRef.current).direction === 'rtl'
            : false
          const towardsEnd = rtl ? event.key === 'ArrowLeft' : event.key === 'ArrowRight'
          move = towardsEnd ? 'right' : 'left'
        } else if (event.key === 'Home') {
          move = event.ctrlKey || event.metaKey ? 'section-start' : 'row-start'
        } else if (event.key === 'End') {
          move = event.ctrlKey || event.metaKey ? 'section-end' : 'row-end'
        } else {
          const mapped = MOVE_BY_KEY[event.key]
          if (mapped === undefined) return
          move = mapped
        }

        const next = resolveMove(seatId, move)
        if (!next) {
          // Still swallow the key: a grid that scrolls the page when you reach
          // the last row reads as broken, not as "no further".
          event.preventDefault()
          return
        }
        event.preventDefault()
        focusSeat(next)

        // Shift extends the block, the same gesture a file list uses. It only
        // ever adds: making Shift+Arrow able to unpick seats turns a slip into
        // a lost booking.
        if (event.shiftKey && (move === 'left' || move === 'right') && !selectedIds.has(next)) {
          toggle(next)
        }
      },
      [focusSeat, resolveMove, rootRef, selectedIds, toggle],
    )

    const renderCell = (
      sectionIndex: number,
      row: GridRow,
      cell: GridSeat | null,
      columnIndex: number,
    ): ReactNode => {
      if (!cell) {
        return <span key={columnIndex} role="gridcell" data-rx-seat-map-gap="" style={gapStyle} />
      }

      const seatId = cell.seat.id
      const selected = selectedIds.has(seatId)
      const selectable = cell.status === 'available'
      const focused = focusedId === seatId && focusVisible
      const context = contextFor(grid, cell, value)
      const accessibleName = seatName(formatSeatLabel, cell, row, context)
      const tabbable = tabbableIds[sectionIndex] === seatId

      const state: SeatState = {
        ...context,
        seat: cell.seat,
        status: cell.status,
        selectable: selectable && canChange,
        focused,
        hovered: hoveredId === seatId,
      }

      const fallbackVisual = (
        <span
          data-rx-seat-map-visual=""
          aria-hidden="true"
          style={visualStyle(cell.status, selected, animate)}
        >
          {selected ? STATUS_MARK.selected : STATUS_MARK[cell.status]}
        </span>
      )

      // A throwing `renderSeat` falls back to the built-in artwork. It is called
      // here rather than mounted as a component, so the throw is catchable and
      // one bad seat cannot unmount the booking form.
      let visual: ReactNode = fallbackVisual
      if (renderSeat) {
        try {
          visual = renderSeat(state)
        } catch {
          visual = fallbackVisual
        }
      }

      const registerNode = (node: HTMLElement | null) => {
        if (node) seatNodes.current.set(seatId, node)
        else seatNodes.current.delete(seatId)
      }

      const shared = {
        'data-rx-seat-map-cell': '',
        // One attribute, five values, rather than `data-state` plus a redundant
        // `data-selected`: two hooks that can disagree is one more than a
        // stylesheet needs.
        'data-state': selected ? 'selected' : cell.status,
        ...(focused ? { 'data-focused': '' } : {}),
        ...(cell.seat.category === undefined
          ? {}
          : { 'data-rx-seat-map-category': cell.seat.category }),
        style: {
          ...cellStyle,
          ...(focused
            ? {
                outline: 'var(--rx-seat-map-focus-ring, 2px solid Highlight)',
                outlineOffset: 'var(--rx-seat-map-focus-ring-offset, 2px)',
                borderRadius: 'var(--rx-seat-map-focus-ring-radius, 0.25rem)',
              }
            : {}),
        },
      }

      if (!interactive) {
        // A read-only map has no control to carry `checked`, so selection is
        // stated the pure-ARIA way. The two models are never mixed: an
        // interactive map says it with the checkbox and nothing else.
        return (
          <span
            key={columnIndex}
            {...shared}
            ref={registerNode}
            role="gridcell"
            aria-label={accessibleName}
            aria-selected={selected}
            data-rx-seat-map-seat={seatId}
            tabIndex={tabbable ? 0 : -1}
            onFocus={(event) => {
              setFocused(seatId, event.currentTarget.matches(':focus-visible'))
            }}
          >
            {visual}
          </span>
        )
      }

      // Keyed by position rather than by seat id: a layout with a duplicated id
      // is a layout we warn about and still render, and duplicate React keys
      // would turn that warning into a rendering bug.
      return (
        <span key={columnIndex} {...shared} role="gridcell">
          {visual}
          <input
            type="checkbox"
            ref={(node) => {
              registerNode(node)
              if (node && grid.order[0]?.seat.id === seatId) firstInput.current = node
            }}
            id={`${baseId}-${seatId}`}
            data-rx-seat-map-seat={seatId}
            name={name}
            value={seatId}
            checked={selected}
            disabled={disabled}
            // `aria-disabled`, never the `disabled` attribute: a disabled
            // checkbox is not focusable, so arrowing across the cabin would
            // silently skip every sold seat and a keyboard user could never
            // learn which ones are gone.
            aria-disabled={selectable ? undefined : true}
            tabIndex={tabbable ? 0 : -1}
            aria-label={accessibleName}
            style={{ ...inputStyle, cursor: selectable ? 'pointer' : 'not-allowed' }}
            onChange={() => {
              toggle(seatId)
            }}
            onFocus={(event) => {
              setFocused(seatId, event.currentTarget.matches(':focus-visible'))
            }}
            onPointerEnter={(event) => {
              if (event.pointerType === 'touch') return
              setHovered(seatId)
            }}
          />
        </span>
      )
    }

    const sections = grid.sections.map((section, sectionIndex) => (
      <div
        key={section.id}
        role="grid"
        aria-label={section.label}
        {...(interactive ? {} : { 'aria-readonly': true, 'aria-multiselectable': true })}
        data-rx-seat-map-section={section.id}
        style={sectionStyle}
      >
        <div role="row" data-rx-seat-map-row="" style={rowStyle}>
          <span role="columnheader" data-rx-seat-map-corner="" style={headerCellStyle} />
          {section.columns.map((columnLabel, columnIndex) =>
            columnLabel === '' ? (
              <span
                key={`col-${String(columnIndex)}`}
                role="columnheader"
                data-rx-seat-map-gap=""
                style={gapStyle}
              />
            ) : (
              <span
                key={`col-${String(columnIndex)}`}
                role="columnheader"
                data-rx-seat-map-column-header={columnLabel}
                style={{ ...headerCellStyle, ...cellStyle, position: 'static' }}
              >
                {columnLabel}
              </span>
            ),
          )}
        </div>

        {section.rows.map((row, rowIndex) => (
          <div
            key={`${section.id}-${String(rowIndex)}`}
            role="row"
            data-rx-seat-map-row={row.label}
            style={rowStyle}
          >
            <span role="rowheader" data-rx-seat-map-row-header="" style={headerCellStyle}>
              {row.label}
            </span>
            {row.cells.map((cell, columnIndex) => renderCell(sectionIndex, row, cell, columnIndex))}
          </div>
        ))}
      </div>
    ))

    return (
      <div
        ref={(node) => {
          rootRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        className={className}
        dir={dir}
        style={{ ...rootStyle, ...style }}
        role="group"
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={invalid ? true : undefined}
        aria-disabled={disabled ? true : undefined}
        data-rx-seat-map-root=""
        {...(disabled ? { 'data-disabled': '' } : {})}
        {...(invalid ? { 'data-invalid': '' } : {})}
        {...(interactive ? {} : { 'data-readonly': '' })}
        // Makes ref.current.focus() work for React Hook Form's setFocus() and
        // focus-first-error patterns. Not in the tab order itself.
        tabIndex={-1}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onPointerLeave={() => {
          setHovered(null)
        }}
      >
        {sections}
        {/*
          Announces picks, clears and refusals. Refusals are the reason this
          exists: a seat that simply refuses to tick, with no spoken reason, is
          indistinguishable from a broken control.
        */}
        <span
          data-rx-seat-map-announcement=""
          aria-live="polite"
          aria-atomic="true"
          style={visuallyHidden}
        >
          {announcement}
        </span>
      </div>
    )
  },
)
