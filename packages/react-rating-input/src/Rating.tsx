import { forwardRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { toPercent } from './math'
import { useRating } from './useRating'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'
import type { RatingIcon, RatingIconState, RatingProps } from './types'

const DEFAULT_STAR = (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
    <path d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.31l-5.8 3.05 1.1-6.46-4.69-4.58 6.49-.94L12 2.5z" />
  </svg>
)

// Only layout-critical declarations are inlined. Everything visual is a CSS
// custom property so there is no stylesheet to import (design pillar 3).
const rootStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--rx-rating-gap, 0.125rem)',
  position: 'relative',
  lineHeight: 1,
}

const itemStyle: CSSProperties = {
  // font-size drives the box so emoji, which size by font-size rather than
  // width/height, scale identically to SVG.
  fontSize: 'var(--rx-rating-size, 1.25rem)',
  lineHeight: 1,
  position: 'relative',
  display: 'inline-block',
  width: '1em',
  height: '1em',
  flexShrink: 0,
}

const layerBase: CSSProperties = {
  position: 'absolute',
  insetBlockStart: 0,
  // Logical property: RTL flips the fill origin with no extra branching.
  insetInlineStart: 0,
  height: '1em',
  display: 'block',
}

/** Locked to the item width so clipping *reveals* the icon instead of squashing it. */
const innerStyle: CSSProperties = {
  display: 'block',
  width: '1em',
  height: '1em',
}

