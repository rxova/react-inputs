<p align="center">
  <img src="./assets/logo.svg" alt="@rxova/react-duration-input logo" width="180" />
</p>

<h1 align="center">@rxova/react-duration-input</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@rxova/react-duration-input"><img src="https://img.shields.io/npm/v/@rxova/react-duration-input?color=cb3837&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://github.com/rxova/react-inputs/actions/workflows/ci.yml"><img src="https://github.com/rxova/react-inputs/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/brotli-%E2%89%A4%204.75%20kB-f5a623" alt="Brotli size at most 4.75 kB" />
  <img src="https://img.shields.io/badge/coverage%20threshold-95%25-brightgreen" alt="Coverage threshold: 95% per file" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict mode" />
  <img src="https://img.shields.io/badge/dependencies-0-44cc11" alt="Zero runtime dependencies" />
  <img src="https://img.shields.io/badge/React-%E2%89%A518-61dafb?logo=react&logoColor=white" alt="React 18 or newer" />
  <a href="https://github.com/rxova/react-inputs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

**A segmented duration field: days, hours, minutes and seconds as real spinbuttons.**
ISO 8601 in and out. Headless, zero-dependency, no date library.

```bash
npm install @rxova/react-duration-input
```

📖 **[Documentation & live examples →](https://rxova.org/packages/react-inputs/components/duration/introduction/)** — guides, form recipes, theming, and migration from another duration picker.

- **`90` in the minutes box means ninety minutes.** The largest unit on screen is unbounded, and
  overflow carries upward when you leave the field — so `90m` settles into `1h 30m` instead of
  being refused at the keystroke.
- **`P1M` is one month, not one minute.** Calendar units are rejected with an explanation rather
  than silently read as minutes, which is a 43,200× error and the classic bug in ISO duration
  parsers.
- **Real spinbuttons.** Every segment is `role="spinbutton"` with a name, a value and bounds. Not
  one of the six duration packages on npm mentions `aria`, `role=` or `tabindex` anywhere in its
  README.
- **No scroll wheel.** `react-duration-picker` is an Android-style column spinner; this is a field
  you type into.
- **No stylesheet.** `react-duration-control` makes you `import` a CSS file. This ships CSS custom
  properties and `data-*` hooks instead.
- **Zero runtime dependencies**, 4.7 kB brotli, no `Date`, no stylesheet to import.

## Basic use

```tsx
import { useState } from 'react'
import { DurationInput } from '@rxova/react-duration-input'

function Meeting() {
  const [value, setValue] = useState<string | null>(null)
  return <DurationInput label="Length" value={value} onChange={setValue} max="PT8H" />
}
```

`value` is `'PT1H30M'` or `null`. `onChange` fires when the duration becomes complete and valid, and
when it stops being — never with a half-typed number in between.

## The value does not sort as a string

This is the one place this component differs from its siblings, and it is worth being loud about.

The date and time fields can compare their values with `<`, because `YYYY-MM-DD` and `HH:mm` are
fixed-width and big-endian. An ISO 8601 duration is neither:

```ts
'PT10M' < 'PT2H' // true — and wrong. Ten minutes is shorter than two hours.
```

So compare through seconds. Both helpers are exported:

```ts
import { compareDurations, toSeconds } from '@rxova/react-duration-input'

compareDurations('PT10M', 'PT2H') // -1
toSeconds('PT1H30M') // 5400
;['PT2H', 'PT10M', 'P1D'].sort(compareDurations) // ['PT10M', 'PT2H', 'P1D']
```

`min` and `max` on the component already do this, so `min="PT10M" max="PT2H"` behaves the way it
reads.

## Why ISO 8601 and not a number of seconds

A number needs a units contract travelling beside it, and that contract is where the bugs live —
one service stores seconds, the next stores milliseconds, and `3600` is valid in both. `PT1H` says
what it is. It survives JSON, a database column and a parser written in another language, and
`Postgres interval`, `java.time.Duration` and `System.Text.Json` all already read it.

If your backend does store a number, convert at the boundary rather than in the field:

```tsx
import {
  DurationInput,
  secondsToDuration,
  toISODuration,
  toSeconds,
} from '@rxova/react-duration-input'

const iso = toISODuration(secondsToDuration(5400, ['hour', 'minute']), ['hour', 'minute'])
// 'PT1H30M'
toSeconds(iso!) // 5400
```

## Units

```tsx
import { DurationInput } from '@rxova/react-duration-input'

function Examples() {
  return (
    <>
      {/* ['hour', 'minute'] is the default */}
      <DurationInput label="Cooking time" units={['hour', 'minute']} />
      <DurationInput label="Video position" units={['minute', 'second']} />
      <DurationInput label="Lead time" units={['day', 'hour']} />
      <DurationInput label="Timeout" units={['second']} />
    </>
  )
}
```

The largest unit on screen has **no ceiling** — in a minutes-only field, `180` is three hours and
that is exactly what someone means. Every unit below it is bounded by the one above (hours 0–23
under days, minutes and seconds 0–59), and overflow carries upward on blur.

The array is sorted and deduped: `['minute', 'hour']` renders as hours then minutes. Rendering it
as written would put a 0–59 segment in front of an unbounded one — a field where `90` is refused in
the first box and accepted in the second.

Months and years are deliberately absent. They are not a fixed number of seconds — February is 28
or 29 days — and a field whose whole job is exactness has no business guessing.

## Arrow keys clamp; they do not wrap

The time field wraps, because a clock cycles: 23:59 plus a minute is 00:00. A duration has no such
cycle. Arrowing down from `0m` to `59m` would silently lengthen the value by an hour, so each
segment stops at its own ends instead.

## Keyboard

| Key                    | What it does                                                               |
| ---------------------- | -------------------------------------------------------------------------- |
| `0`–`9`                | Types into the focused segment; advances when it cannot take more          |
| `↑` / `↓`              | Steps by `minuteStep` / `secondStep`, clamped at each end                  |
| `←` / `→`              | Moves between segments                                                     |
| `Home`                 | Sets the segment to zero                                                   |
| `End`                  | Sets the segment to its maximum (nothing on the unbounded leading segment) |
| `Backspace` / `Delete` | Empties the segment                                                        |
| `Tab`                  | Leaves the field, settling whatever is typed                               |

## Accessibility

The field is a `role="group"` containing one `role="spinbutton"` per unit. Each carries the
locale's own word as its accessible name — `hours`, not `h` — plus `aria-valuemin`,
`aria-valuenow` and an `aria-valuetext` that reads as a quantity (`2 hours`, not `2`).

`aria-valuemax` is **omitted** on the leading segment rather than set to a large number. The
attribute is a promise about the ceiling, and there is none.

The focused segment paints a ring by default (`2px solid Highlight`), because a
`<span role="spinbutton">` gets none from the browser. Restyle it through
`--rx-duration-focus-ring` rather than removing it.

## Forms

`name` emits a hidden input carrying the ISO string, so a native `<form>` and `FormData` work with
no wiring. `required` becomes `aria-required` on the group — a hidden input is barred from
constraint validation, so putting `required` on it would look like it was doing something.

Recipes for React Hook Form, Formik, React Final Form and TanStack Form are on the
[About page](https://rxova.org/packages/react-inputs/components/duration/about/).

## Styling

There is no stylesheet. Set CSS custom properties on any ancestor:

```css
.field {
  --rx-duration-gap: 0.125rem;
  --rx-duration-segment-padding: 0 0.125rem;
  --rx-duration-segment-radius: 0.25rem;
  --rx-duration-suffix-opacity: 0.6;
  --rx-duration-suffix-size: 0.8em;
  --rx-duration-focus-ring: 2px solid #1a56db;
  --rx-duration-focus-ring-offset: 2px;
}
```

Or target the `data-*` attributes, which are public API covered by semver: `data-rx-duration-root`,
`data-rx-duration-segment` (`day` / `hour` / `minute` / `second`), `data-rx-duration-value` and
`data-rx-duration-leading`, plus the shared state hooks `data-complete`, `data-out-of-range`, `data-placeholder`,
`data-focused`, `data-disabled`, `data-readonly`, `data-invalid`.

## Headless

`useDurationInput` is the whole state machine with no markup, for a completely custom renderer:

```tsx
import { useDurationInput } from '@rxova/react-duration-input'

const field = useDurationInput({ units: ['hour', 'minute'], onChange: save })
// field.parts, field.value, field.seconds, field.pieces, field.typeDigit, field.step, …
```

## Diagnostics

Every rejected or coerced prop reaches `onWarn` in development, with a machine code and a message
safe to log as-is — a `value` that is not a duration, a `min` longer than the `max`, a `units` entry
that is not a unit, a value finer than the units on screen. The entire path is stripped from
production builds.

## License

MIT
