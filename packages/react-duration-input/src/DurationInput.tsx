import { forwardRef } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { pad } from './duration'
import type { DurationUnit } from './duration'
import { useDurationInput } from './useDurationInput'
import type { DurationInputProps, DurationSegmentState } from './types'

const DEFAULT_PLACEHOLDERS: Record<DurationUnit, string> = {
  day: 'dd',
  hour: 'hh',
  minute: 'mm',
  second: 'ss',
}

// Only layout-critical declarations are inlined. Everything visual is a CSS
// custom property or a `data-*` hook, so there is no stylesheet to import.
const rootStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: 'var(--rx-duration-gap, 0.0625rem)',
  font: 'inherit',
  whiteSpace: 'nowrap',
}

const segmentStyle: CSSProperties = {
  // Tabular figures so the field does not reflow as digits change width, which
  // otherwise makes the suffixes visibly jitter while typing.
  fontVariantNumeric: 'tabular-nums',
  padding: 'var(--rx-duration-segment-padding, 0 0.0625rem)',
  borderRadius: 'var(--rx-duration-segment-radius, 0.125rem)',
  // Neither the caret nor a text selection means anything on a spinbutton: the
  // value changes wholesale, never character by character.
  caretColor: 'transparent',
  userSelect: 'none',
  outline: 'none',
}

/**
 * The focused segment's ring.
 *
 * `outline: none` above removes the UA ring, and a `<span role="spinbutton">`
 * gets nothing else for free — so without this a keyboard user cannot see which
 * segment they are on, which is WCAG 2.4.7 Focus Visible with no mitigation.
 * Shipped as a custom property with a system-colour default so a theme restyles
 * the ring rather than losing it.
 */
const focusedSegmentStyle: CSSProperties = {
  outline: 'var(--rx-duration-focus-ring, 2px solid Highlight)',
  outlineOffset: 'var(--rx-duration-focus-ring-offset, 1px)',
}

const literalStyle: CSSProperties = {
  userSelect: 'none',
  opacity: 'var(--rx-duration-suffix-opacity, 0.7)',
  fontSize: 'var(--rx-duration-suffix-size, 0.875em)',
}

/**
 * Run a consumer's `renderSegment`, falling back to the built-in text.
 *
 * Two failures matter and neither is hypothetical. A formatter that throws runs
 * inside render, so without this one bad consumer function blanks the whole
 * page. A formatter that returns `undefined`, `null` or `''` is quieter and
 * worse: the segment renders as an empty spinbutton — no visible value, and
 * `aria-valuetext` describing a number nobody can see.
 */
function renderText(
  renderSegment: DurationInputProps['renderSegment'],
  state: DurationSegmentState,
): ReactNode {
  if (!renderSegment) return state.text
  let custom: ReactNode
  try {
    custom = renderSegment(state)
  } catch {
    return state.text
  }
  return custom === undefined || custom === null || custom === '' ? state.text : custom
}

/**
 * `forwardRef` rather than reading `props.ref`.
 *
 * React 19 passes `ref` as an ordinary prop, so `props.ref` works there — but
 * React 18 strips it before props are built, so the ref would silently never
 * populate. We declare `react >= 18` as a peer, so the version that needs
 * forwardRef is the one that decides.
 *
 * The `@__PURE__` annotation is load-bearing: `forwardRef(...)` is a top-level
 * call, and without it bundlers must assume side effects and cannot drop this
 * component from a build that only imports `useDurationInput`.
 */
