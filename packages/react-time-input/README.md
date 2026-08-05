<h1 align="center">@rxova/react-time-input</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@rxova/react-time-input"><img src="https://img.shields.io/npm/v/@rxova/react-time-input?color=cb3837&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://github.com/rxova/react-inputs/actions/workflows/ci.yml"><img src="https://github.com/rxova/react-inputs/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/brotli-%E2%89%A4%204%20kB-f5a623" alt="Brotli size at most 4 kB" />
  <img src="https://img.shields.io/badge/coverage%20threshold-95%25-brightgreen" alt="Coverage threshold: 95% per file" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict mode" />
  <img src="https://img.shields.io/badge/dependencies-0-44cc11" alt="Zero runtime dependencies" />
  <img src="https://img.shields.io/badge/React-%E2%89%A518-61dafb?logo=react&logoColor=white" alt="React 18 or newer" />
  <a href="https://github.com/rxova/react-inputs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

**A segmented time field with no clock popup, no date library, and no timezone bugs.**
Headless, zero-dependency, 12/24-hour from `Intl`.

```bash
npm install @rxova/react-time-input
```

📖 **[Documentation & live examples →](https://rxova.org/packages/react-inputs/components/time/introduction/)** — guides, form recipes, theming, locale handling, and migration from another time picker.

- **No popup.** A time is three short numbers. Typing `14:30` beats scrolling a column of 60.
- **No date library.** 12/24-hour, segment order, separators and the AM/PM words all come from
  `Intl`, which every engine already ships. `react-time-picker` brings seven dependencies and
  9.8 kB; this brings none and 3.8 kB.
- **No `Date` objects.** The value is an `HH:mm` string end to end — a time of day is not an
  instant.
- **Midnight and noon are right.** 12 AM is hour 0, 12 PM is hour 12, and an exhaustive test sweeps
  all 24 hours to prove it.
- **Fully keyboard-operable** — type, arrow, Home/End, auto-advance, backspace, `a`/`p`.
- **Zero runtime dependencies**, 3.8 kB brotli, no stylesheet to import.

## Basic use

```tsx
import { useState } from 'react'
import { TimeInput } from '@rxova/react-time-input'

function Booking() {
  const [value, setValue] = useState<string | null>(null)
  return <TimeInput label="Start time" value={value} onChange={setValue} min="09:00" max="17:00" />
}
```

`value` is `'14:30'` or `null`. `onChange` fires when the time becomes complete and valid, and when
it stops being — never with a half-typed number in between.

## The value is always 24-hour

Whatever the field displays. A US user sees `02:30 PM`; the value, and anything a form posts, is
`14:30`.

That is the point: one canonical format means a value can be stored, compared and sorted without
knowing which locale produced it. Range comparisons are plain string comparisons, which the format
makes correct — including across precisions, so a `min` of `09:00` orders correctly against a value
of `09:00:30`.

And it is a **string, never a `Date`**:

```js
new Date('14:30') // Invalid Date
new Date('2026-01-01T14:30') // a moment that moves with the timezone and with DST
```

A time of day is not an instant. There is deliberately no `toDate()` helper, because it cannot be
written without inventing a date and a timezone you did not supply.

## Clocks

12- or 24-hour comes from the locale, and so do the AM/PM words:

```tsx
import { TimeInput } from '@rxova/react-time-input'

function Examples() {
  return (
    <>
      <TimeInput label="US" locale="en-US" /> {/* hh:mm AM */}
      <TimeInput label="UK" locale="en-GB" /> {/* HH:mm    */}
      <TimeInput label="Japan" locale="ja-JP" hour12 /> {/* 午前 hh:mm */}
    </>
  )
}
```

Omit `locale` to use the runtime's own; pass `hour12` to force either clock. A malformed tag
(`en_US`, with an underscore) falls back to a 24-hour field and reports `locale-invalid` through
`onWarn` rather than throwing.

## Keyboard

| Key                    | Effect                                                                  |
| ---------------------- | ----------------------------------------------------------------------- |
| `0`–`9`                | Type into the focused segment; advances when no further digit could fit |
| `a` / `p`              | Set AM or PM (also the localised first letter)                          |
| `↑` / `↓`              | Step the focused segment, wrapping at its ends                          |
| `←` / `→`              | Move between segments; stops at the ends rather than cycling            |
| `Home` / `End`         | Jump the focused segment to its minimum or maximum                      |
| `Backspace` / `Delete` | Clear the focused segment                                               |
| `Tab`                  | Move to the next segment, then out of the field                         |

## Seconds and steps

```tsx
import { TimeInput } from '@rxova/react-time-input'

function Precise() {
  return <TimeInput label="Duration start" showSeconds minuteStep={15} secondStep={30} />
}
```

Steps must divide 60 — a 7-minute step leaves a 4-minute bucket at the top of every hour, so it is
refused and reported through `onWarn`. Steps apply to arrow-key stepping, not to typing: a user can
still type `09:07` under a 15-minute step, because enforcing the grid mid-entry fights them.

## Range

Both bounds are inclusive. A completed time outside the range is **still reported** through
`onChange`, with the field marked `data-out-of-range` and `aria-invalid` — silently swallowing what
someone typed leaves them looking at a field that appears accepted and a form that will not submit.
Set `emitOutOfRange={false}` if you would rather have `null`.

A `min` after the `max` is dropped and reported. `22:00`–`06:00` is two ranges, not one, and this
component does not model a range that wraps past midnight.

## Forms

With a `name`, the component emits a hidden input carrying the 24-hour value:

```tsx
import { TimeInput } from '@rxova/react-time-input'

function Form() {
  return (
    <form action="/bookings" method="post">
      <TimeInput label="Starts at" name="at" locale="en-US" defaultValue="14:30" />
      <button type="submit">Save</button>
    </form>
  )
}
```

The box shows `02:30 PM`; the form receives `14:30`. A hidden input is barred from constraint
validation, so `required` is surfaced as `aria-required` on the group and enforcing it stays with
your form layer.

## Styling

There is no stylesheet to import.

| Property                      | Default               | Applies to                  |
| ----------------------------- | --------------------- | --------------------------- |
| `--rx-time-gap`               | `0.0625rem`           | Space between pieces        |
| `--rx-time-segment-padding`   | `0 0.0625rem`         | Inside each segment         |
| `--rx-time-segment-radius`    | `0.125rem`            | Segment corners             |
| `--rx-time-literal-opacity`   | `0.7`                 | The separators              |
| `--rx-time-focus-ring`        | `2px solid Highlight` | Ring on the focused segment |
| `--rx-time-focus-ring-offset` | `1px`                 | Its offset                  |

The focused segment paints a ring by default. A `<span role="spinbutton">` gets none from the
browser, so overriding these is the supported way to restyle it — removing it outright leaves a
keyboard user unable to tell which segment they are on.

### `data-*` attributes

These are **public API**, covered by semver.

| Attribute                         | On           | Meaning                                   |
| --------------------------------- | ------------ | ----------------------------------------- |
| `data-rx-time-root`               | wrapper      | Always present                            |
| `data-complete`                   | wrapper      | Every needed segment filled               |
| `data-invalid`                    | wrapper      | `invalid` prop, or out of range           |
| `data-out-of-range`               | wrapper      | Complete but outside `min`/`max`          |
| `data-disabled` / `data-readonly` | wrapper      | Mirrors the props                         |
| `data-rx-time-segment`            | segment      | `hour`, `minute`, `second` or `dayPeriod` |
| `data-placeholder`                | segment      | The segment is empty                      |
| `data-focused`                    | segment      | The segment has focus                     |
| `data-rx-time-value`              | hidden input | The 24-hour value a form posts            |

## Headless

`useTimeInput` gives you the whole state machine with no markup — including the 12/24-hour
translation and the digit buffer, which are the parts worth not rewriting.

```tsx
import { useTimeInput } from '@rxova/react-time-input'

function CustomField() {
  const field = useTimeInput({ locale: 'en-US' })

  return (
    <div onBlur={field.handleBlur}>
      {field.pieces.map((piece, index) =>
        piece.kind === 'literal' ? (
          <span key={index}>{piece.text}</span>
        ) : (
          <span
            key={piece.type}
            ref={(node) => {
              field.segmentRefs.current[piece.type] = node
            }}
            role="spinbutton"
            tabIndex={0}
            onFocus={(event) => {
              field.handleSegmentFocus(piece.type, event)
            }}
            onKeyDown={(event) => {
              if (/^\d$/.test(event.key)) field.typeDigit(piece.type, event.key)
              else if (event.key === 'ArrowUp') field.step(piece.type, 1)
              else if (event.key === 'ArrowDown') field.step(piece.type, -1)
              else field.typeLetter(piece.type, event.key)
            }}
          >
            {field.displayValue(piece.type) ?? '--'}
          </span>
        ),
      )}
    </div>
  )
}
```

The clock helpers are exported too — `toISO`, `fromISO`, `toDisplayHour`, `fromDisplayHour`,
`toDayPeriod`, `compareISO`, `withinRange` — all pure and all `Date`-free.

## Diagnostics

`onWarn` receives `{ code, prop, received, message }` whenever a prop is rejected or coerced.
Codes: `value-unparseable`, `value-out-of-range`, `min-unparseable`, `max-unparseable`,
`min-after-max`, `step-invalid`, `locale-invalid`.

The `value-unparseable` message recognises a display format and shows the 24-hour equivalent, so
passing `"2:30 PM"` tells you to pass `"14:30"`.

With no handler these go to `console.warn`. **The entire path is stripped from production builds** —
it sits behind a `process.env.NODE_ENV !== 'production'` branch, so there is no runtime cost and no
console noise in production. The E2E suite asserts this against a real production bundle.

## Accessibility

- A `role="group"` of `role="spinbutton"` segments — including the day period, which is a bounded
  value stepped with arrows.
- The day period announces as its **localised word** (`aria-valuetext="PM"`, `午後`), never as 0
  or 1.
- The hour's `aria-valuemin`/`max` follow the clock in use — 1–12 or 0–23 — and `aria-valuenow` is
  the number on the clock face, not the stored 0–23 hour.
- An empty segment announces its placeholder and carries no `aria-valuenow`.
- Separators are `aria-hidden`; reading "colon" between two named spinbuttons adds nothing.
- Disabled segments stay in the accessibility tree but leave the tab order.
- axe (WCAG 2.1 A/AA) runs over the component in the browser suite and over the whole demo page in
  Chromium, Firefox and WebKit — including a right-to-left locale.

## Part of rxova

Part of the [rxova headless React inputs](https://rxova.org/packages/react-inputs/overview) suite —
install the whole set from
[`@rxova/react-inputs`](https://www.npmjs.com/package/@rxova/react-inputs), or read the full
generated [API reference](https://rxova.org/packages/react-inputs/components/time/api) for this package.

Cross-cutting guidance lives on this component's About page:
[styling](https://rxova.org/packages/react-inputs/components/time/about/#styling) and [form libraries](https://rxova.org/packages/react-inputs/components/time/about/#form-libraries). Coming from
another library? The [migration guide](https://rxova.org/packages/react-inputs/components/time/migrating/) maps the props across.

## License

[MIT](https://github.com/rxova/react-inputs/blob/main/LICENSE) © rxova
