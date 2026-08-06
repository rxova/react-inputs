<p align="center">
  <img src="./assets/logo.svg" alt="@rxova/react-date-input logo" width="180" />
</p>

<h1 align="center">@rxova/react-date-input</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@rxova/react-date-input"><img src="https://img.shields.io/npm/v/@rxova/react-date-input?color=cb3837&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://github.com/rxova/react-inputs/actions/workflows/ci.yml"><img src="https://github.com/rxova/react-inputs/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/brotli-%E2%89%A4%204%20kB-f5a623" alt="Brotli size at most 4 kB" />
  <img src="https://img.shields.io/badge/coverage%20threshold-95%25-brightgreen" alt="Coverage threshold: 95% per file" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict mode" />
  <img src="https://img.shields.io/badge/dependencies-0-44cc11" alt="Zero runtime dependencies" />
  <img src="https://img.shields.io/badge/React-%E2%89%A518-61dafb?logo=react&logoColor=white" alt="React 18 or newer" />
  <a href="https://github.com/rxova/react-inputs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

**A segmented date field with no calendar, no date library, and no timezone bugs.**
Headless, zero-dependency, locale-aware through `Intl`.

```bash
npm install @rxova/react-date-input
```

📖 **[Documentation & live examples →](https://rxova.org/packages/react-inputs/components/date/introduction/)** — guides, form recipes, theming, locale handling, and migration from another date picker.

- **No calendar.** For a birthday or an invoice date, typing `15/03/1999` is faster than eleven
  clicks through a month grid. This is the field for dates you already know.
- **No date library.** Segment order, separators and month names come from `Intl`, which every
  engine already ships. `react-datepicker` brings `date-fns` and `@floating-ui` and lands at
  40.0 kB brotli; `react-day-picker` at 17.9 kB. This is 3.3 kB and brings nothing.
- **No `Date` objects, so no off-by-one.** The value is a `YYYY-MM-DD` string from end to end.
- **Fully keyboard-operable** — type, arrow, Home/End, auto-advance, backspace.
- **Real `spinbutton` semantics** per segment, with the month announced by name.
- **Zero runtime dependencies**, 3.3 kB brotli, no stylesheet to import.

## Basic use

```tsx
import { useState } from 'react'
import { DateInput } from '@rxova/react-date-input'

function Birthday() {
  const [value, setValue] = useState<string | null>(null)
  return <DateInput label="Date of birth" value={value} onChange={setValue} max="2026-07-29" />
}
```

`value` is `'1999-03-15'` or `null`. `onChange` fires when the date becomes complete and valid, and
when it stops being — never with a half-typed date in between.

## Why a string and not a `Date`

This is the design decision everything else follows from.

```js
// Somewhere west of Greenwich:
new Date('2026-03-01').getDate() // 28  — parsed as UTC midnight
new Date(2026, 2, 1).getDate() // 1   — parsed as local midnight
```

A calendar date is a year, a month and a day. It is **not** a point in time. The moment it becomes
one it acquires a timezone it never had, and that single discrepancy is behind most "my date picker
is a day off" reports. So this package never constructs a `Date` for a value: it stores three
numbers, formats them as `YYYY-MM-DD`, and compares ranges as strings — which works because that
format sorts lexicographically in exactly the same order it sorts chronologically.

If you need a `Date` at the boundary of your app, construct it there and be explicit about the zone
you mean.

## Locales

Segment order, separators and month names all come from `Intl.DateTimeFormat`, so this is correct
for every locale the platform knows and costs nothing:

```tsx
import { DateInput } from '@rxova/react-date-input'

function Examples() {
  return (
    <>
      <DateInput label="US" locale="en-US" /> {/* mm / dd / yyyy */}
      <DateInput label="UK" locale="en-GB" /> {/* dd / mm / yyyy */}
      <DateInput label="Japan" locale="ja-JP" /> {/* yyyy / mm / dd */}
    </>
  )
}
```

Omit `locale` to use the runtime's own. A malformed tag (`en_US`, with an underscore) falls back to
ISO order and reports `locale-invalid` through `onWarn` rather than throwing.

## Keyboard

Every part of the field is reachable and operable without a pointer.

| Key                    | Effect                                                                        |
| ---------------------- | ----------------------------------------------------------------------------- |
| `0`–`9`                | Type into the focused segment; advances as soon as no further digit could fit |
| `↑` / `↓`              | Step the focused segment, wrapping at its ends                                |
| `←` / `→`              | Move between segments; stops at the ends rather than cycling                  |
| `Home` / `End`         | Jump the focused segment to its minimum or maximum                            |
| `Backspace` / `Delete` | Clear the focused segment                                                     |
| `Tab`                  | Move to the next segment, then out of the field                               |

Typing is forgiving in the ways that matter: `4` in a day is immediately the 4th, `1` waits to see
whether you meant the 1st or the 19th, and `1` then `9` in a _month_ gives you September rather than
rejecting the keystroke.

## Range

```tsx
import { DateInput } from '@rxova/react-date-input'

function Booking() {
  return <DateInput label="Check-in" min="2026-01-01" max="2026-12-31" />
}
```

Both bounds are inclusive. A completed date outside the range is **still reported** through
`onChange`, with the field marked `data-out-of-range` and `aria-invalid` — silently swallowing what
someone typed leaves them looking at a field that appears accepted and a form that will not submit,
with nothing connecting the two. Set `emitOutOfRange={false}` if you would rather have `null`.

A `min` after the `max` is dropped entirely (and reported through `onWarn`): a field nothing can be
entered into is worse than a missing bound.

## Forms

With a `name`, the component emits a hidden input carrying the ISO value, so a native form posts it
with no wiring:

```tsx
import { DateInput } from '@rxova/react-date-input'

function Form() {
  return (
    <form action="/invoices" method="post">
      <DateInput label="Due" name="due" />
      <button type="submit">Save</button>
    </form>
  )
}
```

A hidden input is barred from constraint validation, so `required` is surfaced as `aria-required`
on the group and enforcing it stays with your form layer. React Hook Form, Formik and the rest work
through `value`/`onChange` as usual.

## Styling

There is no stylesheet to import. Only layout-critical declarations are inlined; everything visual
is a CSS custom property or a `data-*` hook.

| Property                      | Default               | Applies to                  |
| ----------------------------- | --------------------- | --------------------------- |
| `--rx-date-gap`               | `0.0625rem`           | Space between pieces        |
| `--rx-date-segment-padding`   | `0 0.0625rem`         | Inside each segment         |
| `--rx-date-segment-radius`    | `0.125rem`            | Segment corners             |
| `--rx-date-literal-opacity`   | `0.7`                 | The separators              |
| `--rx-date-focus-ring`        | `2px solid Highlight` | Ring on the focused segment |
| `--rx-date-focus-ring-offset` | `1px`                 | Its offset                  |

The focused segment paints a ring by default. A `<span role="spinbutton">` gets none from the
browser, so overriding these is the supported way to restyle it — removing it outright leaves a
keyboard user unable to tell which of the three segments they are on.

```css
[data-rx-date-segment][data-focused] {
  background: Highlight;
  color: HighlightText;
}

[data-rx-date-segment][data-placeholder] {
  opacity: 0.55;
}
```

### `data-*` attributes

These are **public API**, covered by semver.

| Attribute                         | On           | Meaning                                   |
| --------------------------------- | ------------ | ----------------------------------------- |
| `data-rx-date-root`               | wrapper      | Always present                            |
| `data-complete`                   | wrapper      | Every segment filled and the date is real |
| `data-invalid`                    | wrapper      | `invalid` prop, or out of range           |
| `data-out-of-range`               | wrapper      | Complete but outside `min`/`max`          |
| `data-disabled` / `data-readonly` | wrapper      | Mirrors the props                         |
| `data-rx-date-segment`            | segment      | `day`, `month` or `year`                  |
| `data-placeholder`                | segment      | The segment is empty                      |
| `data-focused`                    | segment      | The segment has focus                     |
| `data-rx-date-value`              | hidden input | The ISO value a form posts                |

## Headless

`useDateInput` gives you the whole state machine with no markup — the digit buffer with
auto-advance, day re-clamping, locale layout and focus management.

```tsx
import { useDateInput } from '@rxova/react-date-input'

function CustomField() {
  const field = useDateInput({ locale: 'en-GB' })

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
            }}
          >
            {field.parts[piece.type] ?? '--'}
          </span>
        ),
      )}
    </div>
  )
}
```

The calendar helpers are exported too — `toISO`, `fromISO`, `daysInMonth`, `isLeapYear`,
`compareISO`, `withinRange` — all pure, all `Date`-free.

## Diagnostics

`onWarn` receives a `{ code, prop, received, message }` whenever a prop is rejected or coerced:

```tsx
import * as Sentry from '@sentry/react'
import { DateInput } from '@rxova/react-date-input'

function Field() {
  return (
    <DateInput
      label="Due"
      onWarn={(warning) => {
        Sentry.captureMessage(warning.message, { level: 'warning', extra: { ...warning } })
      }}
    />
  )
}
```

Codes: `value-unparseable`, `value-out-of-range`, `min-unparseable`, `max-unparseable`,
`min-after-max`, `locale-invalid`.

With no handler the same warnings go to `console.warn`. **The entire path is stripped from
production builds** — it sits behind a `process.env.NODE_ENV !== 'production'` branch, so there is
no runtime cost and no console noise in production. The E2E suite asserts this against a real
production bundle.

## Accessibility

- A `role="group"` of three `role="spinbutton"` segments. A single control would leave a screen
  reader user unable to tell which part they are editing.
- Each segment carries `aria-valuemin` / `aria-valuemax` / `aria-valuenow`, and the bounds
  **narrow as the date fills in** — the day range is 1–29 in a February, 1–28 once the year rules
  out a leap year.
- The month announces as its **name** (`aria-valuetext="March"`), localised. "3" is the value;
  "March" is what the user is choosing.
- An empty segment announces its placeholder and carries no `aria-valuenow`, rather than claiming
  a value of 0.
- Separators are `aria-hidden`; reading "slash" between two named spinbuttons adds nothing.
- Disabled segments stay in the accessibility tree but leave the tab order.
- axe (WCAG 2.1 A/AA) runs over the component in the browser suite and over the whole demo page in
  Chromium, Firefox and WebKit — including a right-to-left locale.

## UI-library recipes

The docs contain maintained examples for shadcn/ui, Radix Themes, Material UI, Chakra UI, Mantine
and Ant Design. Copy a ready-labelled wrapper with:

```bash
npx shadcn@latest add https://rxova.org/packages/react-inputs/r/date-field.json
```

[Open the recipes](https://rxova.org/packages/react-inputs/components/date/about/#ui-library-recipes).

## Part of rxova

Part of the [rxova headless React inputs](https://rxova.org/packages/react-inputs/overview) suite —
install the whole set from
[`@rxova/react-inputs`](https://www.npmjs.com/package/@rxova/react-inputs), or read the full
generated [API reference](https://rxova.org/packages/react-inputs/components/date/api) for this package.

Cross-cutting guidance lives on this component's About page:
[styling](https://rxova.org/packages/react-inputs/components/date/about/#styling) and [form libraries](https://rxova.org/packages/react-inputs/components/date/about/#form-libraries). Coming from
another library? The [migration guide](https://rxova.org/packages/react-inputs/components/date/migrating/) maps the props across.

## License

[MIT](https://github.com/rxova/react-inputs/blob/main/LICENSE) © rxova