function renderIcon(icon: RatingIcon | undefined, state: RatingIconState, fallback: ReactNode) {
  if (icon === undefined) return fallback
  return typeof icon === 'function' ? icon(state) : icon
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
 * component from a build that only imports `useRating`. That regressed the
 * headless entry from 902 B to 2.49 kB before the size budget caught it.
 */
export const Rating = /* @__PURE__ */ forwardRef<HTMLSpanElement, RatingProps>(
  function Rating(props, ref) {
    const {
      icon,
      emptyIcon,
      className,
      style,
      dir,
      label,
      formatLabel,
      formatOptionLabel,
      invalid,
      required,
      disabled = false,
      precision = 0,
      allowClear = true,
      'aria-describedby': describedBy,
    } = props

    const reducedMotion = usePrefersReducedMotion()
    const rating = useRating(props)
    const {
      max,
      value,
      displayValue,
      fills,
      steps,
      interactive,
      canChange,
      focusedValue,
      name,
      baseId,
      rootRef,
      commit,
      select,
      setHover,
      setFocused,
      handleBlur,
    } = rating

    // An explicit emptyIcon is the consumer's own artwork, so leave it alone.
    // The implicit one is the same glyph and must be dimmed to be legible as a
    // track — by filter, not colour, because colour is a no-op on emoji: they
    // render from a COLR font, so `color` and `fill` do nothing to them.
    const dimEmpty = emptyIcon === undefined
    const stepsPerItem = precision > 0 ? Math.max(1, Math.round(1 / precision)) : 1

    const accessibleName =
      label ?? formatLabel?.(value, max) ?? `${String(value)} out of ${String(max)}`

    // Roving tabindex. Browsers only collapse a radio group to a single tab stop
    // once one of its radios is checked; an unrated group leaves every radio
    // sequentially focusable, so a 5-star half-precision rating would cost a
    // keyboard user ten tab stops for one field.
    const tabbableStep = steps.includes(value) ? value : steps[0]

    const items = fills.map((fill, index) => {
      const active = canChange && displayValue > index
      const state: RatingIconState = {
        index,
        fill,
        filled: fill >= 1,
        empty: fill <= 0,
        partial: fill > 0 && fill < 1,
        active,
      }
      const filledNode = renderIcon(icon, state, DEFAULT_STAR)
      const emptyNode = renderIcon(emptyIcon ?? icon, state, DEFAULT_STAR)

      const itemSteps = interactive
        ? steps.filter((s) => s > index && s <= index + 1 + Number.EPSILON)
        : []
      const isFocusedItem =
        focusedValue !== null && focusedValue > index && focusedValue <= index + 1

      return (
        <span
          key={index}
          data-rx-rating-item={index}
          data-state={state.filled ? 'full' : state.empty ? 'empty' : 'partial'}
          {...(active ? { 'data-active': '' } : {})}
          style={{
            ...itemStyle,
            ...(isFocusedItem
              ? {
                  outline: 'var(--rx-rating-focus-ring, 2px solid Highlight)',
                  outlineOffset: 'var(--rx-rating-focus-ring-offset, 2px)',
                  borderRadius: 'var(--rx-rating-focus-ring-radius, 2px)',
                }
              : {}),
          }}
        >
          <span
            data-rx-rating-layer="empty"
            aria-hidden="true"
            style={{
              ...layerBase,
              width: '1em',
              color: 'var(--rx-rating-color-empty, #d8d8d8)',
              ...(dimEmpty
                ? { filter: 'var(--rx-rating-empty-filter, grayscale(1) opacity(0.35))' }
                : {}),
            }}
          >
            <span style={innerStyle}>{emptyNode}</span>
          </span>

          <span
            data-rx-rating-layer="fill"
            aria-hidden="true"
            style={{
              ...layerBase,
              width: `${String(toPercent(fill))}%`,
              overflow: 'hidden',
              color: active
                ? 'var(--rx-rating-color-hover, var(--rx-rating-color-filled, #f5a623))'
                : 'var(--rx-rating-color-filled, #f5a623)',
              transition: reducedMotion ? 'none' : 'width var(--rx-rating-transition, 120ms) ease',
            }}
          >
            <span style={innerStyle}>{filledNode}</span>
          </span>

          {itemSteps.map((stepValue, k) => {
            const width = 100 / stepsPerItem
            return (
              <label
                key={stepValue}
                style={{
                  position: 'absolute',
                  insetBlockStart: 0,
                  insetBlockEnd: 0,
                  insetInlineStart: `${String(k * width)}%`,
                  width: `${String(width)}%`,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
                onPointerEnter={(e) => {
                  if (e.pointerType === 'touch') return
                  setHover(stepValue)
                }}
              >
                <input
                  type="radio"
                  id={`${baseId}-${String(stepValue)}`}
                  name={name}
                  value={stepValue}
                  checked={value === stepValue}
                  tabIndex={stepValue === tabbableStep ? 0 : -1}
                  disabled={disabled}
                  required={required && stepValue === steps[0]}
                  aria-label={
                    formatOptionLabel?.(stepValue, max) ?? `${String(stepValue)} of ${String(max)}`
                  }
                  onChange={() => {
                    select(stepValue)
                  }}
                  onClick={(e) => {
                    // A checked radio fires click but not change, so the
                    // clear-on-reselect path has to live here.
                    if (value === stepValue) select(stepValue)
                    e.stopPropagation()
                  }}
                  onFocus={(e) => {
                    setFocused(e.currentTarget.matches(':focus-visible') ? stepValue : null)
                  }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    margin: 0,
                    opacity: 0,
                    cursor: 'inherit',
                  }}
                />
              </label>
            )
          })}
        </span>
      )
    })

    const shared = {
      ref: (node: HTMLSpanElement | null) => {
        rootRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      },
      className,
      dir,
      style: { ...rootStyle, ...style },
      'data-rx-rating-root': '',
      ...(disabled ? { 'data-disabled': '' } : {}),
      ...(invalid ? { 'data-invalid': '' } : {}),
    }

    if (!interactive) {
      return (
        <span {...shared} role="img" aria-label={accessibleName} data-readonly="">
          {items}
        </span>
      )
    }

    return (
      <span
        {...shared}
        // The same cursor the per-step labels show, so crossing the gap
        // between two icons doesn't flicker the pointer back to the default.
        // Consumer style still wins: `shared.style` spreads after it.
        style={{ cursor: disabled ? 'not-allowed' : 'pointer', ...shared.style }}
        role="radiogroup"
        aria-label={accessibleName}
        aria-required={required ? true : undefined}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        aria-disabled={disabled ? true : undefined}
        // Makes ref.current.focus() work for React Hook Form's setFocus() and
        // focus-first-error patterns. Not in the tab order itself.
        tabIndex={-1}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.altKey || e.ctrlKey || e.metaKey) return
          // Native radios already give us arrows, Home and End. These are the
          // shortcuts the platform does not provide.
          if (/^[0-9]$/.test(e.key)) {
            const digit = Number(e.key)
            if (digit > max) return
            e.preventDefault()
            commit(digit)
          } else if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault()
            if (allowClear) commit(0)
          }
        }}
        onPointerLeave={() => {
          setHover(null)
        }}
      >
        {items}
      </span>
    )
  },
)
