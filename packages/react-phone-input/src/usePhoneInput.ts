import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FocusEvent } from 'react'
import { COUNTRIES, countryByISO2, countryName, flagEmoji } from './countries'
import type { Country } from './countries'
import {
  caretForDigitIndex,
  deleteDigit,
  digitsBeforeCaret,
  digitsOnly,
  formatPhone,
  isPossible,
  parsePhone,
} from './phone'
import type { ParsedPhone } from './phone'
import { useIsomorphicLayoutEffect } from '@rxova/ts-utils/react'
import {
  inspectCountry,
  inspectCountryList,
  inspectLocale,
  inspectMaxLength,
  inspectValue,
} from './warn'
import type { PhoneDetails, PhoneWarning } from './types'

const DEFAULT_COUNTRY = 'US'

/**
 * The floor a supplied `maxLength` cannot go under.
 *
 * E.164 caps a number at 15 digits, so the longest text this field can ever
 * *produce* is `+`, the calling code, and those digits with their grouping
 * separators — 21 characters for every entry in the country table, which
 * `adversarial.browser.test.tsx` asserts against the table itself rather than
 * trusting this number. A cap below that would truncate a number the component
 * had just formatted, so it is refused rather than obeyed.
 */
const MIN_MAX_LENGTH = 21

/**
 * The cap applied when the consumer names none.
 *
 * An unbounded phone field is a denial-of-service surface: every keystroke
 * re-parses, re-formats and re-groups the entire contents, and nothing about
 * that is bounded by the number — it is bounded by the size of a paste. So the
 * cap is always applied and the prop only moves it, exactly as
 * `@rxova/react-password-input` treats its own.
 *
 * `32` is half again the 21-character worst case above, which is the room
 * people's own punctuation needs: `+44 (0)20 7123 4567` is 20 characters,
 * `0044 (0)20 7123 4567` is 20, `+1 (415) 555-2671` is 17. No real number
 * written any of the ways people write them reaches 32, so nothing legitimate
 * is ever truncated — but a pasted file stops at 32 characters instead of
 * reaching the parser.
 */
const DEFAULT_MAX_LENGTH = 32

/**
 * Trim formatted text to the cap without leaving a dangling separator.
 *
 * Applied *after* formatting as well as before parsing, because grouping
 * inserts spaces: a raw string already at the cap formats past it. Trimming the
 * formatted string rather than the digits keeps the box, the caret arithmetic
 * and the reported value all describing the same string — the text is the
 * source of truth here, so a shortened one simply re-parses to fewer digits.
 */
function capText(text: string, limit: number): string {
  return text.length <= limit ? text : text.slice(0, limit).trimEnd()
}

export interface UsePhoneInputOptions {
  value?: string
  defaultValue?: string
  onChange?: (value: string, details: PhoneDetails) => void
  country?: string
  defaultCountry?: string
  onCountryChange?: (iso2: string) => void
  countries?: string[]
  locale?: string
  maxLength?: number
  disabled?: boolean
  readOnly?: boolean
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void
  onWarn?: (warning: PhoneWarning) => void
  id?: string
}

export interface UsePhoneInputResult {
  /** What the input displays — grouped, and carrying `+` in international mode. */
  text: string
  /** The canonical value: `+` + calling code + national digits, or `''`. */
  value: string
  /** Everything `onChange` reports. */
  details: PhoneDetails
  /** The currently selected country. */
  country: Country | undefined
  /** The list the picker should show, in order. */
  countries: Country[]
  /** True when the user is typing an explicit `+…` number. */
  international: boolean
  /**
   * The character cap after coercion. Always set — an unusable value falls back
   * to the default. Put it on your own `<input>` when rendering headless; the
   * hook enforces it either way.
   */
  maxLength: number
  disabled: boolean
  readOnly: boolean
  ids: {
    root: string
    input: string
    /** Only referenced when `label` is a node rather than a string. */
    label: string
    select: string
    hidden: string
    validity: string
  }
  /**
   * Structural rather than `RefObject`: in @types/react 18 `RefObject.current`
   * is readonly, in 19 it is mutable. Declaring the shape keeps this assignable
   * under both, which matters because `react >= 18` is a peer.
   */
  inputRef: { current: HTMLInputElement | null }
  /** Localised country name, from `Intl.DisplayNames`. */
  nameFor: (iso2: string) => string
  /** Flag emoji for an ISO code. */
  flagFor: (iso2: string) => string
  handleInputChange: (event: ChangeEvent<HTMLInputElement>) => void
  /** Empty the number, keeping the selected country. Present on every input hook in the suite. */
  clear: () => void
  selectCountry: (iso2: string) => void
  handleBlur: (event: FocusEvent<HTMLElement>) => void
  handleFocus: (event: FocusEvent<HTMLElement>) => void
  /**
   * Focus has left the whole field at least once. Feedback about a number being
   * the wrong length is only fair after that: every number is "too short" while
   * it is still being typed.
   */
  touched: boolean
}

