import { columnLabelAt } from './geometry'
import type { Seat, SeatMapCell, SeatMapSection, SeatStatus } from './types'

const STATUS_BY_CHAR: Record<string, SeatStatus> = {
  '#': 'available',
  x: 'occupied',
  o: 'held',
  '.': 'blocked',
}

const GAP = '_'

interface RawRow {
  label: string
  chars: string[]
}

interface RawSection {
  label: string
  rows: RawRow[]
}

const slug = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * Turns a hand-written map into {@link SeatMapSection}s.
 *
 * ```
 * Main cabin
 * 12: ##_##
 * 13: ##_x#
 * ```
 *
 * A line with a colon is a row: its label, then one character per column —
 * `#` available, `x` occupied, `o` held, `.` blocked, `_` aisle. A line without
 * one starts a new section. Whitespace inside a row is ignored, so
 * `12: ## _ ##` reads the same as `12:##_##`.
 *
 * Seat ids are `<row label><column letter>`, with letters assigned left to
 * right and skipping columns that are an aisle in every row — which is what
 * makes `12A 12B _ 12C 12D` come out of a plain string.
 *
 * With more than one section the id gains a `<section>-` prefix, because a
 * theatre really does have a row A in the stalls *and* a row A in the circle
 * and ids have to be unique. The spoken and displayed label stays `AA` in both:
 * the grid each seat sits in is what tells them apart.
 *
 * This is authoring sugar for demos, fixtures and docs. It throws rather than
 * coercing, because a typo in a seat map is a typo you want to hear about at
 * the point you wrote it.
 */
export function parseLayout(spec: string): SeatMapSection[] {
  const sections: RawSection[] = []

  spec.split('\n').forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (line === '') return

    const colon = line.indexOf(':')
    if (colon === -1) {
      sections.push({ label: line, rows: [] })
      return
    }

    const label = line.slice(0, colon).trim()
    const body = line.slice(colon + 1).replace(/\s+/g, '')
    if (label === '') {
      throw new Error(`parseLayout: row on line ${String(index + 1)} has no label`)
    }

    // `Array.from` rather than a spread: the DSL is ASCII by definition, and
    // the lint rule that flags string spreads is right about the general case.
    const chars = Array.from(body)
    for (const char of chars) {
      if (char !== GAP && !(char in STATUS_BY_CHAR)) {
        throw new Error(
          `parseLayout: unknown character "${char}" on line ${String(index + 1)}. ` +
            `Use # available, x occupied, o held, . blocked, _ aisle.`,
        )
      }
    }

    let section = sections.at(-1)
    if (section === undefined) {
      // Rows before any heading are still a map; naming the implicit section
      // beats refusing a two-line example.
      section = { label: 'Seats', rows: [] }
      sections.push(section)
    }
    section.rows.push({ label, chars })
  })

  const usedIds = new Set<string>()

  return sections.map((section, sectionIndex) => {
    const width = section.rows.reduce((widest, row) => Math.max(widest, row.chars.length), 0)

    const columnLabels: string[] = []
    let nextAuto = 0
    for (let column = 0; column < width; column++) {
      const holdsSeat = section.rows.some((row) => {
        const char = row.chars[column]
        return char !== undefined && char !== GAP
      })
      if (!holdsSeat) {
        columnLabels.push('')
        continue
      }
      columnLabels.push(columnLabelAt(nextAuto))
      nextAuto++
    }

    let id = slug(section.label)
    if (id === '' || usedIds.has(id)) id = `section-${String(sectionIndex + 1)}`
    usedIds.add(id)
    const prefix = sections.length > 1 ? `${id}-` : ''

    return {
      id,
      label: section.label,
      columns: columnLabels,
      rows: section.rows.map((row) => ({
        label: row.label,
        cells: Array.from({ length: width }, (_, column): SeatMapCell => {
          const char = row.chars[column]
          if (char === undefined || char === GAP) return null
          const status = STATUS_BY_CHAR[char]
          const seat: Seat = { id: `${prefix}${row.label}${columnLabels[column] ?? ''}` }
          if (status !== undefined && status !== 'available') seat.status = status
          return seat
        }),
      })),
    }
  })
}
