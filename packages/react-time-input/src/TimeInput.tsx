import { forwardRef } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { AM, PM, SEGMENT_WIDTH, pad } from './time'
import type { TimeSegment } from './time'
import { useTimeInput } from './useTimeInput'
import type { TimeInputProps, TimeSegmentState } from './types'

const DEFAULT_PLACEHOLDERS: Record<TimeSegment, string> = {
  hour: 'hh',
  minute: 'mm',
  second: 'ss',
  dayPeriod: '--',
}

const DEFAULT_LABELS: Record<TimeSegment, string> = {
  hour: 'Hour',
  minute: 'Minute',
  second: 'Second',
  dayPeriod: 'AM or PM',
}

// Only layout-critical declarations are inlined. Everything visual is a CSS
// custom property or a `data-*` hook, so there is no stylesheet to import.
const rootStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--rti-gap, 0.0625rem)',
  font: 'inherit',
  whiteSpace: 'nowrap',
}

const segmentStyle: CSSProperties = {
  // Tabular figures so the field does not reflow as digits change width, which
  // otherwise makes the separators visibly jitter while typing.
  fontVariantNumeric: 'tabular-nums',
  padding: 'var(--rti-segment-padding, 0 0.0625rem)',
  borderRadius: 'var(--rti-segment-radius, 0.125rem)',
  // Neither the caret nor a text selection means anything on a spinbutton: the
  // value changes wholesale, never character by character.
  caretColor: 'transparent',
  userSelect: 'none',
  outline: 'none',
}

const literalStyle: CSSProperties = {
  userSelect: 'none',
  opacity: 'var(--rti-literal-opacity, 0.7)',
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
 * component from a build that only imports `useTimeInput`.
 */
export const TimeInput = /* @__PURE__ */ forwardRef<HTMLDivElement, TimeInputProps>(
  function TimeInput(props, ref) {
    const {
      placeholders,
      segmentLabels,
      renderSegment,
      label,
      className,
      style,
      name,
      required,
      disabled = false,
      readOnly = false,
      invalid,
      'aria-describedby': describedBy,
    } = props

    const field = useTimeInput(props)
    const {
      value,
      outOfRange,
      pieces,
      dayPeriods,
      focused,
      ids,
      segmentRefs,
      rangeFor,
      displayValue,
      setSegment,
      step,
      typeDigit,
      typeLetter,
      clearSegment,
      moveFocus,
      handleSegmentFocus,
      handleBlur,
    } = field

    // `invalid` is the caller's assertion; `outOfRange` is ours. Either one
    // marks the field, so a time outside min/max is never silently accepted.
    const isInvalid = invalid === true || outOfRange

    function onSegmentKeyDown(event: KeyboardEvent<HTMLElement>, segment: TimeSegment) {
      // Leave every modifier combination to the browser: Ctrl+ArrowLeft is a
      // word jump, Cmd+R is a reload, and a time field has no business
      // intercepting either.
      if (event.altKey || event.ctrlKey || event.metaKey) return

      const { key } = event

      if (/^\d$/.test(key)) {
        event.preventDefault()
        typeDigit(segment, key)
        return
      }

      // A letter only means something on the day period, and `typeLetter`
      // reports whether it took it — so an unrelated key still reaches the
      // browser's own type-ahead rather than being swallowed.
      if (key.length === 1 && typeLetter(segment, key)) {
        event.preventDefault()
        return
      }

      switch (key) {
        case 'ArrowUp':
          event.preventDefault()
          step(segment, 1)
          break
        case 'ArrowDown':
          event.preventDefault()
          step(segment, -1)
          break
        case 'ArrowRight':
          event.preventDefault()
          moveFocus(segment, 1)
          break
        case 'ArrowLeft':
          event.preventDefault()
          moveFocus(segment, -1)
          break
        case 'Backspace':
        case 'Delete':
          event.preventDefault()
          clearSegment(segment)
          break
        case 'Home':
        case 'End': {
          event.preventDefault()
          const { min, max } = rangeFor(segment)
          setSegment(segment, key === 'Home' ? min : max)
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
        data-rti-root=""
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
              // Hidden from the accessibility tree: the separator is decoration
              // between two named spinbuttons, and reading "colon" between them
              // adds nothing.
              <span key={`literal-${String(index)}`} aria-hidden="true" style={literalStyle}>
                {piece.text}
              </span>
            )
          }

          const segment = piece.type
          const current = displayValue(segment)
          const { min, max } = rangeFor(segment)
          const placeholder = placeholders?.[segment] ?? DEFAULT_PLACEHOLDERS[segment]
          const text =
            current === null
              ? placeholder
              : segment === 'dayPeriod'
                ? dayPeriods[current === PM ? 1 : 0]
                : pad(current, SEGMENT_WIDTH)
          const state: TimeSegmentState = {
            type: segment,
            value: current,
            text,
            focused: focused === segment,
            min,
            max,
          }

          return (
            <span
              key={segment}
              ref={(node) => {
                segmentRefs.current[segment] = node
              }}
              id={ids[segment]}
              data-rti-segment={segment}
              data-placeholder={current === null ? '' : undefined}
              data-focused={focused === segment ? '' : undefined}
              // A real spinbutton, which is what a bounded value with arrow-key
              // stepping is — including the day period, whose two states are
              // stepped exactly like a number.
              role="spinbutton"
              tabIndex={disabled ? -1 : 0}
              aria-label={segmentLabels?.[segment] ?? DEFAULT_LABELS[segment]}
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={current ?? undefined}
              // The day period reads as its word, not as 0 or 1. An empty
              // segment announces the placeholder rather than nothing at all.
              aria-valuetext={
                current === null
                  ? placeholder
                  : segment === 'dayPeriod'
                    ? dayPeriods[current === AM ? 0 : 1]
                    : String(current)
              }
              aria-disabled={disabled ? true : undefined}
              aria-readonly={readOnly ? true : undefined}
              aria-invalid={isInvalid ? true : undefined}
              style={segmentStyle}
              onKeyDown={(event) => {
                if (disabled) return
                onSegmentKeyDown(event, segment)
              }}
              onFocus={(event) => {
                handleSegmentFocus(segment, event)
              }}
            >
              {renderSegment ? renderSegment(state) : text}
            </span>
          )
        })}

        {name === undefined ? null : (
          // The 24-hour value a native form posts. Hidden rather than visually
          // hidden: it is never focusable and never announced, because the
          // spinbuttons above are the accessible representation of this value.
          //
          // No `required` here: a hidden input is barred from constraint
          // validation, so the attribute would look like it was doing something
          // and do nothing. `required` is surfaced as `aria-required` on the
          // group instead.
          <input type="hidden" id={ids.hidden} data-rti-value="" name={name} value={value ?? ''} />
        )}
      </div>
    )
  },
)
