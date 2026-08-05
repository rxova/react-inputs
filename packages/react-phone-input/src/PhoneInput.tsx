import { forwardRef } from 'react'
import type { CSSProperties } from 'react'
import { usePhoneInput } from './usePhoneInput'
import type { PhoneCountryState, PhoneInputProps } from './types'

// Only layout-critical declarations are inlined. Everything visual is a CSS
// custom property or a `data-*` hook, so there is no stylesheet to import.
const rootStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--rx-phone-gap, 0.375rem)',
  font: 'inherit',
}

const selectStyle: CSSProperties = {
  font: 'inherit',
  // The flag is an emoji, so it sizes by font-size like the rest of the field.
  maxWidth: 'var(--rx-phone-select-width, 9rem)',
  flexShrink: 0,
}

const inputStyle: CSSProperties = {
  font: 'inherit',
  flex: '1 1 auto',
  minWidth: 0,
}

/**
 * `forwardRef` rather than reading `props.ref`.
 *
 * React 19 passes `ref` as an ordinary prop, so `props.ref` works there — but
 * React 18 strips it before props are built, so the ref would silently never
 * populate. We declare `react >= 18` as a peer, so the version that needs
 * forwardRef is the one that decides. The ref lands on the `<input>`, not the
 * wrapper: `setFocus()` in React Hook Form and focus-first-error patterns both
 * expect a focusable form control.
 *
 * The `@__PURE__` annotation is load-bearing: `forwardRef(...)` is a top-level
 * call, and without it bundlers must assume side effects and cannot drop this
 * component from a build that only imports `usePhoneInput`.
 */
export const PhoneInput = /* @__PURE__ */ forwardRef<HTMLInputElement, PhoneInputProps>(
  function PhoneInput(props, ref) {
    const {
      hideCountrySelect = false,
      countryLabel = 'Country',
      renderCountry,
      label,
      placeholder,
      className,
      style,
      name,
      required,
      disabled = false,
      readOnly = false,
      invalid,
      showValidity = false,
      validityLabel,
      'aria-describedby': describedBy,
    } = props

    const field = usePhoneInput(props)
    const {
      text,
      value,
      details,
      country,
      countries,
      ids,
      inputRef,
      nameFor,
      flagFor,
      handleInputChange,
      selectCountry,
      handleBlur,
      handleFocus,
      touched,
    } = field

    /*
     * Feedback is withheld until focus has left the field once: every number is
     * the wrong length while it is still being typed, and a field that turns red
     * on the first keystroke trains people to ignore it. An empty field says
     * nothing either — that is `required`'s job, not this one's.
     */
    const showFeedback = showValidity && touched && text.trim().length > 0
    const feedback = !showFeedback
      ? null
      : validityLabel
        ? validityLabel({ possible: details.possible, country, details })
        : details.possible
          ? `Looks like a ${country ? nameFor(country.iso2) : 'valid'} number.`
          : country
            ? `That is not a length used by ${nameFor(country.iso2)} numbers.`
            : 'That does not match a known calling code.'

    return (
      <div
        className={className}
        style={{ ...rootStyle, ...style }}
        data-rx-phone-root=""
        data-country={country?.iso2}
        data-possible={details.possible ? '' : undefined}
        data-invalid={invalid ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        onBlur={handleBlur}
        onFocus={handleFocus}
      >
        {/*
          `label` names the field; it does not render one. Every component in
          the suite reads it that way, and a component that quietly emitted a
          visible `<label>` while its neighbour did not is a layout the caller
          cannot compose against. A node goes into a hidden span the control
          points at, because `aria-label` only takes a string.
        */}
        {label !== undefined && typeof label !== 'string' ? (
          <span id={ids.label} style={{ display: 'none' }}>
            {label}
          </span>
        ) : null}

        {hideCountrySelect ? null : (
          // A real <select>. On a phone this is the platform's own picker —
          // searchable, scrollable with a thumb, and already localised — which
          // no custom listbox of 240 options matches. It also gives keyboard
          // type-ahead and form semantics for free.
          <select
            id={ids.select}
            data-rx-phone-country=""
            aria-label={countryLabel}
            value={country?.iso2 ?? ''}
            disabled={disabled || readOnly}
            style={selectStyle}
            onChange={(event) => {
              selectCountry(event.target.value)
            }}
          >
            {countries.map((entry) => {
              const state: PhoneCountryState = {
                country: entry,
                name: nameFor(entry.iso2),
                flag: flagFor(entry.iso2),
                selected: entry.iso2 === country?.iso2,
              }
              return (
                <option key={entry.iso2} value={entry.iso2}>
                  {/*
                    The name leads, deliberately. A native select's type-ahead
                    matches from the start of the option's text, so a leading
                    flag emoji means pressing "f" jumps nowhere — the string
                    starts with a regional-indicator pair, not with "F". Name
                    first makes "f", "fr", "fra" land on France the way every
                    other native select behaves.
                  */}
                  {renderCountry
                    ? renderCountry(state)
                    : `${state.name} ${state.flag} +${entry.dial}`}
                </option>
              )
            })}
          </select>
        )}

        <input
          ref={(node) => {
            inputRef.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
          }}
          id={ids.input}
          data-rx-phone-input=""
          // `tel`, so mobile keyboards show the dial pad. Not `number`: that
          // strips leading zeros, offers a spinner nobody wants on a phone
          // number, and refuses the `+` entirely.
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={text}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          aria-label={typeof label === 'string' ? label : undefined}
          aria-labelledby={label !== undefined && typeof label !== 'string' ? ids.label : undefined}
          aria-invalid={(invalid ?? (showFeedback && !details.possible)) ? true : undefined}
          aria-describedby={
            [describedBy, showFeedback ? ids.validity : undefined].filter(Boolean).join(' ') ||
            undefined
          }
          style={inputStyle}
          onChange={handleInputChange}
        />

        {feedback === null ? null : (
          // Polite, not assertive: a number being the wrong length is not an
          // emergency, and assertive would cut across whatever the user is
          // already hearing after they tab away.
          <p
            id={ids.validity}
            data-rx-phone-validity=""
            data-possible={details.possible ? '' : undefined}
            role="status"
            aria-live="polite"
          >
            {feedback}
          </p>
        )}

        {name === undefined ? null : (
          // The canonical value a native form posts. Separate from the visible
          // input because the two carry different things: the box shows grouped
          // national digits, the form wants E.164.
          <input type="hidden" id={ids.hidden} data-rx-phone-value="" name={name} value={value} />
        )}
      </div>
    )
  },
)
