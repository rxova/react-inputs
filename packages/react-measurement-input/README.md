<p align="center">
  <img src="./assets/logo.svg" alt="@rxova/react-measurement-input logo" width="180" />
</p>

<h1 align="center">@rxova/react-measurement-input</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@rxova/react-measurement-input"><img src="https://img.shields.io/npm/v/@rxova/react-measurement-input?color=cb3837&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://github.com/rxova/react-inputs/actions/workflows/ci.yml"><img src="https://github.com/rxova/react-inputs/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/brotli-%E2%89%A4%206.75%20kB-f5a623" alt="Brotli size at most 6.75 kB" />
  <img src="https://img.shields.io/badge/coverage%20threshold-95%25-brightgreen" alt="Coverage threshold: 95% per file" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict mode" />
  <img src="https://img.shields.io/badge/dependencies-0-44cc11" alt="Zero runtime dependencies" />
  <img src="https://img.shields.io/badge/React-%E2%89%A518-61dafb?logo=react&logoColor=white" alt="React 18 or newer" />
  <a href="https://github.com/rxova/react-inputs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

**A segmented measurement field: `5 ft 11 in`, `12 st 2 lb`, `1 m 80 cm` as real spinbuttons.**
Exact conversion built in. Headless, zero-dependency, no conversion library.

```bash
npm install @rxova/react-measurement-input
```

