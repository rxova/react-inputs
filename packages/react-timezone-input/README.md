<p align="center">
  <img src="./assets/logo.svg" alt="@rxova/react-timezone-input logo" width="180" />
</p>

<h1 align="center">@rxova/react-timezone-input</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@rxova/react-timezone-input"><img src="https://img.shields.io/npm/v/@rxova/react-timezone-input?color=cb3837&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://github.com/rxova/react-inputs/actions/workflows/ci.yml"><img src="https://github.com/rxova/react-inputs/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/brotli-%E2%89%A4%203.25%20kB-f5a623" alt="Brotli size at most 3.25 kB" />
  <img src="https://img.shields.io/badge/coverage%20threshold-95%25-brightgreen" alt="Coverage threshold: 95% per file" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict mode" />
  <img src="https://img.shields.io/badge/dependencies-0-44cc11" alt="Zero runtime dependencies" />
  <img src="https://img.shields.io/badge/React-%E2%89%A518-61dafb?logo=react&logoColor=white" alt="React 18 or newer" />
  <a href="https://github.com/rxova/react-inputs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

**A time zone picker with no timezone data blob.** 418 zones, localised names and
live DST offsets, all from `Intl`. Headless, zero-dependency.

```bash
npm install @rxova/react-timezone-input
```

📖 **[Documentation & live examples →](https://rxova.org/packages/react-inputs/components/timezone/introduction/)** — guides, form recipes, theming, and the full zone reference.

- **No tz database in your bundle.** The popular alternative depends on
  `spacetime` **and** `timezone-soft` to carry a copy of the tz data. That copy is
  wrong the moment a government moves its DST rules, and a package update is the
  only fix. `Intl` ships the same data, maintained by the engine's ICU. **2.96 kB
  brotli, zero dependencies.**
- **The offsets are live.** `America/New_York` reports `-05:00` in January and
  `-04:00` in July because the engine is asked at an instant, not because a table
  was consulted. Half-hour and 45-minute offsets (`+05:45` Kathmandu, `+12:45`
  Chatham) come out right for the same reason.
- **UTC is on the list.** `Intl.supportedValuesOf('timeZone')` does **not**
  contain `UTC`, and nothing in it stands in for `UTC` — so a picker built
  straight off that array cannot select the most commonly stored zone in the
  world. This one adds it, first.
- **Your database's spelling works.** The tz database renames zones, and which
  spelling an engine lists depends on its ICU build. `Europe/Kyiv` selects the
  entry a browser calls `Europe/Kiev`, and the other way round.
- **A real `<select>`.** On a phone that is the platform's own picker; on a
  desktop it brings type-ahead, the full ARIA contract and form semantics that no
  custom listbox of 419 options matches.

## Basic use

```tsx
import { useState } from 'react'
import { TimezoneInput } from '@rxova/react-timezone-input'

function Profile() {
  const [zone, setZone] = useState<string | null>(null)
  return <TimezoneInput label="Time zone" value={zone} onChange={setZone} />
}
```

`value` is an IANA id — `'Europe/Madrid'` — or `null`.

## The value is an id, never an offset

`Intl` will accept `+02:00` as a time zone. This field will not, and that is
deliberate: an offset cannot express a daylight-saving change, so `+02:00` is
Madrid in summer and wrong in winter. Store the id and derive the offset:

```ts
import { zoneOffsetMinutes, zoneOffsetLabel, zonePhase } from '@rxova/react-timezone-input'

zoneOffsetLabel('America/New_York', new Date('2026-01-15')) // '-05:00'
zoneOffsetLabel('America/New_York', new Date('2026-07-15')) // '-04:00'
zoneOffsetMinutes('Asia/Kathmandu') // 345
zonePhase('America/New_York', 'en', new Date('2026-07-15')) // 'Eastern Daylight Time'
```

Passing an offset gets you a `value-offset-not-zone` warning and an empty field
rather than a value that is right half the year.

## Renamed zones

The tz database renamed `Asia/Calcutta` to `Asia/Kolkata` and `Europe/Kiev` to
`Europe/Kyiv`, keeping the old names working as links. Which one an engine
_lists_ depends on its ICU build — but Postgres, `java.time.ZoneId` and Python's
`zoneinfo` will hand you the modern name regardless.

So a naive `list.includes(value)` shows nothing selected for a perfectly good
stored value, and which way it breaks changes with the browser. This field
resolves through `Intl`'s own canonicalisation, so both spellings select the same
option:

```ts
import { resolveZone } from '@rxova/react-timezone-input'

resolveZone('Europe/Kyiv') // the id this engine lists, whichever that is
resolveZone('US/Eastern') // 'America/New_York'
resolveZone('+02:00') // null — an offset is not a zone
```

## Offsets are a fact about an instant

Sydney is `+11:00` in January and `+10:00` in July. A picker that labels an
option `+11:00` without saying _when_ is wrong for half the year, so pass the
date your form is about:

```tsx
<TimezoneInput label="Event time zone" referenceDate={eventDate} />
```

It defaults to the moment the field mounts, captured **once** — not `new Date()`
per render, which would differ between server and client and would silently
relabel every option when a DST boundary passed with the page open.

## Narrowing the list

```tsx
<TimezoneInput label="Office" zones={['Europe/Madrid', 'America/New_York', 'Asia/Tokyo']} />
```

Unusable ids are dropped with a warning. `UTC` stays available regardless.

## Keyboard

It is a native `<select>`, so the keyboard contract is the platform's rather than
this package's — which is the point. Typing jumps by **city**, because each
option leads with it:

| Key               | What it does                                   |
| ----------------- | ---------------------------------------------- |
| letters           | Type-ahead to a city — `mad` reaches Madrid    |
| `↑` / `↓`         | Moves the selection                            |
| `Home` / `End`    | Jumps to the ends of the list                  |
| `Tab`             | Leaves the field                               |
| `Space` / `Enter` | Opens the picker, where the platform does that |

## Accessibility

A `<select>` already is a listbox: it has the role, the announced value, the
grouping semantics through `<optgroup>`, and the platform picker on touch. This
package adds a name, `aria-invalid`, `aria-describedby` and nothing else — there
is no `role="listbox"` reimplementation to get subtly wrong.

## Forms

`name` names the select, so a native `<form>` and `FormData` post the id with no
wiring and no hidden input. A field with nothing chosen always offers an empty
option, so the select can never paint a zone the component does not hold.

## Styling

There is no stylesheet. Set CSS custom properties on any ancestor:

```css
.field {
  --rx-timezone-gap: 0.5rem;
  --rx-timezone-select-width: 24rem;
  --rx-timezone-select-padding: 0.375rem 0.5rem;
  --rx-timezone-select-radius: 0.375rem;
}
```

Or target the `data-*` attributes, which are public API covered by semver:
`data-rx-timezone-root`, `data-rx-timezone-select`, `data-rx-timezone-unlisted`,
plus the shared state hooks `data-complete`, `data-disabled` and `data-invalid`.

## Headless

`useTimezoneInput` is the whole state machine with no markup, for the searchable
combobox this package deliberately does not ship:

```tsx
import { useTimezoneInput } from '@rxova/react-timezone-input'

const field = useTimezoneInput({ value: zone, onChange: setZone })
// field.options, field.groups, field.resolved, field.offset, field.local, …
```

## Diagnostics

Every rejected or coerced prop reaches `onWarn` in development with a machine
code and a message safe to log as-is — an offset where a zone belongs, an
`Etc/GMT+5` whose sign runs backwards, a `zones` entry the engine does not know,
an `Invalid Date`. The entire path is stripped from production builds.

## License

MIT