/**
 * Headless state for an international phone field: the text, the country, the
 * canonical value, and the caret bookkeeping that makes as-you-type formatting
 * usable. Exported so a consumer can build a completely custom renderer without
 * reimplementing the fiddly parts.
 */
export function usePhoneInput(options: UsePhoneInputOptions): UsePhoneInputResult {
  const {
    value: valueProp,
    defaultValue = '',
    onChange,
    country: countryProp,
    defaultCountry = DEFAULT_COUNTRY,
    onCountryChange,
    countries: countriesProp,
    locale,
    maxLength: maxLengthProp,
    disabled = false,
    readOnly = false,
    onBlur,
    onFocus,
    onWarn,
    id: idProp,
  } = options

  const reactId = useId()
  const baseId = idProp ?? `rx-phone-${reactId}`

  /** The list the picker shows. An unusable `countries` prop is ignored, not obeyed. */
  const countries = useMemo(() => {
    if (countriesProp === undefined || countriesProp.length === 0) return COUNTRIES
    const picked = countriesProp
      .map((iso2) => countryByISO2(iso2))
      .filter((country): country is Country => country !== undefined)
    return picked.length === 0 ? COUNTRIES : picked
  }, [countriesProp])

  // The final `??` arms are unreachable: `countries` is never empty (an empty
  // `countries` prop falls back to the full table), so `countries[0]` always
  // resolves. They exist because indexing is typed as possibly-undefined.
  /* v8 ignore next 2 */
  const fallbackCountry =
    countryByISO2(defaultCountry) ?? countries[0] ?? countryByISO2(DEFAULT_COUNTRY)

  // There is always a cap; the prop only moves it. A value that cannot bound
  // anything — non-finite, or short enough to cut a number the field itself
  // formatted — falls back to the default rather than removing the bound.
  const maxLength =
    maxLengthProp !== undefined && Number.isFinite(maxLengthProp) && maxLengthProp >= MIN_MAX_LENGTH
      ? Math.floor(maxLengthProp)
      : DEFAULT_MAX_LENGTH

  const isValueControlled = valueProp !== undefined
  const isCountryControlled = countryProp !== undefined

  /**
   * The initial country comes from the initial *value* when there is one.
   *
   * A field mounted with `+442071234567` is a UK number whatever
   * `defaultCountry` says, and starting the select on the US would make the two
   * disagree on the very first frame.
   */
  const [uncontrolledCountry, setUncontrolledCountry] = useState(() => {
    const initial = isValueControlled ? valueProp : defaultValue
    const fromValue = initial === '' ? undefined : parsePhone(initial).country
    /* v8 ignore next */
    return (fromValue ?? fallbackCountry)?.iso2 ?? DEFAULT_COUNTRY
  })
  const selectedIso2 = isCountryControlled ? countryProp : uncontrolledCountry

  /**
   * The text in the box.
   *
   * The *text* is the source of truth for what the user sees, and the E.164
   * value is derived from it — not the other way round. Deriving the text from
   * the value instead would reformat mid-word: a user who has typed four digits
   * of a ten-digit number has no valid E.164 value at all, and rebuilding the
   * display from `''` on every keystroke would erase what they typed.
   */
  const [text, setText] = useState(() => {
    const initial = isValueControlled ? valueProp : defaultValue
    if (initial === '') return ''
    return formatPhone(parsePhone(initial), true)
  })

  const inputRef = useRef<HTMLInputElement | null>(null)
  /** Set by an edit, consumed by the layout effect that restores the caret. */
  const pendingCaret = useRef<number | null>(null)

  const international = text.trimStart().startsWith('+')

  const parsed: ParsedPhone = useMemo(() => parsePhone(text, selectedIso2), [text, selectedIso2])

  /**
   * Re-sync from a controlled `value` when the *prop* changes.
   *
   * Adjusting state during render rather than in an effect, which is React's
   * documented pattern: an effect would paint the stale text for one frame
   * first. Compared against the prop's previous value, not against the derived
   * one, so a parent echoing our own `onChange` back does not reformat the
   * partial number the user is still typing.
   */
  const [previousValueProp, setPreviousValueProp] = useState(valueProp)
  if (isValueControlled && valueProp !== previousValueProp) {
    setPreviousValueProp(valueProp)
    if (valueProp !== parsed.e164) {
      setText(valueProp === '' ? '' : formatPhone(parsePhone(valueProp), true))
    }
  }

  const details: PhoneDetails = useMemo(
    () => ({
      e164: parsed.e164,
      country: parsed.country?.iso2,
      national: parsed.national,
      possible: parsed.possible,
    }),
    [parsed],
  )

  const nameFor = useCallback((iso2: string) => countryName(iso2, locale), [locale])
  const flagFor = useCallback((iso2: string) => flagEmoji(iso2), [])

  // Development-only configuration diagnostics. Guarded so a production bundler
  // drops the branch — and with it `warn.ts` entirely. Deduped per instance so
  // a re-rendering parent warns once, not once per keystroke.
  const warned = useRef<Set<string> | null>(null)
  useEffect(() => {
    // A bundler folds this to a constant and drops the whole effect body in a
    // production build, so the branch is unreachable once compiled and cannot
    // be exercised by the (always-development) test build.
    /* v8 ignore next */
    if (process.env.NODE_ENV === 'production') return
    const seen = (warned.current ??= new Set<string>())
    const emit = (warning: PhoneWarning | null) => {
      if (!warning) return
      const key = `${warning.code}:${warning.received}`
      if (seen.has(key)) return
      seen.add(key)
      if (onWarn) onWarn(warning)
      // The library ships no console noise in production; this line is only
      // reached in development and is dropped from production builds.
      // eslint-disable-next-line no-console
      else console.warn(`[react-phone-input] ${warning.message}`)
    }

    if (isCountryControlled) emit(inspectCountry(countryProp, 'country'))
    else if (options.defaultCountry !== undefined) {
      emit(inspectCountry(options.defaultCountry, 'defaultCountry'))
    }
    emit(inspectCountryList(countriesProp))
    if (locale !== undefined) emit(inspectLocale(locale))
    emit(inspectMaxLength(maxLengthProp, MIN_MAX_LENGTH, maxLength))
    const raw = isValueControlled ? valueProp : defaultValue
    emit(inspectValue(raw, isValueControlled ? 'value' : 'defaultValue'))
  }, [
    isCountryControlled,
    countryProp,
    options.defaultCountry,
    countriesProp,
    locale,
    maxLengthProp,
    maxLength,
    isValueControlled,
    valueProp,
    defaultValue,
    onWarn,
  ])

  const report = useCallback(
    (nextText: string, nextCountryIso2: string) => {
      const next = parsePhone(nextText, nextCountryIso2)
      onChange?.(next.e164, {
        e164: next.e164,
        country: next.country?.iso2,
        national: next.national,
        possible: next.possible,
      })
    },
    [onChange],
  )

  const clear = useCallback(() => {
    if (disabled || readOnly) return
    setText('')
    // The country survives: it is a separate choice from the number, and a
    // field that reset to the default country on clear would silently discard
    // the one the user picked.
    report('', selectedIso2)
  }, [disabled, readOnly, report, selectedIso2])

  /**
   * Reformat as the user types, keeping the caret on the same digit.
   *
   * Everything hard about an as-you-type phone field is here. Formatting
   * inserts spaces, so the offset the browser reports stops meaning what it
   * meant the moment a separator appears before it. Counting digits either side
   * of the caret is the only anchor that survives reformatting — and deletion
   * has to be special-cased, because removing the separator *itself* changes no
   * digit at all: the formatter re-inserts it, the value comes back identical
   * and the keystroke is dead. A user backspacing through `415 555 2671` had to
   * press the key twice at each group boundary.
   */
  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (disabled || readOnly) return
      // Capped before anything reads it, not after. The point of the cap is to
      // bound the work one paste can cause, and `maxLength` on the rendered
      // input does not help here: it governs what the *user* can put in the
      // box, not what a programmatic `.value = …` sets, and a headless consumer
      // may not have put the attribute on their own input at all.
      let raw = capText(event.target.value, maxLength)
      // `?? raw.length` is unreachable on a `tel` input, which always reports a
      // selection. Kept for the DOM types.
      /* v8 ignore next */
      let caret = event.target.selectionStart ?? raw.length

      // Same digits in, same digits out means the edit only touched a separator
      // this component put there. `inputType` says which way the user was
      // reaching; anything else — typing, pasting, a replaced selection — is
      // left alone.
      const { inputType } = event.nativeEvent as InputEvent
      const step =
        inputType === 'deleteContentBackward' ? -1 : inputType === 'deleteContentForward' ? 1 : 0
      if (step !== 0 && digitsOnly(raw).length === digitsOnly(text).length) {
        const cut = deleteDigit(raw, caret, step)
        raw = cut.text
        caret = cut.caret
      }

      const digitsBefore = digitsBeforeCaret(raw, caret)

      const next = parsePhone(raw, selectedIso2)
      const wasInternational = raw.trimStart().startsWith('+')
      // Grouping inserts separators, so raw text already at the cap formats
      // past it. Only trailing digits are ever lost, which leaves the calling
      // code — and so `next.country` below — untouched.
      const formatted = capText(formatPhone(next, wasInternational), maxLength)

      setText(formatted)
      pendingCaret.current = caretForDigitIndex(formatted, digitsBefore)

      // An explicit `+…` number decides the country by itself; keep the select
      // in step so the two can never disagree about what is in the field.
      if (wasInternational && next.country !== undefined && next.country.iso2 !== selectedIso2) {
        if (!isCountryControlled) setUncontrolledCountry(next.country.iso2)
        onCountryChange?.(next.country.iso2)
      }

      report(formatted, next.country?.iso2 ?? selectedIso2)
    },
    [
      disabled,
      readOnly,
      text,
      selectedIso2,
      isCountryControlled,
      onCountryChange,
      report,
      maxLength,
    ],
  )

  useIsomorphicLayoutEffect(() => {
    const caret = pendingCaret.current
    if (caret === null) return
    pendingCaret.current = null
    const input = inputRef.current
    // Unreachable in practice: the caret is only ever set from a handler that
    // already has the element. Kept because the ref is nullable by type.
    /* v8 ignore next */
    if (input === null) return
    if (document.activeElement !== input) return
    try {
      input.setSelectionRange(caret, caret)
    } catch {
      /* the element does not support selection; nothing else to do */
    }
  }, [text])

  /**
   * Change country without discarding what has been typed.
   *
   * The national digits are the user's input; the calling code is ours. So the
   * digits survive and only the code around them changes — switching from the
   * UK to Ireland keeps `20 7123 4567` and re-reads it as an Irish number,
   * rather than clearing the field for a country the user did not mean to lose.
   */
  const selectCountry = useCallback(
    (iso2: string) => {
      if (disabled || readOnly) return
      const country = countryByISO2(iso2)
      if (country === undefined) return
      if (!isCountryControlled) setUncontrolledCountry(country.iso2)
      onCountryChange?.(country.iso2)

      const keptDigits = parsePhone(text, selectedIso2).national
      // Capped like every other write to `text`: a four-digit calling code is
      // three characters longer than `+1`, so switching country can push a
      // field that was exactly at the cap over it.
      const rebuilt = capText(
        formatPhone(
          {
            country,
            national: keptDigits,
            e164: keptDigits === '' ? '' : `+${country.dial}${keptDigits}`,
            possible: isPossible(country, keptDigits),
          },
          international,
        ),
        maxLength,
      )
      setText(rebuilt)
      report(rebuilt, country.iso2)
    },
    [
      disabled,
      readOnly,
      isCountryControlled,
      onCountryChange,
      text,
      selectedIso2,
      international,
      report,
      maxLength,
    ],
  )

  const [touched, setTouched] = useState(false)

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      onFocus?.(event)
    },
    [onFocus],
  )

  /**
   * Only emit blur when focus genuinely leaves the field. Moving between the
   * country select and the number box is still inside it, and a naive
   * per-element onBlur marks the field touched mid-interaction — firing
   * validation while the user is still choosing a country.
   */
  const handleBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      const next = event.relatedTarget
      if (next instanceof Node && event.currentTarget.contains(next)) return
      setTouched(true)
      onBlur?.(event)
    },
    [onBlur],
  )

  return {
    text,
    value: parsed.e164,
    details,
    country: parsed.country ?? countryByISO2(selectedIso2),
    countries,
    international,
    maxLength,
    disabled,
    readOnly,
    ids: {
      root: baseId,
      input: `${baseId}-input`,
      label: `${baseId}-label`,
      select: `${baseId}-country`,
      hidden: `${baseId}-value`,
      validity: `${baseId}-validity`,
    },
    inputRef,
    nameFor,
    flagFor,
    handleInputChange,
    clear,
    selectCountry,
    handleBlur,
    handleFocus,
    touched,
  }
}
