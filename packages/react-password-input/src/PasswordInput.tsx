import { forwardRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { usePasswordInput } from './usePasswordInput'
import { STRENGTH_LABELS } from './strength'
import type { PasswordInputProps, PasswordRevealState } from './types'

/**
 * Two paths in one 24x24 box: an eye, and an eye with a slash across it. Inline
 * rather than imported so the package still has no dependencies and no
 * stylesheet — and `1em` sized so it tracks the field's font-size.
 */
const EYE = (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
    <path d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
  </svg>
)

const EYE_OFF = (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
    <path d="M12 5c-5 0-9 4.5-10 7 .6 1.4 2.2 3.6 4.6 5.2l-2 2L6 20.6 20.6 6 19.2 4.6l-2.4 2.4A10.6 10.6 0 0 0 12 5zm0 12c-1 0-2-.2-2.9-.5l1.6-1.6a2.5 2.5 0 0 0 3.2-3.2l2-2A5 5 0 0 1 12 17zm9.9-5.1C21 9.7 19.6 8 17.9 6.7l-1.5 1.5c1.8 1.2 3.1 2.8 3.7 3.8-.9 1.7-3.6 5-8.1 5-.5 0-1 0-1.4-.1l-1.7 1.7c1 .3 2 .4 3.1.4 5 0 9-4.5 10-7z" />
  </svg>
)

// Only layout-critical declarations are inlined. Everything visual is a CSS
// custom property or a `data-*` hook, so there is no stylesheet to import.
const rootStyle: CSSProperties = {
  display: 'inline-flex',
  flexDirection: 'column',
  gap: 'var(--rx-password-gap, 0.375rem)',
}

const fieldStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--rx-password-field-gap, 0.25rem)',
}

const inputStyle: CSSProperties = {
  // The reveal button sits beside the input rather than floating over it, so
  // the text can never run underneath the icon at any font size or zoom level.
  flex: '1 1 auto',
  minWidth: 0,
  font: 'inherit',
}

const toggleStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  // 24px of hit area at the default font size. Below this the button fails
  // WCAG 2.5.8 Target Size (Minimum) on touch.
  minWidth: 'var(--rx-password-toggle-size, 1.75rem)',
  minHeight: 'var(--rx-password-toggle-size, 1.75rem)',
  padding: 0,
  font: 'inherit',
  lineHeight: 1,
  background: 'none',
  border: 0,
  color: 'inherit',
  cursor: 'pointer',
}

const trackStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--rx-password-meter-gap, 0.125rem)',
  height: 'var(--rx-password-meter-height, 0.25rem)',
}

const listStyle: CSSProperties = {
  margin: 0,
  paddingInlineStart: 'var(--rx-password-rules-indent, 1.25rem)',
}

/**
 * Off-screen but still in the accessibility tree. `display: none` and
 * `visibility: hidden` would remove it from that tree too, which is the one
 * thing this element exists to stay in.
 */
const visuallyHidden: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
}

const SEGMENTS = 4

