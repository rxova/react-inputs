import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'
import type { CSSProperties, ReactNode, Ref } from 'react'
import { spatialLayout } from './core'
import type { OtpInputProps } from './types'
import { useOtpInput } from './useOtpInput'
import { useWebOTP } from './useWebOTP'
import { OtpContext } from './OtpContext'
import { CARET_CLASS, OtpSlot } from './OtpSlot'
import type { OtpSlotProps } from './OtpSlot'
import { OtpGroup } from './OtpGroup'

const rootStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--rx-otp-gap, 0.5rem)',
  lineHeight: 1,
}

// The real input, laid over the whole row. Its text and caret are made
// invisible by getInputProps(); letterSpacing/textIndent are set imperatively
// below because they depend on the *measured* slot geometry, not on any value
// known at render — keeping them out of the JSX also keeps SSR markup free of
// client-only pixel numbers that would trip hydration.
const inputOverlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  inlineSize: '100%',
  blockSize: '100%',
  margin: 0,
  padding: 0,
  border: 0,
  fontFamily: 'var(--rx-otp-font, ui-monospace, SFMono-Regular, Menlo, monospace)',
  fontSize: 'var(--rx-otp-font-size, 1.125rem)',
  textAlign: 'left',
  cursor: 'text',
}

const CARET_KEYFRAMES = 'rx-otp-blink'
const CARET_STYLE_ID = 'rx-otp-caret-style'

/**
 * Inject the caret blink keyframes once per document (CSP-noncable). Reduced
 * motion is honoured in the CSS itself. Also hides the input's `::selection`:
 * a full field keeps a one-character selection under the caret (that's what
 * makes type-to-overwrite work), and the native highlight would otherwise
 * paint a box over the transparent overlay. iOS cannot fully hide it — which
 * is exactly why that platform is forced onto the 'crush' interaction.
 */
function injectCaretStyles(nonce: string | undefined): void {
  /* v8 ignore next -- SSR guard; the injector only runs in a layout effect (client) */
  if (typeof document === 'undefined') return
  if (document.getElementById(CARET_STYLE_ID)) return
  const el = document.createElement('style')
  el.id = CARET_STYLE_ID
  if (nonce) el.nonce = nonce
  el.textContent =
    `@keyframes ${CARET_KEYFRAMES}{0%,49%{opacity:1}50%,100%{opacity:0}}` +
    `.${CARET_CLASS}{animation:${CARET_KEYFRAMES} 1s steps(1) infinite}` +
    `@media (prefers-reduced-motion:reduce){.${CARET_CLASS}{animation:none}}` +
    `[data-rx-otp-input]::selection{background:transparent;color:transparent}`
  document.head.appendChild(el)
}

let measureCanvas: HTMLCanvasElement | null = null
/** Advance width of one monospace digit in `font`, for the spatial letter-spacing math. */
function measureCharWidth(font: string): number {
  /* v8 ignore next -- only runs client-side, where document exists */
  if (typeof document === 'undefined') return 0
  measureCanvas ??= document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  /* v8 ignore next -- 2d context is universally available in a real browser */
  if (!ctx) return 0
  ctx.font = font
  return ctx.measureText('0').width
}

/** iOS is the one platform that cannot fully hide `::selection`; it forces the 'crush' fallback. */
function detectIOS(): boolean {
  /* v8 ignore next -- getSnapshot only runs client-side; server uses the false snapshot */
  if (typeof navigator === 'undefined') return false
  return (
    /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

const noopSubscribe = (): (() => void) => () => undefined

/**
 * The platform never changes at runtime, so this is a read, not a subscription
 * — `useSyncExternalStore` with a `false` server snapshot keeps SSR markup on
 * the spatial default and lets the client correct to 'crush' on iOS without a
 * setState-in-effect or a hydration mismatch.
 */
function useIsIOS(): boolean {
  return useSyncExternalStore(noopSubscribe, detectIOS, () => false)
}

/** Collect the `index` props of every `<OtpSlot>` in the child tree (dev validation only). */
function collectSlotIndices(node: ReactNode, acc: number[]): void {
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return
    if (child.type === OtpSlot) {
      const { index } = child.props as OtpSlotProps
      if (typeof index === 'number') acc.push(index)
    }
    const nested = (child.props as { children?: ReactNode }).children
    if (nested !== undefined) collectSlotIndices(nested, acc)
  })
}

/** Warn (dev only) when declared slot indices don't tile `[0, length)` exactly once, or the field is unlabelled. */
function runDevChecks(children: ReactNode, length: number, labelled: boolean): void {
  const indices: number[] = []
  collectSlotIndices(children, indices)
  if (indices.length > 0) {
    const seen = new Set<number>()
    let bad = indices.length !== length
    for (const i of indices) {
      if (i < 0 || i >= length || seen.has(i)) bad = true
      seen.add(i)
    }
    if (bad) {
      // eslint-disable-next-line no-console
      console.warn(
        `[react-otp-input] <OtpSlot> indices must tile [0, ${String(length)}) exactly once. Rendering what was given.`,
      )
    }
  }
  if (!labelled) {
    // eslint-disable-next-line no-console
    console.warn(
      '[react-otp-input] <OtpInput> has no accessible name. Pass `label` or `aria-label`.',
    )
  }
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value)
  else if (ref) (ref as { current: T | null }).current = value
}

