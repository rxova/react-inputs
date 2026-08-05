import { forwardRef, useCallback } from 'react'
import type { ChangeEvent, FocusEvent } from 'react'
import { useCurrencyInput } from './useCurrencyInput'
import type { CurrencyInputProps } from './types'

/**
 * A localized currency `<input>`. By default it formats as you type
 * (`formatMode="live"`) with a stable caret; `formatMode="blur"` shows a plain
 * number while focused instead. Emits a `number` (or `null`) through
 * `onChange`; the raw DOM event is available on `onNativeChange`.
 *
 * `ref` forwards to the underlying `<input>`. React 19 passes `ref` as a normal
 * prop; `forwardRef` keeps the React 18 peer working.
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput(props, ref) {
    const {
      // locale + formatting options (consumed by the hook)
      locale,
      language,
      country,
      currency,
      value,
      defaultValue,
      onChange,
      // Reading the deprecated prop is how it keeps working after the 0.2.0
      // migration; the component is what supports it.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      onValueChange,
      maximumFractionDigits,
      minimumFractionDigits,
      currencyDisplay,
      numberingSystem,
      allowNegative,
      step,
      transformRawValue,
      formatMode,
      // presentation / passthrough
      invalid,
      onFocus,
      onBlur,
      onNativeChange,
      onKeyDown,
      onBeforeInput,
      className,
      style,
      ...rest
    } = props

    const { inputProps, ref: hookRef } = useCurrencyInput({
      locale,
      language,
      country,
      currency,
      value,
      defaultValue,
      onChange,
      onValueChange,
      maximumFractionDigits,
      minimumFractionDigits,
      currencyDisplay,
      numberingSystem,
      allowNegative,
      step,
      transformRawValue,
      formatMode,
    })

    // Live mode manages the caret through the hook's ref, so point both the
    // hook's ref and any forwarded ref at the same node.
    const setRef = useCallback(
      (node: HTMLInputElement | null) => {
        hookRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      },
      [hookRef, ref],
    )

    return (
      <input
        {...rest}
        ref={setRef}
        className={className}
        style={style}
        type="text"
        inputMode="decimal"
        autoComplete={rest.autoComplete ?? 'off'}
        aria-invalid={invalid ? true : undefined}
        // Every component in the suite carries a `data-rx-<slug>-root` selector
        // hook. This one renders a single element, so the root *is* the input —
        // hence one attribute here where the composite components carry two.
        data-rx-currency-root=""
        data-invalid={invalid ? '' : undefined}
        value={inputProps.value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          inputProps.onChange(event)
          onNativeChange?.(event)
        }}
        onFocus={(event: FocusEvent<HTMLInputElement>) => {
          inputProps.onFocus(event)
          onFocus?.(event)
        }}
        onBlur={(event: FocusEvent<HTMLInputElement>) => {
          inputProps.onBlur(event)
          onBlur?.(event)
        }}
        onKeyDown={(event) => {
          inputProps.onKeyDown(event)
          onKeyDown?.(event)
        }}
        onBeforeInput={(event) => {
          inputProps.onBeforeInput(event)
          onBeforeInput?.(event)
        }}
      />
    )
  },
)