function render<T>(node: ReactNode | ((state: T) => ReactNode), state: T): ReactNode {
  return typeof node === 'function' ? node(state) : node
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
 * component from a build that only imports `usePasswordInput`.
 */
export const PasswordInput = /* @__PURE__ */ forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(props, ref) {
    const {
      hideRevealToggle = false,
      revealLabel,
      revealIcon,
      showStrength = false,
      strengthLabel,
      rules: rulesProp,
      showRules = rulesProp !== undefined,
      capsLockLabel = 'Caps Lock is on',
      compromisedLabel = 'This password has appeared in a data breach. Choose a different one.',
      name,
      required,
      disabled = false,
      readOnly = false,
      autoComplete = 'current-password',
      placeholder,
      invalid,
      label,
      className,
      style,
      autoFocus,
      'aria-label': ariaLabel,
      'aria-describedby': describedBy,
    } = props

    const field = usePasswordInput(props)
    const {
      value,
      revealed,
      type,
      capsLock,
      strength,
      rules,
      compromised,
      checking,
      valid,
      minLength,
      maxLength,
      ids,
      inputRef,
      setValue,
      toggleReveal,
      captureSelection,
      handleModifierEvent,
      handleBlur,
      handleFocus,
    } = field

    const revealState: PasswordRevealState = { revealed, disabled }
    const toggleName =
      (typeof revealLabel === 'function' ? revealLabel(revealState) : revealLabel) ??
      (revealed ? 'Hide password' : 'Show password')

    const caption = strengthLabel ? strengthLabel(strength) : STRENGTH_LABELS[strength.score]

    // Only the ids that actually render — a dangling aria-describedby is a
    // WCAG failure, and axe reports it as one.
    const describedByIds = [
      describedBy,
      showStrength ? ids.strength : undefined,
      showRules ? ids.rules : undefined,
    ]
      .filter(Boolean)
      .join(' ')

    const metCount = rules.filter((rule) => rule.met).length

    return (
      <div
        className={className}
        style={{ ...rootStyle, ...style }}
        data-rx-password-root=""
        data-revealed={revealed ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        data-readonly={readOnly ? '' : undefined}
        data-invalid={invalid ? '' : undefined}
        data-valid={valid ? '' : undefined}
        data-score={showStrength ? strength.score : undefined}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        {/*
          `label` names the field; it does not render one. Every component in
          the suite reads it that way, and a component that quietly emitted a
          visible `<label>` while its neighbour did not is a layout the caller
          cannot compose against. A node goes into a hidden span the input
          points at, because `aria-label` only takes a string.
        */}
        {label !== undefined && typeof label !== 'string' ? (
          <span id={ids.label} style={{ display: 'none' }}>
            {label}
          </span>
        ) : null}

        <div style={fieldStyle} data-rx-password-field="">
          <input
            ref={(node) => {
              inputRef.current = node
              if (typeof ref === 'function') ref(node)
              else if (ref) ref.current = node
            }}
            id={ids.input}
            data-rx-password-input=""
            // Opt-in, and the same prop `@rxova/react-otp-input` exposes.
            autoFocus={autoFocus}
            // Driven by the hook so the headless and rendered paths can never
            // disagree about what "revealed" means.
            type={type}
            value={value}
            name={name}
            required={required}
            disabled={disabled}
            readOnly={readOnly}
            autoComplete={autoComplete}
            placeholder={placeholder}
            minLength={minLength > 0 ? minLength : undefined}
            maxLength={maxLength}
            // Password managers and mobile keyboards both key off these. A
            // password field that autocapitalises its first character is a
            // classic "my password stopped working on my phone" report.
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={invalid ? true : undefined}
            aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
            aria-labelledby={
              ariaLabel === undefined && label !== undefined && typeof label !== 'string'
                ? ids.label
                : undefined
            }
            aria-describedby={describedByIds === '' ? undefined : describedByIds}
            style={inputStyle}
            onChange={(event) => {
              setValue(event.target.value)
            }}
            onKeyDown={handleModifierEvent}
            onKeyUp={handleModifierEvent}
            onClick={handleModifierEvent}
          />

          {hideRevealToggle ? null : (
            <button
              // Never a submit button: the default `type` inside a form is
              // "submit", so an unadorned reveal toggle submits the login form.
              type="button"
              data-rx-password-toggle=""
              // A toggle button, so `aria-pressed` rather than a changing role.
              // The name stays "Show password" while pressed=false and flips
              // with the state, which is what screen-reader users expect from
              // an icon toggle.
              aria-pressed={revealed}
              aria-controls={ids.input}
              aria-label={toggleName}
              title={toggleName}
              // Explicit, even though a <button> is focusable by default.
              // Safari/WebKit leaves buttons out of the tab order unless the OS
              // "Full Keyboard Access" setting is on, so on a default macOS
              // install the reveal toggle would be unreachable by keyboard —
              // an operable-by-keyboard failure for the one control the field
              // adds over a plain input. An explicit tabindex puts it back.
              tabIndex={0}
              // Not a tab stop while disabled, but still exposed, so the field
              // does not silently lose a control in the accessibility tree.
              disabled={disabled}
              style={toggleStyle}
              // Keep focus in the input when the toggle is clicked with a
              // pointer. Without this the button takes focus on mousedown, the
              // caret is gone by the time `onClick` runs, and "reveal to check
              // the last character I typed" drops the user back at position 0
              // of an unfocused field. Mouse only — Tab still focuses the
              // button normally, so keyboard users lose nothing.
              onMouseDown={(event) => {
                captureSelection()
                event.preventDefault()
              }}
              onClick={toggleReveal}
            >
              {revealIcon !== undefined
                ? render(revealIcon, revealState)
                : revealed
                  ? EYE_OFF
                  : EYE}
            </button>
          )}
        </div>

        {capsLock ? (
          // role="status" rather than "alert": Caps Lock being on is worth
          // saying, not worth interrupting whatever is already being read.
          <p id={ids.capsLock} role="status" data-rx-password-caps-lock="" style={{ margin: 0 }}>
            {capsLockLabel}
          </p>
        ) : null}

        {showStrength ? (
          <div data-rx-password-strength="">
            <div
              role="meter"
              aria-valuemin={0}
              aria-valuemax={SEGMENTS}
              aria-valuenow={strength.score}
              // The number alone reads as "2" with no unit. valuetext is what
              // makes it "Fair" — which is the only part a user can act on.
              aria-valuetext={typeof caption === 'string' ? caption : undefined}
              aria-label="Password strength"
              data-rx-password-meter=""
              style={trackStyle}
            >
              {Array.from({ length: SEGMENTS }, (_, index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  data-rx-password-segment={index}
                  data-filled={index < strength.score ? '' : undefined}
                  style={{
                    flex: 1,
                    background:
                      index < strength.score
                        ? `var(--rx-password-meter-fill-${String(strength.score)}, var(--rx-password-meter-fill, currentColor))`
                        : 'var(--rx-password-meter-track, rgba(0 0 0 / 0.15))',
                    borderRadius: 'var(--rx-password-meter-radius, 999px)',
                  }}
                />
              ))}
            </div>
            <p id={ids.strength} data-rx-password-strength-label="" style={{ margin: 0 }}>
              {caption}
            </p>
          </div>
        ) : null}

        {showRules ? (
          <ul id={ids.rules} data-rx-password-rules="" style={listStyle}>
            {rules.map((rule) => (
              <li key={rule.id} data-rule={rule.id} data-met={rule.met ? '' : undefined}>
                {/*
                  The met/unmet state is carried in the text, not only in colour
                  or an icon — WCAG 1.4.1 (Use of Colour). The marker itself is
                  aria-hidden so it is not read as "check mark" before the label.
                */}
                <span aria-hidden="true" data-rx-password-rule-marker="">
                  {rule.met ? '✓ ' : '· '}
                </span>
                {rule.label}
                <span style={visuallyHidden}>{rule.met ? ' — met' : ' — not met'}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {compromised === true ? (
          <p
            id={ids.compromised}
            role="alert"
            data-rx-password-compromised=""
            style={{ margin: 0 }}
          >
            {compromisedLabel}
          </p>
        ) : null}

        {/*
          Announces the strength bucket and the rule tally, and nothing else.

          React only touches this text node when the rendered string actually
          changes — which is when the *bucket* changes, not on every keystroke —
          so assistive technology announces "Fair" once on crossing into it
          rather than on all six characters that stayed inside it. That is the
          whole reason the caption is bucketed rather than a percentage.
        */}
        <span aria-live="polite" data-rx-password-announcement="" style={visuallyHidden}>
          {showStrength && typeof caption === 'string' ? caption : ''}
          {showRules ? ` ${String(metCount)} of ${String(rules.length)} requirements met.` : ''}
          {checking ? ' Checking password.' : ''}
        </span>
      </div>
    )
  },
)
