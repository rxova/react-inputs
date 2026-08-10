import { forwardRef } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import type { MeasurementUnit } from './units'
import { useMeasurementInput } from './useMeasurementInput'
import type { MeasurementInputProps, MeasurementSegmentState } from './types'

// Only layout-critical declarations are inlined. Everything visual is a CSS
// custom property or a `data-*` hook, so there is no stylesheet to import.
const rootStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: 'var(--rx-measurement-gap, 0.0625rem)',
  font: 'inherit',
  whiteSpace: 'nowrap',
}

const segmentStyle: CSSProperties = {
  // Tabular figures so the field does not reflow as digits change width, which
  // otherwise makes the suffixes visibly jitter while typing.
  fontVariantNumeric: 'tabular-nums',
  padding: 'var(--rx-measurement-segment-padding, 0 0.0625rem)',
  borderRadius: 'var(--rx-measurement-segment-radius, 0.125rem)',
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
  outline: 'var(--rx-measurement-focus-ring, 2px solid Highlight)',
  outlineOffset: 'var(--rx-measurement-focus-ring-offset, 1px)',
}

const literalStyle: CSSProperties = {
  userSelect: 'none',
  opacity: 'var(--rx-measurement-suffix-opacity, 0.7)',
  fontSize: 'var(--rx-measurement-suffix-size, 0.875em)',
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
  renderSegment: MeasurementInputProps['renderSegment'],
  state: MeasurementSegmentState,
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
 * component from a build that only imports `useMeasurementInput`.
 */
export const MeasurementInput = /* @__PURE__ */ forwardRef<HTMLDivElement, MeasurementInputProps>(
  function MeasurementInput(props, ref) {
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

    const field = useMeasurementInput(props)
    const {
      value,
      outOfRange,
      pieces,
      units,
      precision,
      focused,
      ids,
      idFor,
      parts,
      segmentRefs,
      rangeFor,
      nameFor,
      textFor,
      setSegment,
      step,
      typeCharacter,
      clearSegment,
      moveFocus,
      handleSegmentFocus,
      handleBlur,
    } = field

    // `invalid` is the caller's assertion; `outOfRange` is ours. Either one marks
    // the field, so a measurement outside min/max is never silently accepted.
    const isInvalid = invalid === true || outOfRange

    function onSegmentKeyDown(event: KeyboardEvent<HTMLElement>, unit: MeasurementUnit) {
      // Leave every modifier combination to the browser: Ctrl+ArrowLeft is a word
      // jump, Cmd+R is a reload, and a measurement field has no business
      // intercepting either.
      if (event.altKey || event.ctrlKey || event.metaKey) return

      const { key } = event

      // Digits, the two decimal marks and the minus sign all go to the same
      // place; `typeCharacter` decides which of them this segment can accept.
      if (/^[\d.,-]$/.test(key)) {
        event.preventDefault()
        typeCharacter(unit, key)
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
        case 'Home': {
          event.preventDefault()
          const { min } = rangeFor(unit)
          // A temperature field has no floor, so Home has nothing to land on.
          if (Number.isFinite(min)) setSegment(unit, min)
          break
        }
        case 'End': {
          event.preventDefault()
          const { max } = rangeFor(unit)
          // The leading segment has no maximum, so End has nothing to land on.
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
        data-rx-measurement-root=""
        data-rx-measurement-dimension={field.dimension ?? undefined}
        data-disabled={disabled ? '' : undefined}
        data-readonly={readOnly ? '' : undefined}
        data-invalid={isInvalid ? '' : undefined}
        data-out-of-range={outOfRange ? '' : undefined}
        data-complete={value !== null ? '' : undefined}
        // A group, not a single control: it contains several separately focusable
        // spinbuttons, and announcing it as one field would leave a screen-reader
        // user with no way to know which part they are on.
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
              // segment's own accessible name, and reading "ft" after "5" when
              // the spinbutton is already called "feet" is noise.
              <span key={`literal-${String(index)}`} aria-hidden="true" style={literalStyle}>
                {piece.text}
              </span>
            )
          }

          const unit = piece.type
          const current = parts[unit] ?? null
          const { min, max } = rangeFor(unit)
          const leading = units[0] === unit
          const trailing = units[units.length - 1] === unit
          const placeholder = placeholders?.[unit]
          const text = textFor(unit, placeholder)
          const unitName = unitLabels?.[unit] ?? nameFor(unit)
          const state: MeasurementSegmentState = {
            type: unit,
            value: current,
            text,
            focused: focused === unit,
            leading,
            trailing,
            min,
            max,
            precision: trailing ? precision : 0,
          }

          return (
            <span
              key={unit}
              ref={(node) => {
                segmentRefs.current[unit] = node
              }}
              id={idFor(unit)}
              data-rx-measurement-segment={unit}
              data-rx-measurement-leading={leading ? '' : undefined}
              data-rx-measurement-trailing={trailing ? '' : undefined}
              data-placeholder={current === null ? '' : undefined}
              data-focused={focused === unit ? '' : undefined}
              // A real spinbutton, which is what a bounded value with arrow-key
              // stepping is.
              role="spinbutton"
              tabIndex={disabled ? -1 : 0}
              aria-label={unitName}
              // Omitted rather than set to a number wherever the bound does not
              // exist: `aria-valuemin` / `aria-valuemax` are promises about the
              // ends, and the leading segment has no ceiling while a temperature
              // has no floor. `Infinity` is not a valid attribute value either.
              aria-valuemin={Number.isFinite(min) ? min : undefined}
              aria-valuemax={Number.isFinite(max) ? max : undefined}
              aria-valuenow={current ?? undefined}
              // An empty segment announces the placeholder rather than nothing at
              // all; a filled one announces the number with its unit, so
              // "5 feet" reads as a quantity instead of a bare "5".
              aria-valuetext={current === null ? text : `${text} ${unitName.toLowerCase()}`}
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
          // The `"<amount> <unit>"` string a native form posts. Hidden rather
          // than visually hidden: it is never focusable and never announced,
          // because the spinbuttons above are the accessible representation of
          // this value.
          //
          // No `required` here: a hidden input is barred from constraint
          // validation, so the attribute would look like it was doing something
          // and do nothing. `required` is surfaced as `aria-required` on the
          // group instead.
          <input
            type="hidden"
            id={ids.hidden}
            data-rx-measurement-value=""
            name={name}
            value={value ?? ''}
          />
        )}
      </div>
    )
  },
)
