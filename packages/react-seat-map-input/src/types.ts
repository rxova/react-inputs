import type { CSSProperties, FocusEvent, ReactNode } from 'react'

/**
 * What a seat can be. Only `available` seats can be selected, but the other
 * three are still reachable by keyboard and still announce themselves — a
 * keyboard user has to be able to learn *which* seats are gone, not just that
 * some are.
 */
export type SeatStatus =
  /** For sale and unselected. */
  | 'available'
  /** Sold. */
  | 'occupied'
  /** Someone else is mid-checkout on it. */
  | 'held'
  /** Not for sale at all — broken, restricted view, kept clear. */
  | 'blocked'

/** One seat. `id` is what a form submits and what `value` holds. */
export interface Seat {
  /** Unique across the whole map. Submitted as the checkbox value. */
  id: string
  /**
   * Visible and spoken label, e.g. `"12A"`. Defaults to the row label
   * concatenated with the column label.
   */
  label?: string
  /** @default 'available' */
  status?: SeatStatus
  /**
   * Free-form tier or class — `"premium"`, `"stalls"`. Surfaced as
   * `data-rx-seat-map-category` and spoken after the label.
   */
  category?: string
  /**
   * Extra descriptors spoken after the label: `['window', 'extra legroom']`.
   */
  features?: string[]
  /**
   * Deliberately **not** in the default accessible name: formatting money needs
   * a locale and a currency this component has no business guessing. Pass
   * `formatSeatLabel` to speak it.
   */
  price?: number
}

/**
 * A cell in a row. `null` is a gap — an aisle, a walkway, a missing seat. Gaps
 * are rendered as empty grid cells rather than skipped, so `aria-colindex` and
 * the visual columns cannot drift apart.
 */
export type SeatMapCell = Seat | null

export interface SeatMapRow {
  /** Row label, e.g. `"12"`. Rendered as the row header and spoken with it. */
  label: string
  cells: SeatMapCell[]
  /** Spoken after every seat in the row: `"exit row"`, `"wheelchair space"`. */
  note?: string
}

/**
 * A deck, cabin, tier or block. Each section renders as its own ARIA grid with
 * its own single tab stop, which is what keeps a three-tier theatre navigable.
 */
export interface SeatMapSection {
  id: string
  label: string
  rows: SeatMapRow[]
  /**
   * Column header labels. Defaults to `A`, `B`, `C`… assigned left to right and
   * skipping columns that hold no seat in any row.
   */
  columns?: string[]
}

/** Where a seat sits, handed to `isSelectable` and `formatSeatLabel`. */
export interface SeatContext {
  sectionId: string
  sectionLabel: string
  rowLabel: string
  /** 0-based, within the section. */
  rowIndex: number
  /** 0-based cell index within the row — gaps included, so it matches the grid. */
  columnIndex: number
  columnLabel: string
  selected: boolean
  /** How many seats are selected across the whole map right now. */
  selectedCount: number
}

/** Per-seat state handed to a `renderSeat` function. */
export interface SeatState extends SeatContext {
  seat: Seat
  status: SeatStatus
  /** Could this seat be selected if clicked right now? */
  selectable: boolean
  /** Keyboard focus is on this seat and the focus was visible. */
  focused: boolean
  hovered: boolean
}

/** Why a selection was refused. Safe to `switch` on. */
export type SeatMapRejectionReason =
  /** The seat's `status` is not `available`. */
  | 'unavailable'
  /** `isSelectable` returned `false`. */
  | 'not-selectable'
  /** `maxSeats` is already reached. */
  | 'max-seats'
  /** `contiguous` is on and this seat is not adjacent to the current run. */
  | 'not-contiguous'
  /** `noOrphanSeats` is on and this pick would strand a lone empty seat. */
  | 'orphan-seat'

export interface SeatMapRejection {
  reason: SeatMapRejectionReason
  seat: Seat
  /** Human-readable explanation — the same string the live region announces. */
  message: string
}

/**
 * What the live region is about to say, before it is turned into text. Pass
 * `formatAnnouncement` to localise or replace the wording.
 */