📖 **[Documentation & live examples →](https://rxova.org/packages/react-inputs/components/measurement/introduction/)** — guides, form recipes, theming, and the full unit table.

- **The gap this fills is a UI, not a converter.** npm has `convert` (1 MB unpacked),
  `js-quantities` (574 kB) and `convert-units` (last published 2018) — all libraries, none of them
  a field. `react-unit-input`, `react-measurement-input` and `measurement-unit-input` are all
  unpublished names. People glue a converter to a hand-rolled pair of number inputs.
- **`14` in the inches box means fourteen inches.** The largest unit on screen is unbounded, and
  overflow carries upward when you leave the field — so `14 in` settles into `1 ft 2 in` instead of
  being refused at the keystroke.
- **Temperature is an offset scale, not a ratio.** °C → °F is `× 9/5 + 32`. A plain factor table —
  which is what a "units" helper is underneath — turns 100 °C into 100 °F and looks like it worked.
- **A pair of units has to divide exactly.** `['foot', 'inch']` works because a foot is twelve
  inches. `['meter', 'inch']` does not, because a metre is 39.37 of them and a segment whose
  overflow point falls mid-unit is not a segment — so it is refused, with an explanation.
- **Real spinbuttons.** Every segment is `role="spinbutton"` with a name, a value and bounds.
- **Zero runtime dependencies**, 6.6 kB brotli, no stylesheet to import.

## Basic use

```tsx
import { useState } from 'react'
import { MeasurementInput } from '@rxova/react-measurement-input'

function Profile() {
  const [height, setHeight] = useState<string | null>(null)
  return (
    <MeasurementInput
      label="Height"
      units={['foot', 'inch']}
      value={height}
      onChange={setHeight}
      max="2.2 meter"
    />
  )
}
```

`value` is `'71 inch'` or `null`. `onChange` fires when the measurement becomes complete, and when
it stops being — never with a half-typed number in between.

## The value carries its unit

`"<amount> <unit>"`, where the unit half is an `Intl` unit identifier verbatim. A bare number needs
a units contract travelling beside it, and that contract is where the bugs live — one service
stores centimetres, the next stores inches, and `71` is valid in both.

It is emitted in the **smallest unit on screen**, never converted to a base unit. One foot in metres
is `0.30479999999999996` in binary floating point, so normalising would write float noise into the
canonical value. `"12 inch"` is exact.

The consequence, stated rather than hidden: **two equal measurements are not `===` equal.**

```ts
import {
  compareMeasurements,
  convert,
  dimensionOf,
  toBaseUnit,
} from '@rxova/react-measurement-input'

'71 inch' === '1.8034 meter' // false — and they are the same height
compareMeasurements('71 inch', '1.8034 meter') // 0
toBaseUnit('71 inch') // 1.8034  (metres)
convert(5, 'foot', 'centimeter') // 152.4
dimensionOf('inch') // 'length'
```

Comparing across dimensions is a category error, not a number:
`compareMeasurements('1 meter', '1 kilogram')` is `null`, so sorting cannot silently order them.

`min` and `max` on the component already go through this, so `min="1 meter"` bounds a
feet-and-inches field correctly.

## Units

```tsx
import { MeasurementInput } from '@rxova/react-measurement-input'

function Examples() {
  return (
    <>
      {/* ['meter', 'centimeter'] is the default */}
      <MeasurementInput label="Height" units={['foot', 'inch']} />
      <MeasurementInput label="Weight" units={['stone', 'pound']} />
      <MeasurementInput label="Parcel" units={['kilogram', 'gram']} />
      <MeasurementInput label="Fuel" units={['gallon', 'fluid-ounce']} />
      <MeasurementInput label="Fever" units={['celsius']} precision={1} />
    </>
  )
}
```

Six dimensions, and every unit is an `Intl` identifier: **length** (`millimeter`, `centimeter`,
`meter`, `kilometer`, `inch`, `foot`, `yard`, `mile`, `mile-scandinavian`), **mass** (`gram`,
`kilogram`, `ounce`, `pound`, `stone`), **volume** (`milliliter`, `liter`, `gallon`,
`fluid-ounce` — US measure, which is what `Intl` means by those two), **area** (`hectare`, `acre`),
**digital** (`bit`, `byte` and the decimal-prefix multiples), **temperature** (`celsius`,
`fahrenheit`).

The largest unit on screen has **no ceiling** — in a centimetres-only field, `180` is a height and
that is exactly what someone means. Every unit below it is bounded by its ratio to the one above,
and overflow carries upward on blur.

The array is repaired rather than trusted. It is sorted largest-first and deduped, only one
dimension survives, and each adjacent pair must divide exactly:

| Written                     | Rendered           | Why                                      |
| --------------------------- | ------------------ | ---------------------------------------- |
| `['inch', 'foot']`          | `['foot', 'inch']` | Largest first, always                    |
| `['foot', 'foot']`          | `['foot']`         | Deduped                                  |
| `['meter', 'pound']`        | `['meter']`        | One dimension per field                  |
| `['meter', 'inch']`         | `['meter']`        | 39.37 is not a whole number, so no carry |
| `['celsius', 'fahrenheit']` | `['celsius']`      | A temperature is one point, not a sum    |
| `['hour', 'minute']`        | the default        | Time belongs to the duration input       |

Time units are refused on purpose and pointed at
[`@rxova/react-duration-input`](https://www.npmjs.com/package/@rxova/react-duration-input) — two
components owning the same value is worse than one component doing less. `percent` and `degree` are
refused too: they have no conversion partner in `Intl`'s list, so a _converting_ field has nothing
to do with them.

## Temperature

The one dimension with an offset instead of a ratio, and the one that goes below zero:

```tsx
<MeasurementInput label="Body temperature" units={['celsius']} precision={1} step={0.1} />
```

Single-unit by construction — `3 °C 20 °F` is two temperatures, not one — signed, and it reports no
`aria-valuemin`, because there is no floor to promise.

## Decimals

`precision` applies to the **smallest** segment only, because a fractional foot beside an inches
segment is the same number written twice. `.` and `,` are both accepted as the decimal mark, and
the fraction never grows past `precision`.

## Arrow keys clamp; they do not wrap

The time field wraps, because a clock cycles: 23:59 plus a minute is 00:00. A measurement has no
such cycle. Arrowing down from `0 cm` to `99 cm` would silently add a metre, so each segment stops
at its own ends instead.

## Keyboard

| Key                    | What it does                                                               |
| ---------------------- | -------------------------------------------------------------------------- |
| `0`–`9`                | Types into the focused segment; advances when it cannot take more          |
| `.` / `,`              | Decimal mark, on the smallest segment when `precision` is above zero       |
| `-`                    | Toggles the sign, on a temperature field                                   |
| `↑` / `↓`              | Steps by `step`, clamped at each end                                       |
| `←` / `→`              | Moves between segments                                                     |
| `Home`                 | Sets the segment to zero (nothing on a temperature, which has no floor)    |
| `End`                  | Sets the segment to its maximum (nothing on the unbounded leading segment) |
| `Backspace` / `Delete` | Empties the segment                                                        |
| `Tab`                  | Leaves the field, settling whatever is typed                               |

## Accessibility

The field is a `role="group"` containing one `role="spinbutton"` per unit. Each carries the
locale's own word as its accessible name — `feet`, not `ft` — plus `aria-valuenow` and an
`aria-valuetext` that reads as a quantity (`5 feet`, not `5`).

`aria-valuemin` and `aria-valuemax` are **omitted** wherever the bound does not exist: the leading
segment has no ceiling and a temperature has no floor. The attributes are promises about the ends.

The focused segment paints a ring by default (`2px solid Highlight`), because a
`<span role="spinbutton">` gets none from the browser. Restyle it through
`--rx-measurement-focus-ring` rather than removing it.

## Forms

`name` emits a hidden input carrying `"<amount> <unit>"`, so a native `<form>` and `FormData` work
with no wiring. `required` becomes `aria-required` on the group — a hidden input is barred from
constraint validation, so putting `required` on it would look like it was doing something.

Recipes for React Hook Form, Formik, React Final Form and TanStack Form are on the
[About page](https://rxova.org/packages/react-inputs/components/measurement/about/).

## Styling

There is no stylesheet. Set CSS custom properties on any ancestor:

```css
.field {
  --rx-measurement-gap: 0.125rem;
  --rx-measurement-segment-padding: 0 0.125rem;
  --rx-measurement-segment-radius: 0.25rem;
  --rx-measurement-suffix-opacity: 0.6;
  --rx-measurement-suffix-size: 0.8em;
  --rx-measurement-focus-ring: 2px solid #1a56db;
  --rx-measurement-focus-ring-offset: 2px;
}
```

Or target the `data-*` attributes, which are public API covered by semver:
`data-rx-measurement-root`, `data-rx-measurement-dimension` (`length` / `mass` / `volume` / `area` /
`digital` / `temperature`), `data-rx-measurement-segment` (the unit identifier),
`data-rx-measurement-value`, `data-rx-measurement-leading` and `data-rx-measurement-trailing`, plus
the shared state hooks `data-complete`, `data-out-of-range`, `data-placeholder`, `data-focused`,
`data-disabled`, `data-readonly`, `data-invalid`.

## Headless

`useMeasurementInput` is the whole state machine with no markup, for a completely custom renderer:

```tsx
import { useMeasurementInput } from '@rxova/react-measurement-input'

const field = useMeasurementInput({ units: ['foot', 'inch'], onChange: save })
// field.parts, field.value, field.amount, field.base, field.pieces, field.typeCharacter, …
```

## Diagnostics

Every rejected or coerced prop reaches `onWarn` in development, with a machine code and a message
safe to log as-is — a `value` in another dimension, a `units` pair with no whole-number ratio, a
`min` larger than the `max`, a value finer than the field can show. The entire path is stripped
from production builds.

## License

MIT
