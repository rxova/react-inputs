<p align="center">
  <img src="./assets/logo.svg" alt="@rxova/react-rating-input logo" width="180" />
</p>

<h1 align="center">@rxova/react-rating-input</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@rxova/react-rating-input"><img src="https://img.shields.io/npm/v/@rxova/react-rating-input?color=cb3837&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://github.com/rxova/react-inputs/actions/workflows/ci.yml"><img src="https://github.com/rxova/react-inputs/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/brotli-%E2%89%A4%203%20kB-f5a623" alt="Brotli size at most 3 kB" />
  <img src="https://img.shields.io/badge/coverage%20threshold-95%25-brightgreen" alt="Coverage threshold: 95% per file" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict mode" />
  <img src="https://img.shields.io/badge/dependencies-0-44cc11" alt="Zero runtime dependencies" />
  <img src="https://img.shields.io/badge/React-%E2%89%A518-61dafb?logo=react&logoColor=white" alt="React 18 or newer" />
  <a href="https://github.com/rxova/react-inputs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

**Any icon, any precision, accessible.** A headless, zero-dependency React rating component.

```bash
npm install @rxova/react-rating-input
```

📖 **[Documentation & live examples →](https://rxova.org/packages/react-inputs/components/rating/introduction/)** — guides,
form recipes, theming, and migration from `react-rating` / `react-stars`.

- **Bring your own icon** — SVG, emoji, image, arbitrary JSX
- **Any precision** — continuous `4.3`, halves, tenths, or whole stars, with the rounding
  direction you choose
- **Accessible** — native radios in a radiogroup when interactive, `role="img"` when not
- **Zero runtime dependencies**, ~2.8 kB brotli, no stylesheet to import
- **Form-ready** — first-class React Hook Form / Formik / React Final Form / TanStack Form integration

## Display

```tsx
import { Rating } from '@rxova/react-rating-input'

function Scores() {
  return (
    <>
      <Rating value={4.3} /> {/* continuous — a 30%-filled fifth star */}
      <Rating value={4.3} precision={1} /> {/* 4 stars */}
      <Rating value={4.3} precision={0.5} /> {/* 4.5 stars */}
      <Rating value={4.3} icon="⭐" /> {/* emoji */}
      <Rating value={3} max={10} icon={<Heart />} emptyIcon={<HeartOutline />} />
    </>
  )
}
```

| `value={4.3}`                                                              | `precision={1}`                                                     | `precision={0.5}`                                                    | `icon="⭐"`                                                       | custom `<Heart/>`                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| <img src="./assets/examples/continuous.png" width="150" alt="4.3 stars" /> | <img src="./assets/examples/whole.png" width="150" alt="4 stars" /> | <img src="./assets/examples/half.png" width="150" alt="4.5 stars" /> | <img src="./assets/examples/emoji.png" width="150" alt="emoji" /> | <img src="./assets/examples/hearts.png" width="150" alt="hearts" /> |

## Rounding

Two orthogonal props: `precision` is the grid, `rounding` is the direction.

| Intent                       | `precision` | `rounding`  | `4.3` → | `4.7` → |
| ---------------------------- | ----------- | ----------- | ------- | ------- |
| Exact / continuous (default) | `0`         | `'none'`    | `4.3`   | `4.7`   |
| Round to whole               | `1`         | `'nearest'` | `4`     | `5`     |
| Floor / truncate             | `1`         | `'down'`    | `4`     | `4`     |
| Ceil                         | `1`         | `'up'`      | `5`     | `5`     |
| Half stars                   | `0.5`       | `'nearest'` | `4.5`   | `4.5`   |
| Half stars, never inflate    | `0.5`       | `'down'`    | `4`     | `4.5`   |
| Tenths                       | `0.1`       | `'nearest'` | `4.3`   | `4.7`   |

Snapping is **display-only**. A `value` of `4.28` shown as whole stars renders `4` but is never
rounded back into your state. Out-of-range, `NaN` and `Infinity` clamp to `[0, max]` rather than
throwing — a display component must never crash a page over a data value.

## Interactive

Providing `onChange` makes it an input. Nothing else changes.

```tsx
import { useState } from 'react'
import { Rating } from '@rxova/react-rating-input'

function RateYourMeal() {
  const [score, setScore] = useState(0)
  return <Rating value={score} onChange={setScore} precision={0.5} label="Rate your meal" />
}
```

Renders a `radiogroup` of visually-hidden native radios, so arrow keys, form participation,
focus-visible and screen-reader announcements all come from the platform rather than from
hand-rolled JavaScript.

<img src="./assets/examples/interactive-half.gif" width="240" alt="Hovering and clicking a half-star rating" />
&nbsp;
<img src="./assets/examples/interactive-keyboard.gif" width="240" alt="Selecting a rating with the keyboard, then clearing it" />

> Interactive mode requires `precision >= 0.5`. A radiogroup offers discrete options, so continuous
> _input_ has no steps to select; continuous _display_ works at any precision.

## Forms

`onChange` emits a **`number`, not an event**, so `{...register('rating')}` will not work. Every
library below has a controlled adapter — that is the supported path, and it is one line longer.

<details>
<summary><b>React Hook Form</b></summary>

```tsx
<Controller
  name="rating"
  control={control}
  rules={{ min: { value: 1, message: 'Please rate' } }}
  render={({ field, fieldState }) => (
    <>
      <Rating
        {...field} // value, onChange, onBlur, name, ref all line up
        precision={0.5}
        invalid={fieldState.invalid}
        aria-describedby={fieldState.error ? 'rating-err' : undefined}
      />
      {fieldState.error && <p id="rating-err">{fieldState.error.message}</p>}
    </>
  )}
/>
```

</details>

<details>
<summary><b>Formik</b></summary>

```tsx
function RatingField() {
  const [field, meta, helpers] = useField('rating')

  return (
    <Rating
      name="rating"
      value={field.value}
      onChange={helpers.setValue}
      onBlur={field.onBlur}
      invalid={meta.touched && !!meta.error}
    />
  )
}
```

</details>

<details>
<summary><b>React Final Form</b></summary>

```tsx
<Field name="rating">
  {({ input, meta }) => (
    <Rating
      value={typeof input.value === 'number' ? input.value : 0} // RFF uses '' when empty
      onChange={input.onChange}
      onBlur={input.onBlur}
      invalid={meta.touched && !!meta.error}
    />
  )}
</Field>
```

</details>

<details>
<summary><b>TanStack Form</b></summary>

```tsx
<form.Field
  name="rating"
  validators={{ onChange: ({ value }) => (value < 1 ? 'Please rate' : undefined) }}
>
  {(field) => (
    <Rating
      name="rating"
      value={field.state.value}
      onChange={field.handleChange} // handleChange takes the number directly
      onBlur={field.handleBlur}
      invalid={!field.state.meta.isValid}
    />
  )}
</form.Field>
```

</details>

`onBlur` fires only when focus leaves the **whole group**, never when arrowing between icons —
so validation doesn't fire while the user is still choosing.

With a plain `<form>`, just pass `name` and the value posts natively.

## Styling

No stylesheet to import. Only layout-critical CSS is inlined; everything visual is a custom property
or a `data-*` hook.

| Property                        | Default                         | Applies to                       |
| ------------------------------- | ------------------------------- | -------------------------------- |
| `--rx-rating-size`              | `1.25rem`                       | Icon size                        |
| `--rx-rating-gap`               | `0.125rem`                      | Space between icons              |
| `--rx-rating-color-filled`      | `#f5a623`                       | Filled portion                   |
| `--rx-rating-color-empty`       | `#d8d8d8`                       | Track                            |
| `--rx-rating-color-hover`       | `var(--rx-rating-color-filled)` | Hover/keyboard preview           |
| `--rx-rating-empty-filter`      | `grayscale(1) opacity(0.35)`    | Dims the empty layer — see Emoji |
| `--rx-rating-transition`        | `120ms`                         | Fill transitions                 |
| `--rx-rating-focus-ring`        | `2px solid Highlight`           | Ring on the focused icon         |
| `--rx-rating-focus-ring-offset` | `2px`                           | Its offset                       |
| `--rx-rating-focus-ring-radius` | `2px`                           | Its corner radius                |

### `data-*` attributes

These are **public API**, covered by semver.

| Attribute                                          | On      | Meaning                        |
| -------------------------------------------------- | ------- | ------------------------------ |
| `data-rx-rating-root`                              | wrapper | Always present                 |
| `data-rx-rating-item`                              | icon    | The icon's index               |
| `data-rx-rating-layer`                             | layer   | `fill` or `empty`              |
| `data-state`                                       | icon    | `full`, `partial` or `empty`   |
| `data-fill`                                        | icon    | Fraction filled, `0`–`1`       |
| `data-active`                                      | icon    | Under the pointer or keyboard  |
| `data-idx`                                         | icon    | Index, for nth-style selectors |
| `data-invalid` / `data-disabled` / `data-readonly` | wrapper | Mirrors the props              |

## Keyboard

Interactive ratings are a real `radiogroup` of real radios, so this comes from the browser rather
than from JavaScript:

| Key                  | Effect                                            |
| -------------------- | ------------------------------------------------- |
| `←` / `→`, `↑` / `↓` | Move between values, wrapping at the ends         |
| `Home` / `End`       | First or last value                               |
| `Space`              | Select the focused value                          |
| `Tab`                | Leave the group — one tab stop, whatever `max` is |

### Emoji

Emoji work anywhere an icon does, with one caveat worth knowing: they render from a colour font,
so `--rx-rating-color-filled` has **no effect** on them. That is why the implicit empty layer is dimmed
with `--rx-rating-empty-filter` (a `grayscale`/`opacity` filter) rather than with colour — filters work
on emoji and SVG alike. Pass an explicit `emptyIcon` and no filter is applied.

## Props

See [`src/types.ts`](./src/types.ts) for the full annotated interface — every prop carries a
TSDoc comment explaining what it does and why it exists.

## Resilient input

Out-of-range props never break the component — they are coerced to the nearest sensible value so
it always renders something valid:

| Input                          | Coerced to         |
| ------------------------------ | ------------------ |
| `value` above `max`            | `max`              |
| Negative `value`               | `0`                |
| `NaN` / `±Infinity` `value`    | `0`                |
| `max` below `1`, or non-finite | `5`                |
| Non-integer `max` (e.g. `4.7`) | `Math.floor` (`4`) |

Because that coercion is silent, a bug like `value={7}` on a 5-star widget would otherwise pass
unnoticed. In development the component surfaces each coercion; pass `onWarn` to route them into
your own logging, or leave it off for a `console.warn`:

```tsx
<Rating
  value={score}
  max={5}
  onWarn={(w) => {
    // w: { code, prop, received, used, message }
    if (w.code === 'value-above-max') reportToTelemetry(w)
  }}
/>
```

`onWarn` fires once per distinct problem, and the whole path — handler included — is stripped from
production builds, so it costs nothing there and the value is still clamped either way. Codes are
stable and safe to `switch` on: see `RatingWarning` / `RatingWarningCode` in
[`src/types.ts`](./src/types.ts).

## Headless

`useRating` exposes the state machine — value, hover preview, focus, group blur, fills and steps
— if you want to render the whole thing yourself. ~1.2 kB on its own.

## Accessibility

| Mode        | Semantics                                                         |
| ----------- | ----------------------------------------------------------------- |
| Read-only   | `role="img"` with an `aria-label`; icons hidden; not a tab stop   |
| Interactive | `role="radiogroup"` of native radios; one tab stop; arrow-key nav |

Also handled: visible focus ring that the fill layer's `overflow: hidden` cannot clip,
`prefers-reduced-motion`, RTL (the fill origin flips via CSS logical properties), and
`aria-invalid` / `aria-describedby` wiring for form errors.

**Known limitation:** at `precision={0.5}` each half-star target is narrower than the WCAG 2.2
§2.5.8 24×24 px minimum. That is inherent to half-star input. Use `precision={1}` or a larger
`--rx-rating-size` where that matters.

## UI-library recipes

The docs contain maintained examples for shadcn/ui, Radix Themes, Material UI, Chakra UI, Mantine
and Ant Design. Copy a ready-labelled wrapper with:

```bash
npx shadcn@latest add https://rxova.org/packages/react-inputs/r/rating-field.json
```

[Open the recipes](https://rxova.org/packages/react-inputs/components/rating/about/#ui-library-recipes).

## Part of rxova

Part of the [rxova headless React inputs](https://rxova.org/packages/react-inputs/overview) suite —
install the whole set from
[`@rxova/react-inputs`](https://www.npmjs.com/package/@rxova/react-inputs), or read the full
generated [API reference](https://rxova.org/packages/react-inputs/components/rating/api) for this
package.

Migrating from `react-rating`, `react-stars` or plain radio buttons? The
[migration guide](https://rxova.org/packages/react-inputs/components/rating/migrating/) has a
section for each.

## License

[MIT](https://github.com/rxova/react-inputs/blob/main/LICENSE) © rxova
