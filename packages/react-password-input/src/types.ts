import type { CSSProperties, FocusEvent, ReactNode } from 'react'

/**
 * Coarse 0–4 bucket, the scale every strength meter in this space has settled
 * on (zxcvbn popularised it). 0 is "unusable", 4 is "good enough that length is
 * doing the work". Buckets, not a percentage: a continuous bar invites users to
 * optimise for the pixel rather than for length.
 */
export type PasswordScore = 0 | 1 | 2 | 3 | 4

/** Why the estimator marked a password down. Stable codes, safe to `switch` on. */
export type PasswordPenaltyCode =
  | 'too-short'
  | 'single-class'
  | 'repeated-characters'
  | 'sequential-characters'
  | 'blocklisted'
  | 'contains-user-input'

/** The estimator's verdict. Returned by {@link estimateStrength}. */
export interface PasswordStrength {
  /** 0–4 bucket. */
  score: PasswordScore
  /**
   * Estimated bits of entropy *after* penalties. Not a security guarantee —
   * an offline-attack cost model would need the attacker's wordlist, which no
   * client-side estimator has. Treat it as a comparator, not a measurement.
   */
  entropy: number
  /** Machine-readable reasons the score is not higher. Ordered by impact. */
  penalties: PasswordPenaltyCode[]
  /** Length after collapsing runs and repeats — what the entropy is based on. */
  effectiveLength: number
}

/** A single requirement rendered in the checklist and reported to `onValidityChange`. */
export interface PasswordRule {
  /** Stable identifier; also the React key and the `data-rule` attribute value. */
  id: string
  /** Shown in the checklist. */
  label: string
  /** Pure predicate. Runs on every keystroke, so keep it cheap. */
  test: (password: string) => boolean
  /**
   * A failing optional rule is advice, not an error: it renders in the
   * checklist but never blocks `onValidityChange`. @default false
   */
  optional?: boolean
}

/** The evaluated state of one {@link PasswordRule}. */
export interface PasswordRuleState extends PasswordRule {
  met: boolean
}

/** Stable machine code for a coerced or misconfigured input. */
export type PasswordWarningCode =
  | 'min-length-negative'
  | 'min-length-non-integer'
  | 'max-length-below-min'
  | 'duplicate-rule-id'
  | 'autocomplete-missing'
  | 'estimate-threw'

/**
 * Emitted when the component keeps itself functional despite a prop it cannot
 * use as given — a negative `minLength`, a `maxLength` under the `minLength`,
 * two rules sharing an `id`. The coerced result is what actually renders, so
 * this is a development-only heads-up, never an error.
 */
export interface PasswordWarning {
  code: PasswordWarningCode
  /** The prop that carried the offending value. */
  prop: string
  /** Human-readable explanation, safe to log as-is. */
  message: string
}

/** State handed to the `revealIcon` / `strengthLabel` render props. */
export interface PasswordRevealState {
  /** The password is currently rendered as plain text. */
  revealed: boolean
  disabled: boolean
}

export interface PasswordInputProps {
  // ---- Value ----------------------------------------------------------------
  /** Controlled password. */
  value?: string
  /** Uncontrolled initial password. Ignored when `value` is provided. */
  defaultValue?: string
  onChange?: (value: string) => void

  // ---- Reveal ---------------------------------------------------------------
  /** Controlled reveal state. Omit to let the component own it. */
  revealed?: boolean
  /** Initial reveal state for the uncontrolled case. @default false */
  defaultRevealed?: boolean
  onRevealChange?: (revealed: boolean) => void
  /** Drop the reveal button entirely. @default false */
  hideRevealToggle?: boolean
  /**
   * Re-mask when focus leaves the field, so a revealed password does not sit on
   * screen after the user tabs away. @default true
   */
  hideOnBlur?: boolean
  /** Accessible name for the reveal button. @default 'Show password' / 'Hide password' */
  revealLabel?: string | ((state: PasswordRevealState) => string)
  /** Custom reveal-button contents. @default a built-in eye glyph */
  revealIcon?: ReactNode | ((state: PasswordRevealState) => ReactNode)

  // ---- Strength -------------------------------------------------------------
  /** Render the strength meter. @default false */
  showStrength?: boolean
  /**
   * Swap the built-in estimator — pass a zxcvbn adapter here if you want its
   * wordlists and are willing to pay ~350 kB (minified + brotli) for them.
   * @default the built-in {@link estimateStrength}
   */
  estimate?: (password: string) => PasswordStrength
  /** Extra low-entropy strings to reject, e.g. your product name. */
  blocklist?: string[]
  /**
   * Values the user has already typed elsewhere — email, username, name. A
   * password containing any of them is penalised. Nothing leaves the browser.
   */
  userInputs?: string[]
  /** Label under the meter for a score. @default 'Very weak' … 'Strong' */
  strengthLabel?: (strength: PasswordStrength) => ReactNode
  /** Minimum score to count as valid. `null` disables the gate. @default null */
  minScore?: PasswordScore | null

  // ---- Rules ----------------------------------------------------------------
  /**
   * NIST SP 800-63B leads with length and explicitly advises against composition
   * rules, so the default is a single length rule. Pass your own array to opt
   * into more.
   */
  rules?: PasswordRule[]
  /** Render the requirement checklist. @default `rules` was provided */
  showRules?: boolean
  /** Minimum length for the default rule and the native `minlength`. @default 8 */
  minLength?: number
  /**
   * Native `maxlength`. NIST requires accepting at least 64 characters; the
   * default leaves it unset so long passphrases are never silently truncated.
   */
  maxLength?: number
  /** Fires whenever overall validity changes — all required rules met and `minScore` reached. */
  onValidityChange?: (valid: boolean) => void

  // ---- Caps Lock ------------------------------------------------------------
  /** Warn while Caps Lock is on. @default true */
  capsLockWarning?: boolean
  /** Text of the Caps Lock warning. @default 'Caps Lock is on' */
  capsLockLabel?: ReactNode

  // ---- Breach check ---------------------------------------------------------
  /**
   * Optional async check against a breach corpus. Called debounced, with an
   * `AbortSignal` that fires when the password changes again or the component
   * unmounts. The library never makes a network request itself — wire this to
   * a k-anonymity endpoint (or your own service) and keep the plaintext local.
   */
  checkCompromised?: (password: string, signal: AbortSignal) => Promise<boolean>
  /** Debounce before `checkCompromised` runs, in ms. @default 400 */
  checkCompromisedDelay?: number
  /** Message shown when `checkCompromised` resolves true. @default a stock sentence */
  compromisedLabel?: ReactNode

  // ---- Form integration -----------------------------------------------------
  name?: string
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
  /**
   * Password managers key off this. @default 'current-password'
   * Set `'new-password'` on sign-up and change-password forms.
   */
  autoComplete?: string
  placeholder?: string
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void
  /** Sets `aria-invalid` and `data-invalid` on the field. */
  invalid?: boolean
  /** ids of external error/help text. Merged with the ids this component owns. */
  'aria-describedby'?: string
  /** Accessible name for the field. */
  label?: ReactNode
  /** Base id; the input, meter, checklist and warnings derive ids from it. */
  id?: string

  // ---- Presentation ---------------------------------------------------------
  className?: string
  style?: CSSProperties

  // ---- Diagnostics ----------------------------------------------------------
  /**
   * Called in development whenever a prop is coerced or a configuration looks
   * wrong — see {@link PasswordWarning}. The coerced result still renders, so
   * this never changes what the user sees. When omitted, the same warnings go
   * to `console.warn`. The entire path is stripped from production builds.
   */
  onWarn?: (warning: PasswordWarning) => void
}
