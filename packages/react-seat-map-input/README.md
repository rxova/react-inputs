<p align="center">
  <img src="./assets/logo.svg" alt="@rxova/react-seat-map-input logo" width="180" />
</p>

<h1 align="center">@rxova/react-seat-map-input</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@rxova/react-seat-map-input"><img src="https://img.shields.io/npm/v/@rxova/react-seat-map-input?color=cb3837&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://github.com/rxova/react-inputs/actions/workflows/ci.yml"><img src="https://github.com/rxova/react-inputs/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/brotli-%E2%89%A4%205.5%20kB-f5a623" alt="Brotli size at most 5.5 kB" />
  <img src="https://img.shields.io/badge/coverage%20threshold-95%25-brightgreen" alt="Coverage threshold: 95% per file" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict mode" />
  <img src="https://img.shields.io/badge/dependencies-0-44cc11" alt="Zero runtime dependencies" />
  <img src="https://img.shields.io/badge/React-%E2%89%A518-61dafb?logo=react&logoColor=white" alt="React 18 or newer" />
  <a href="https://github.com/rxova/react-inputs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

**Cabins, theatres, stadiums, car parks.** A headless, zero-dependency React seat map that is an
accessible ARIA grid by default — no flag to turn on.

```bash
npm install @rxova/react-seat-map-input
```