/**
 * The single-input, real-slots OTP field. `forwardRef` targets the underlying
 * `<input>` — the focusable element — so `ref.current.focus()` / `.select()`,
 * reading `.value`, and React Hook Form's `setFocus()` all work (the `inputRef`
 * prop is an explicit alias for the same node). The `@__PURE__` annotation lets a
 * bundle that imports only `useOtpInput` drop this component and its slot
 * renderers — the seam the size budget guards.
 */
export const OtpInput = /* @__PURE__ */ forwardRef<HTMLInputElement, OtpInputProps>(
  function OtpInput(props, ref) {
    const {
      children,
      render,
      webOTP = false,
      slotInteraction = 'spatial',
      nonce,
      className,
      style,
      invalid,
      disabled,
      label,
      'aria-label': ariaLabel,
    } = props

    // The forwarded ref and the `inputRef` prop both address the inner input, so
    // merge them and hand the result to the hook, which wires the input's ref.
    const mergedInputRef = useCallback(
      (node: HTMLInputElement | null) => {
        assignRef(ref, node)
        assignRef(props.inputRef, node)
      },
      [ref, props.inputRef],
    )
    const otp = useOtpInput({ ...props, inputRef: mergedInputRef })
    useWebOTP({ enabled: webOTP, onReceive: otp.setValue })

    const isIOS = useIsIOS()
    const resolvedInteraction = slotInteraction === 'crush' || isIOS ? 'crush' : 'spatial'

    // Internal only: measures slot geometry for the spatial layout. Not forwarded.
    const rootRef = useRef<HTMLDivElement | null>(null)
    const setRootRef = useCallback((node: HTMLDivElement | null) => {
      rootRef.current = node
    }, [])

    useIsomorphicLayoutEffect(() => {
      injectCaretStyles(nonce)
    }, [nonce])

    // Lay the input's characters at the true slot pitch (spatial) so a tap lands
    // the caret on the slot under the finger, or collapse them to a thin column
    // (crush) to match input-otp where spatial can't be safe. The input and slot
    // nodes are read off the root ref (not the hook), so this is plain imperative
    // DOM styling that depends on measured geometry.
    useIsomorphicLayoutEffect(() => {
      const root = rootRef.current
      const input = root?.querySelector<HTMLInputElement>('[data-rx-otp-input]')
      /* v8 ignore next -- input is always rendered; defensive guard */
      if (!input) return
      if (resolvedInteraction === 'crush') {
        input.style.letterSpacing = '-1em'
        input.style.textIndent = '0px'
        input.style.textAlign = 'center'
        return
      }
      const firstSlot = root?.querySelector<HTMLElement>('[data-rx-otp-slot]')
      /* v8 ignore next -- a slot is always rendered; defensive guard */
      if (!firstSlot) return
      const slotWidth = firstSlot.getBoundingClientRect().width
      const gap = parseFloat(getComputedStyle(firstSlot.parentElement ?? firstSlot).gap) || 0
      const layout = spatialLayout(slotWidth, gap, measureCharWidth(getComputedStyle(input).font))
      /* v8 ignore next -- unmeasurable geometry (0-width) can't occur in a laid-out browser */
      if (!layout) return
      input.style.letterSpacing = `${String(layout.letterSpacing)}px`
      input.style.textIndent = `${String(layout.textIndent)}px`
      input.style.textAlign = 'left'
    }, [resolvedInteraction, otp.length, otp.value])

    if (process.env.NODE_ENV !== 'production') {
      runDevChecks(children, otp.length, Boolean(label ?? ariaLabel))
    }

    const contextValue = useMemo(
      () => ({ slots: otp.slots, getSlotProps: otp.getSlotProps }),
      [otp.slots, otp.getSlotProps],
    )

    let body: ReactNode
    if (children !== undefined && children !== null) {
      body = children
    } else if (render) {
      body = render({
        slots: otp.slots,
        value: otp.value,
        isComplete: otp.isComplete,
        isFocused: otp.isFocused,
      })
    } else {
      body = (
        <OtpGroup>
          {otp.slots.map((slot) => (
            <OtpSlot key={slot.index} index={slot.index} />
          ))}
        </OtpGroup>
      )
    }

    const containerProps = otp.getContainerProps({ style: { ...rootStyle, ...style } })

    return (
      <OtpContext.Provider value={contextValue}>
        <div
          {...containerProps}
          ref={setRootRef}
          className={className}
          {...(disabled ? { 'data-disabled': '' } : {})}
          {...(invalid ? { 'data-invalid': '' } : {})}
        >
          {body}
          <input {...otp.getInputProps({ style: inputOverlayStyle })} />
        </div>
      </OtpContext.Provider>
    )
  },
)
