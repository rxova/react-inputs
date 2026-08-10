---
'@rxova/react-measurement-input': minor
---

Add the measurement input: a segmented, keyboard-first field for `5 ft 11 in`, `12 st 2 lb` and
`1 m 80 cm` as a headless, zero-dependency React control, with exact unit conversion built in.

Every unit is a real `role="spinbutton"` with the locale's own word as its accessible name — `feet`,
`pieds`, `Fuß`, from `Intl.NumberFormat` — plus `aria-valuenow` and an `aria-valuetext` that reads
as a quantity rather than a bare digit. `aria-valuemin` and `aria-valuemax` are omitted wherever the
bound does not exist: the leading segment has no ceiling and a temperature has no floor, and the
attributes are promises about the ends. Every plausible package name for a measurement input is
unpublished on npm; what exists is conversion libraries — `convert` at 1 MB unpacked,
`js-quantities` at 574 kB, `convert-units` last published in 2018 — so this ships the field, not
another converter.

The largest unit on screen is deliberately unbounded, because `180` in a centimetres box is a real
height. Units below it are bounded by their ratio to the unit above and settle on blur, so `14` in
the inches of a feet-and-inches field becomes `1 ft 2 in`.

The value is `"<amount> <unit>"` — `71 inch`, never a bare number — where the unit half is an `Intl`
unit identifier verbatim. It is emitted in the smallest unit on screen rather than normalised to a
base unit, because one foot in metres is `0.30479999999999996` in binary floating point and
normalising would write float noise into the canonical value. So two equal measurements are **not**
`===` equal, and `compareMeasurements`, `toBaseUnit`, `convert`, `ratioBetween` and
`withinMeasurementRange` ship as pure, separately importable helpers that `min`/`max` already use.
Comparing across dimensions returns `null` rather than `0`, because `'1 meter'` against
`'1 kilogram'` is a category error and a silent `0` would sort them in input order and look correct.

The ~30-number conversion table is in the bundle rather than in a dependency because `Intl` has no
conversion API and these are exact legal definitions — 1 inch ≡ 25.4 mm, 1 lb ≡ 0.45359237 kg —
fixed since the 1959 international yard and pound agreement, not locale data that drifts.

Temperature is modelled as an offset scale rather than a ratio: `(°F − 32) × 5/9`, so a field that
converts between them cannot make the classic mistake of turning 100 °C into 100 °F. It is
single-unit by construction, signed, and takes `-` from the keyboard.

Two units may only share a field when the ratio between them is a whole number. `['foot', 'inch']`
works because a foot is exactly twelve inches; `['meter', 'inch']` is refused with
`units-ratio-not-integer` and rendered as a single segment, because a metre is 39.37 inches and a
segment whose overflow point falls mid-unit has no point at which it would carry.

Time units are refused and pointed at `@rxova/react-duration-input`, which speaks ISO 8601 — two
components owning the same value is worse than one doing less. `percent` and `degree` are refused
because they have no conversion partner in `Intl`'s list.

Changing `units` or `precision` at runtime converts what is on screen rather than clearing it, so a
metric/imperial toggle keeps the user's measurement — `5 ft 11 in` becomes `1 m 80 cm`. Amounts are
bounded at `Number.MAX_SAFE_INTEGER`, which is both where integer arithmetic stops being exact and
below where `String` switches to exponent notation: past either the field would emit a value its own
parser could not read back.

Hostile data and hostile callbacks are contained rather than propagated: a `units` array with an
unknown entry, a duplicate, two dimensions or the wrong order is repaired and warned about, a
`precision` outside 0–6 falls back to whole numbers, a `step` the smallest segment cannot land on
falls back to one unit of precision so the arrows can never drift off their own grid, a locale tag
`Intl` refuses falls back to the runtime's own, and `renderSegment`, `onPartsChange` and `onWarn` all
fall back to built-in behaviour when they throw. `onChange` is the deliberate exception and still
propagates — it is the consumer's state setter, and swallowing it would desync the parent while
hiding the bug.
