import { forwardRef } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { pad, segmentWidth } from './date'
import type { DateSegment } from './date'
import { useDateInput } from './useDateInput'
import type { DateInputProps, DateSegmentState } from './types'

const DEFAULT_PLACEHOLDERS: Record<DateSegment, string> = {
  day: 'dd',
  month: 'mm',
  year: 'yyyy',
}

const DEFAULT_LABELS: Record<DateSegment, string> = {
  day: 'Day',
  month: 'Month',
  year: 'Year',
}

// Only layout-critical declarations are inlined. Everything visual is a CSS
// custom property or a `data-*` hook, so there is no stylesheet to import.
const rootStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--rx-date-gap, 0.0625rem)',
  font: 'inherit',
  // Segments are rendered right-to-left-safe by leaning on the locale's own
  // part order rather than on writing direction, but the box still has to lay
  // out in the document's direction.
  whiteSpace: 'nowrap',
}

const segmentStyle: CSSProperties = {
  // Tabular figures so the field does not reflow as digits change width, which
  // otherwise makes the separators visibly jitter while typing.
  fontVariantNumeric: 'tabular-nums',
  padding: 'var(--rx-date-segment-padding, 0 0.0625rem)',
  borderRadius: 'var(--rx-date-segment-radius, 0.125rem)',
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
 * of the three segments they are on, which is WCAG 2.4.7 Focus Visible with no
 * mitigation. Shipped as a custom property with a system-colour default (the
 * shape `@rxova/react-rating-input` already uses) so a theme restyles the ring
 * rather than losing it.
 */
const focusedSegmentStyle: CSSProperties = {
  outline: 'var(--rx-date-focus-ring, 2px solid Highlight)',
  outlineOffset: 'var(--rx-date-focus-ring-offset, 1px)',
}

const literalStyle: CSSProperties = {
  userSelect: 'none',
  opacity: 'var(--rx-date-literal-opacity, 0.7)',
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
 * component from a build that only imports `useDateInput`.
 */
export const DateInput = /* @__PURE__ */ forwardRef<HTMLDivElement, DateInputProps>(
  function DateInput(props, ref) {
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
      dir,
      'aria-describedby': describedBy,
    } = props

    const field = useDateInput(props)
    const {
      parts,
      value,
      outOfRange,
      pieces,
      months,
      focused,
      ids,
      segmentRefs,
      rangeFor,
      step,
      typeDigit,
      clearSegment,
      moveFocus,
      handleSegmentFocus,
      handleBlur,
    } = field

    // `invalid` is the caller's assertion; `outOfRange` is ours. Either one
    // marks the field, so a date outside min/max is never silently accepted.
    const isInvalid = invalid === true || outOfRange

    function onSegmentKeyDown(event: KeyboardEvent<HTMLElement>, segment: DateSegment) {
      // Leave every modifier combination to the browser: Ctrl+ArrowLeft is a
      // word jump, Cmd+R is a reload, and a date field has no business
      // intercepting either.
      if (event.altKey || event.ctrlKey || event.metaKey) return

      const { key } = event

      if (/^\d$/.test(key)) {
        event.preventDefault()
        typeDigit(segment, key)
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
          field.setSegment(segment, key === 'Home' ? min : max)
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
        data-rx-date-root=""
        data-disabled={disabled ? '' : undefined}
        data-readonly={readOnly ? '' : undefined}
        data-invalid={isInvalid ? '' : undefined}
        data-out-of-range={outOfRange ? '' : undefined}
        data-complete={value !== null ? '' : undefined}
        // A group, not a single control: it contains three separately focusable
        // spinbuttons, and announcing it as one field would leave a screen
        // reader user with no way to know which part they are on.
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
              // between two named spinbuttons, and reading "slash" between them
              // adds nothing.
              <span key={`literal-${String(index)}`} aria-hidden="true" style={literalStyle}>
                {piece.text}
              </span>
            )
          }

          const segment = piece.type
          const current = parts[segment]
          const { min, max } = rangeFor(segment)
          const placeholder = placeholders?.[segment] ?? DEFAULT_PLACEHOLDERS[segment]
          const text = current === null ? placeholder : pad(current, segmentWidth(segment))
          const state: DateSegmentState = {
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
              data-rx-date-segment={segment}
              data-placeholder={current === null ? '' : undefined}
              data-focused={focused === segment ? '' : undefined}
              // A real spinbutton, which is what a bounded numeric field with
              // arrow-key stepping is. Screen readers then announce the value,
              // the range, and the fact that it is adjustable, without any of
              // that having to be spelled out in the label.
              role="spinbutton"
              // Disabled segments stay in the tree but leave the tab order,
              // matching how a disabled native control behaves.
              tabIndex={disabled ? -1 : 0}
              aria-label={segmentLabels?.[segment] ?? DEFAULT_LABELS[segment]}
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={current ?? undefined}
              // The month reads as its name, not its number: "3" is a value,
              // "March" is the thing the user is choosing. An empty segment
              // announces the placeholder instead of nothing at all.
              aria-valuetext={
                current === null
                  ? placeholder
                  : segment === 'month'
                    ? /* v8 ignore next */ (months[current - 1] ?? String(current))
                    : String(current)
              }
              aria-disabled={disabled ? true : undefined}
              aria-readonly={readOnly ? true : undefined}
              aria-invalid={isInvalid ? true : undefined}
              style={
                focused === segment ? { ...segmentStyle, ...focusedSegmentStyle } : segmentStyle
              }
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
          // The value a native form posts. Hidden rather than visually hidden:
          // it is never focusable and never announced, because the three
          // spinbuttons above are the accessible representation of this value.
          //
          // No `required` here: a hidden input is barred from constraint
          // validation, so the attribute would look like it was doing something
          // and do nothing. `required` is surfaced as `aria-required` on the
          // group instead, and enforcing it is the form layer's job.
          <input
            type="hidden"
            id={ids.hidden}
            data-rx-date-value=""
            name={name}
            value={value ?? ''}
          />
        )}
      </div>
    )
  },
)