export type SeatMapAnnouncement =
  | { type: 'selected'; seat: Seat; selectedCount: number; maxSeats?: number }
  | { type: 'deselected'; seat: Seat; selectedCount: number; maxSeats?: number }
  | { type: 'rejected'; seat: Seat; rejection: SeatMapRejection }

/**
 * Stable machine code for a coerced or suspicious input. The human `message` is
 * for logs; this is for logic.
 */
export type SeatMapWarningCode =
  'no-layout' | 'duplicate-seat-id' | 'unknown-seat-id' | 'max-seats-invalid' | 'min-above-max'

/**
 * Emitted when the component keeps itself functional despite an input it cannot
 * honour — a duplicate seat id, a `value` naming a seat that is not in the
 * layout, a non-positive `maxSeats`. Development-only, never an error.
 */
export interface SeatMapWarning {
  code: SeatMapWarningCode
  /** Human-readable explanation, safe to log as-is. */
  message: string
  /** The offending seat id, where the warning is about one. */
  seatId?: string
}

export interface SeatMapProps {
  // ---- Layout ----------------------------------------------------------------
  /**
   * The decks, cabins or tiers to render. Each becomes its own ARIA grid.
   * Provide this or {@link SeatMapProps.rows}, not both.
   */
  sections?: SeatMapSection[]
  /** Shorthand for the single-section case. Ignored when `sections` is set. */
  rows?: SeatMapRow[]

  // ---- Value -----------------------------------------------------------------
  /** Controlled selection, as seat ids. Ids not present in the layout are dropped. */
  value?: string[]
  /** Uncontrolled initial selection. Ignored when `value` is provided. */
  defaultValue?: string[]
  /** **Providing this is what makes the component interactive.** */
  onChange?: (ids: string[], seats: Seat[]) => void

  // ---- Rules -----------------------------------------------------------------
  /** Hard cap. Reaching it refuses further picks with a `max-seats` rejection. */
  maxSeats?: number
  /**
   * Soft floor. Never blocks a pick; it sets a native validation message on the
   * field so a real `<form>` refuses to submit an incomplete selection.
   */
  minSeats?: number
  /** Require every pick to sit next to the others, in one row, with no gap. */
  contiguous?: boolean
  /** Refuse any pick that would leave a single empty seat stranded in a row. */
  noOrphanSeats?: boolean
  /** Last word on whether a seat can be picked. Runs after the built-in rules. */
  isSelectable?: (seat: Seat, context: SeatContext) => boolean
  /** Fires whenever a pick is refused, with the reason. */
  onReject?: (rejection: SeatMapRejection) => void

  // ---- Interaction -----------------------------------------------------------
  /** Force read-only even with `onChange` present. @default `!onChange` */
  readOnly?: boolean
  /** Disables the whole field. Unavailable *seats* use `aria-disabled` instead. */
  disabled?: boolean
  onHoverChange?: (seat: Seat | null) => void
  /** Rows moved by `PageUp` / `PageDown`. @default 5 */
  pageSize?: number

  // ---- Form integration ------------------------------------------------------
  /**
   * Checkbox name. Every selected seat submits under it, so a native form posts
   * a real array — `formData.getAll(name)`.
   */
  name?: string
  /** At least one seat, or `minSeats` when that is set. */
  required?: boolean
  invalid?: boolean
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  'aria-describedby'?: string
  id?: string

  // ---- Presentation ----------------------------------------------------------
  /** Accessible name for the whole field. */
  label?: string
  dir?: 'ltr' | 'rtl'
  className?: string
  style?: CSSProperties
  /** Replace the seat's visual. The accessible name is unaffected. */
  renderSeat?: (state: SeatState) => ReactNode
  /** Replace a seat's accessible name. */
  formatSeatLabel?: (seat: Seat, context: SeatContext) => string
  /** Replace the live-region wording. */
  formatAnnouncement?: (announcement: SeatMapAnnouncement) => string
  /** Replace the native validation message shown when below `minSeats`. */
  formatValidationMessage?: (state: { selected: number; min: number }) => string

  // ---- Diagnostics -----------------------------------------------------------
  onWarn?: (warning: SeatMapWarning) => void
}
