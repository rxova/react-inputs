import { forwardRef } from 'react'
import type { CSSProperties } from 'react'
import { zoneOptionLabel } from './labels'
import { useTimezoneInput } from './useTimezoneInput'
import type { TimezoneInputProps, TimezoneOptionState } from './types'

// Only layout-critical declarations are inlined. Everything visual is a CSS
// custom property or a `data-*` hook, so there is no stylesheet to import.
const rootStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--rx-timezone-gap, 0.375rem)',
  font: 'inherit',
}

const selectStyle: CSSProperties = {
  font: 'inherit',
  // The longest option is around fifty characters; without a ceiling the select
  // stretches to it and pushes the rest of a form sideways.
  maxWidth: 'var(--rx-timezone-select-width, 22rem)',
  padding: 'var(--rx-timezone-select-padding, 0.25rem 0.375rem)',
  borderRadius: 'var(--rx-timezone-select-radius, 0.25rem)',
}

/**
 * Run a consumer's `renderZone`, falling back to the built-in text.
 *
 * Two failures matter and neither is hypothetical. A formatter that throws runs
 * inside render, so without this one bad consumer function blanks the page. One
 * that returns `''` is quieter and worse: a native `<option>` with no text is an
 * invisible, unselectable row, and the field silently loses a zone.
 */
function optionText(
  renderZone: TimezoneInputProps['renderZone'],
  state: TimezoneOptionState,
  fallback: string,
): string {
  if (!renderZone) return fallback
  let custom: string
  try {
    custom = renderZone(state)
  } catch {
    return fallback
  }
  return typeof custom === 'string' && custom !== '' ? custom : fallback
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
 * component from a build that only imports `useTimezoneInput`.
 */
export const TimezoneInput = /* @__PURE__ */ forwardRef<HTMLSelectElement, TimezoneInputProps>(
  function TimezoneInput(props, ref) {
    const {
      renderZone,
      label,
      className,
      style,
      name,
      required,
      disabled = false,
      invalid,
      placeholder = 'Select a time zone',
      locale,
      'aria-describedby': describedBy,
    } = props

    const field = useTimezoneInput(props)
    const {
      resolved,
      referenceDate,
      groups,
      ids,
      allowEmpty,
      selectZone,
      handleBlur,
      handleFocus,
    } = field

    function renderOption(state: TimezoneOptionState) {
      return (
        <option
          key={state.zone}
          value={state.zone}
          data-rx-timezone-unlisted={state.unlisted ? '' : undefined}
        >
          {optionText(renderZone, state, zoneOptionLabel(state.zone, locale, referenceDate))}
        </option>
      )
    }

    return (
      <div
        className={className}
        style={{ ...rootStyle, ...style }}
        data-rx-timezone-root=""
        data-disabled={disabled ? '' : undefined}
        data-invalid={invalid === true ? '' : undefined}
        data-complete={resolved !== null ? '' : undefined}
      >
        {/*
          A non-string label needs a node to point at, because `aria-label` only
          takes a string.
        */}
        {label !== undefined && typeof label !== 'string' ? (
          <span id={ids.root} style={{ display: 'none' }}>
            {label}
          </span>
        ) : null}

        {/*
          A real <select>, exactly as the phone input picks a country. On a phone
          this is the platform's own picker — searchable, scrollable with a
          thumb, already localised — and no custom listbox of 419 options
          matches it. It also brings keyboard type-ahead, the full ARIA contract
          and form semantics for free, none of which this package then has to
          reimplement and get subtly wrong.

          No hidden input either: a named <select> posts itself.
        */}
        <select
          ref={ref}
          id={ids.select}
          data-rx-timezone-select=""
          name={name}
          required={required}
          disabled={disabled}
          aria-label={typeof label === 'string' ? label : undefined}
          aria-labelledby={typeof label === 'string' || label === undefined ? undefined : ids.root}
          aria-describedby={describedBy}
          aria-invalid={invalid === true ? true : undefined}
          style={selectStyle}
          value={resolved ?? ''}
          onChange={(event) => {
            selectZone(event.target.value === '' ? null : event.target.value)
          }}
          onBlur={handleBlur}
          onFocus={handleFocus}
        >
          {allowEmpty ? <option value="">{placeholder}</option> : null}
          {groups.map((group) =>
            group.area === '' ? (
              group.options.map(renderOption)
            ) : (
              <optgroup key={group.area} label={group.area}>
                {group.options.map(renderOption)}
              </optgroup>
            ),
          )}
        </select>
      </div>
    )
  },
)