📖 **[Documentation & live examples →](https://rxova.org/packages/react-inputs/components/seat-map/introduction/)** —
guides, form recipes, theming, and migration from `react-seat-picker` / `seatmap-canvas`.

- **A real ARIA grid** — `grid` / `row` / `gridcell`, two-dimensional arrow keys, one tab stop per
  section, focus that scrolls itself into view
- **Sold seats stay reachable** — `aria-disabled`, never the `disabled` attribute, so a keyboard
  user can find out _which_ seats are gone
- **Real checkboxes** — `checked`, `FormData`, native validation and the screen-reader role all come
  from the browser, so `formData.getAll('seats')` is an array
- **A rules engine** — caps, contiguous blocks, no-orphan-seat, and `findBestSeats(3)`
- **Zero runtime dependencies**, ~5.3 kB brotli, no stylesheet to import

## Display

```tsx
import { SeatMap, parseLayout } from '@rxova/react-seat-map-input'

const CABIN = parseLayout(`
  Main cabin
  10: ###_###
  11: ##x_x##
  12: ###_###
`)

function Confirmation() {
  // No onChange: a navigable diagram rather than a set of controls.
  return <SeatMap sections={CABIN} value={['10A', '10B']} label="Your seats" />
}
```

`parseLayout` is authoring sugar for fixtures, demos and docs — one character per column:
`#` available, `x` occupied, `o` held, `.` blocked, `_` aisle. A line with a colon is a row; a line
without one starts a new section. For anything generated, build `SeatMapSection[]` directly.

## Interactive

Providing `onChange` makes it an input. Nothing else changes.

```tsx
import { useState } from 'react'
import { SeatMap } from '@rxova/react-seat-map-input'

function Booking({ sections }: { sections: SeatMapSection[] }) {
  const [seats, setSeats] = useState<string[]>([])

  return (
    <SeatMap
      sections={sections}
      value={seats}
      onChange={setSeats}
      name="seats"
      label="Choose your seats"
      maxSeats={4}
    />
  )
}
```

Hoist the layout, or `useMemo` it. `sections` is memoized by reference, so a layout built inline in
render re-indexes the whole cabin on every keystroke.

## Rules

Four props, applied in this order. The first that refuses wins, and the reason reaches `onReject`
**and** the live region — a seat that silently declines to tick is indistinguishable from a broken
control.

| Prop            | Refuses when                                                   | `rejection.reason` |
| --------------- | -------------------------------------------------------------- | ------------------ |
| —               | the seat's `status` is not `available`                         | `unavailable`      |
| `maxSeats`      | the cap is already reached                                     | `max-seats`        |
| `isSelectable`  | your predicate returns `false`                                 | `not-selectable`   |
| `contiguous`    | the pick is not adjacent to the current block, in the same row | `not-contiguous`   |
| `noOrphanSeats` | the pick would strand a single empty seat                      | `orphan-seat`      |

Deselecting is **never** refused. A rule that traps someone in a selection they cannot undo is worse
than any it prevents.

`minSeats` is different: it never blocks a pick. It borrows the constraint-validation API on the
first seat, so a real `<form>` refuses to submit and reports the problem itself.

```tsx
<SeatMap
  sections={sections}
  value={seats}
  onChange={setSeats}
  contiguous
  noOrphanSeats
  maxSeats={3}
/>
```

### Finding seats together

```tsx
import { findBestSeats } from '@rxova/react-seat-map-input'

const best = findBestSeats(sections, 3) // Seat[], or [] when there is no run that long
```

Earliest section, then earliest row, then the block closest to the centre of its row. Pass
`{ noOrphanSeats: true }` to skip blocks whose booking would strand a lone seat.

## Forms

Every chosen seat is a checkbox under one `name`, so a native form posts a real array — no hidden
inputs, no delimiter to agree on downstream.

```tsx
<form
  onSubmit={(e) => {
    e.preventDefault()
    const seats = new FormData(e.currentTarget).getAll('seats') // ['12A', '12B']
  }}
>
  <SeatMap sections={sections} name="seats" onChange={() => undefined} minSeats={2} label="Seats" />
  <button type="submit">Book</button>
</form>
```

React Hook Form, Formik, React Final Form and TanStack Form each have a worked example in the
[docs](https://rxova.org/packages/react-inputs/components/seat-map/about/), and an integration test
in this package.

## Keyboard

One tab stop per section. A 400-seat stadium costs one `Tab`.

| Key                      | Action                                                    |
| ------------------------ | --------------------------------------------------------- |
| Arrow keys               | Move one seat, stepping over aisles, clamped at the edges |
| `Home` / `End`           | First / last seat in the row                              |
| `Ctrl+Home` / `Ctrl+End` | First / last seat in the section                          |
| `PageUp` / `PageDown`    | Move `pageSize` rows (default 5)                          |
| `Space`                  | Toggle — the checkbox doing its own job                   |
| `Enter`                  | Toggle. Does not submit the surrounding form              |
| `Shift`+`←`/`→`          | Extend the block. Only ever adds                          |

Arrow keys follow the _resolved_ direction, so RTL works whether it comes from the `dir` prop or an
ancestor. Focus scrolls into view with `block: 'nearest'`, which keeps a map inside an
`overflow: auto` container usable without moving the page.

## Styling

There is no stylesheet. Set CSS custom properties on any ancestor:

```css
[data-rx-seat-map-root] {
  --rx-seat-map-seat-size: 2rem;
  --rx-seat-map-bg-selected: #1a56db;
  --rx-seat-map-color-selected: #fff;
  --rx-seat-map-bg-occupied: #d4d4d4;
}
```

`--rx-seat-map-seat-size`, `-gap`, `-row-gap`, `-section-gap`, `-aisle-width`, `-row-header-width`,
`-radius`, `-border-width`, `-border`, `-mark-size`, `-label-size`, `-label-color`, `-transition`,
`-focus-ring`, `-focus-ring-offset`, `-focus-ring-radius`, plus `-bg-*`, `-color-*` and `-border-*`
for each of `available`, `selected`, `occupied`, `held` and `blocked`.

### `data-*` attributes

Public API, covered by semver.

| Attribute                                                                                              | On                              |
| ------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `data-rx-seat-map-root`                                                                                | the field wrapper               |
| `data-rx-seat-map-section="{id}"`                                                                      | each grid                       |
| `data-rx-seat-map-row="{label}"`                                                                       | each row                        |
| `data-rx-seat-map-row-header` / `data-rx-seat-map-column-header="{label}"` / `data-rx-seat-map-corner` | the headers                     |
| `data-rx-seat-map-cell`                                                                                | each seat cell                  |
| `data-rx-seat-map-seat="{id}"`                                                                         | the focusable element inside it |
| `data-rx-seat-map-gap`                                                                                 | an aisle                        |
| `data-rx-seat-map-visual`                                                                              | the default artwork             |
| `data-rx-seat-map-announcement`                                                                        | the live region                 |
| `data-state="available\|selected\|occupied\|held\|blocked"`, `data-focused`                            | state hooks on the cell         |
| `data-disabled`, `data-readonly`, `data-invalid`                                                       | state hooks on the root         |

## Props

The full surface is [`SeatMapProps`](./src/types.ts), whose TSDoc is the published
[API reference](https://rxova.org/packages/react-inputs/components/seat-map/api).

## Resilient input

A seat map is fed by an inventory API and themed by someone else's code, so both
are treated as hostile.

| Given                                                 | It does                                                                                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `maxSeats` of `0`, `-1`, `2.5`, `NaN` or `Infinity`   | ignores the cap and warns                                                                 |
| `pageSize` of `0`, `-3` or `NaN`                      | falls back to `5` — the page keys are never inverted or dead                              |
| `value` naming seats the layout does not have         | drops them and warns                                                                      |
| the same seat `id` twice                              | keeps the first selectable, warns once                                                    |
| a ragged section                                      | pads every row to the widest, so columns cannot drift                                     |
| `isSelectable` that throws                            | refuses that seat                                                                         |
| `formatSeatLabel` that throws or returns nothing      | falls back to the built-in name                                                           |
| `formatAnnouncement` that throws or returns nothing   | falls back to the built-in wording                                                        |
| `renderSeat` that throws                              | falls back to the built-in artwork                                                        |
| `formatValidationMessage` that throws or returns `''` | keeps the form invalid, with the built-in message                                         |
| `onChange` that throws                                | **propagates** — it is your state setter, and swallowing it would desync the map from you |
| a five-thousand seat map                              | one render; selection membership is a `Set`, not a scan                                   |

Nothing here throws at you. `onWarn` reports what was coerced, in development
only. The whole table is executable in `src/__tests__/adversarial.browser.test.tsx`.

## Headless

`useSeatMap` returns the indexed grid, the selection, roving focus, the rule engine and the
live-region text, for building your own markup.

```tsx
const { grid, value, toggle, resolveMove, tabbableIds, announcement } = useSeatMap({
  sections,
  onChange,
})
```

## Accessibility

No opt-in flag, no config key. Every seat is a real checkbox inside a `role="gridcell"`, inside a
`role="row"`, inside a named `role="grid"`.

- **Unavailable seats carry `aria-disabled`, never the `disabled` attribute.** A disabled checkbox is
  not focusable, so arrowing across a cabin would silently skip every sold seat and a keyboard user
  could never learn which ones are gone.
- **Status is not colour alone.** Each state draws a distinct mark and border style, and says itself
  in the accessible name — `12B, taken`.
- **Refusals are spoken**, with the reason, in a polite live region.
- **A read-only map** has no control to carry `checked`, so it states selection with `aria-selected`
  on the cell and `aria-readonly` on the grid. The two models are never mixed.
- **The default seat is 28×28 px**, clearing the WCAG 2.2 §2.5.8 24×24 floor out of the box.

Every one of those is an executable assertion in this package's `src/__tests__/a11y.browser.test.tsx`
and `e2e/a11y.spec.ts`, which run axe over the component and over a whole page.

**Deliberately not included:** pan and zoom. It is most of what the alternatives weigh, and it is
the thing that breaks keyboard reachability. Put the map in an `overflow: auto` container and change
`--rx-seat-map-seat-size`.

## UI-library recipes

The docs contain maintained examples for shadcn/ui, Radix Themes, Material UI, Chakra UI, Mantine
and Ant Design. Copy a ready-labelled wrapper with:

```bash
npx shadcn@latest add https://rxova.org/packages/react-inputs/r/seat-map-field.json
```

[Open the recipes](https://rxova.org/packages/react-inputs/components/seat-map/about/#ui-library-recipes).

## Part of rxova

Part of the [rxova headless React inputs](https://rxova.org/packages/react-inputs/overview) suite —
install the whole set from
[`@rxova/react-inputs`](https://www.npmjs.com/package/@rxova/react-inputs), or read the full
generated [API reference](https://rxova.org/packages/react-inputs/components/seat-map/api) for this
package.

Migrating from `react-seat-picker`, `seatmap-canvas` or a hand-rolled grid of `<div>`s? The
[migration guide](https://rxova.org/packages/react-inputs/components/seat-map/migrating/) has a
section for each.

## License

[MIT](https://github.com/rxova/react-inputs/blob/main/LICENSE) © rxova