export const DurationInput = /* @__PURE__ */ forwardRef<HTMLDivElement, DurationInputProps>(
  function DurationInput(props, ref) {
    const {
      placeholders,
      unitLabels,
      renderSegment,
      label,
      className,
      style,
      name,
      required,
      disabled = false,
      readOnly = false,
      invalid,
      dir,
      'aria-describedby': describedBy,
    } = props

    const field = useDurationInput(props)
    const {
      value,
      outOfRange,
      pieces,
      units,
      focused,
      ids,
      parts,
      segmentRefs,
      rangeFor,
      nameFor,
      setSegment,
      step,
      typeDigit,
      clearSegment,
      moveFocus,
      handleSegmentFocus,
      handleBlur,
    } = field

    // `invalid` is the caller's assertion; `outOfRange` is ours. Either one
    // marks the field, so a duration outside min/max is never silently accepted.
    const isInvalid = invalid === true || outOfRange

    function onSegmentKeyDown(event: KeyboardEvent<HTMLElement>, unit: DurationUnit) {
      // Leave every modifier combination to the browser: Ctrl+ArrowLeft is a
      // word jump, Cmd+R is a reload, and a duration field has no business
      // intercepting either.
      if (event.altKey || event.ctrlKey || event.metaKey) return

      const { key } = event

      if (/^\d$/.test(key)) {
        event.preventDefault()
        typeDigit(unit, key)
        return
      }

      switch (key) {
        case 'ArrowUp':
          event.preventDefault()
          step(unit, 1)
          break
        case 'ArrowDown':
          event.preventDefault()
          step(unit, -1)
          break
        case 'ArrowRight':
          event.preventDefault()
          moveFocus(unit, 1)
          break
        case 'ArrowLeft':
          event.preventDefault()
          moveFocus(unit, -1)
          break
        case 'Backspace':
        case 'Delete':
          event.preventDefault()
          clearSegment(unit)
          break
        case 'Home':
          event.preventDefault()
          setSegment(unit, rangeFor(unit).min)
          break
        case 'End': {
          event.preventDefault()
          const { max } = rangeFor(unit)
          // The leading unit has no maximum, so End has nothing to land on.
          // Left alone rather than jumping to an arbitrary large number.
          if (Number.isFinite(max)) setSegment(unit, max)
          break
        }
        default:
          // Tab, Escape, F-keys and everything else stay with the browser.
          break
      }
    }

    return (
      <div
        ref={ref}
        className={className}
        style={{ ...rootStyle, ...style }}
        dir={dir}
        data-rx-duration-root=""
        data-disabled={disabled ? '' : undefined}
        data-readonly={readOnly ? '' : undefined}
        data-invalid={isInvalid ? '' : undefined}
        data-out-of-range={outOfRange ? '' : undefined}
        data-complete={value !== null ? '' : undefined}
        // A group, not a single control: it contains several separately
        // focusable spinbuttons, and announcing it as one field would leave a
        // screen-reader user with no way to know which part they are on.
        role="group"
        aria-label={typeof label === 'string' ? label : undefined}
        aria-labelledby={typeof label === 'string' || label === undefined ? undefined : ids.group}
        aria-describedby={describedBy}
        aria-disabled={disabled ? true : undefined}
        aria-required={required ? true : undefined}
        onBlur={handleBlur}
      >
        {label !== undefined && typeof label !== 'string' ? (
          <span id={ids.group} style={{ display: 'none' }}>
            {label}
          </span>
        ) : null}

        {pieces.map((piece, index) => {
          if (piece.kind === 'literal') {
            return (
              // Hidden from the accessibility tree: the suffix duplicates the
              // segment's own accessible name, and reading "h" after "2" when
              // the spinbutton is already called "hours" is noise.
              <span key={`literal-${String(index)}`} aria-hidden="true" style={literalStyle}>
                {piece.text}
              </span>
            )
          }

          const unit = piece.type
          const current = parts[unit]
          const { min, max } = rangeFor(unit)
          const leading = units[0] === unit
          const placeholder = placeholders?.[unit] ?? DEFAULT_PLACEHOLDERS[unit]
          // The leading unit is not zero-padded: it can be three digits wide,
          // and `090m` reads as a mistake. Every unit below it is padded to two,
          // so `1h 5m` renders as `1h 05m` and the field stops shifting sideways.
          const text = current === null ? placeholder : leading ? String(current) : pad(current, 2)
          const accessibleName = unitLabels?.[unit] ?? nameFor(unit)
          const state: DurationSegmentState = {
            type: unit,
            value: current,
            text,
            focused: focused === unit,
            leading,
            min,
            max,
          }

          return (
            <span
              key={unit}
              ref={(node) => {
                segmentRefs.current[unit] = node
              }}
              id={ids[unit]}
              data-rx-duration-segment={unit}
              data-rx-duration-leading={leading ? '' : undefined}
              data-placeholder={current === null ? '' : undefined}
              data-focused={focused === unit ? '' : undefined}
              // A real spinbutton, which is what a bounded value with arrow-key
              // stepping is.
              role="spinbutton"
              tabIndex={disabled ? -1 : 0}
              aria-label={accessibleName}
              aria-valuemin={min}
              // Omitted on the leading unit rather than set to a number:
              // `aria-valuemax` is a promise about the ceiling, and there is
              // none. `Infinity` is not a valid attribute value either way.
              aria-valuemax={Number.isFinite(max) ? max : undefined}
              aria-valuenow={current ?? undefined}
              // An empty segment announces the placeholder rather than nothing
              // at all; a filled one announces the number with its unit, so
              // "2 hours" reads as a quantity instead of a bare "2".
              aria-valuetext={
                current === null
                  ? placeholder
                  : `${String(current)} ${accessibleName.toLowerCase()}`
              }
              aria-disabled={disabled ? true : undefined}
              aria-readonly={readOnly ? true : undefined}
              aria-invalid={isInvalid ? true : undefined}
              style={focused === unit ? { ...segmentStyle, ...focusedSegmentStyle } : segmentStyle}
              onKeyDown={(event) => {
                if (disabled) return
                onSegmentKeyDown(event, unit)
              }}
              onFocus={(event) => {
                handleSegmentFocus(unit, event)
              }}
            >
              {renderText(renderSegment, state)}
            </span>
          )
        })}

        {name === undefined ? null : (
          // The ISO 8601 duration a native form posts. Hidden rather than
          // visually hidden: it is never focusable and never announced, because
          // the spinbuttons above are the accessible representation of this
          // value.
          //
          // No `required` here: a hidden input is barred from constraint
          // validation, so the attribute would look like it was doing something
          // and do nothing. `required` is surfaced as `aria-required` on the
          // group instead.
          <input
            type="hidden"
            id={ids.hidden}
            data-rx-duration-value=""
            name={name}
            value={value ?? ''}
          />
        )}
      </div>
    )
  },
)
