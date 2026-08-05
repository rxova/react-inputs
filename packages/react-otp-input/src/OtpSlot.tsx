import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { useOtpContext } from './OtpContext'
import type { OtpSlotState } from './types'

/** Class the root's injected stylesheet animates; kept here so the caret and its keyframes agree. */
export const CARET_CLASS = 'otp-slots-caret'

const slotStyle: CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  inlineSize: 'var(--rx-otp-slot-size, 2.5rem)',
  blockSize: 'var(--rx-otp-slot-size, 2.5rem)',
  fontSize: 'var(--rx-otp-font-size, 1.125rem)',
  lineHeight: 1,
  borderRadius: 'var(--rx-otp-radius, 0.5rem)',
  border: 'var(--rx-otp-border, 1px solid #d4d4d8)',
  color: 'var(--rx-otp-color, inherit)',
  background: 'var(--rx-otp-bg, transparent)',
  transition:
    'box-shadow var(--rx-otp-transition, 120ms), border-color var(--rx-otp-transition, 120ms)',
  // Keep the emitted digits upright and LTR even in an RTL field (bidi isolation).
  unicodeBidi: 'isolate',
}

const activeStyle: CSSProperties = {
  boxShadow: '0 0 0 var(--rx-otp-active-ring, 2px solid Highlight)',
  outline: 'var(--rx-otp-active-ring, 2px solid Highlight)',
  outlineOffset: '-1px',
}

const placeholderStyle: CSSProperties = { color: 'var(--rx-otp-placeholder-color, #a1a1aa)' }

const caretStyle: CSSProperties = {
  inlineSize: 'var(--rx-otp-caret-width, 1px)',
  blockSize: '1.1em',
  background: 'var(--rx-otp-caret-color, currentColor)',
  borderRadius: '1px',
}

export interface OtpSlotProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Which slot this renders, 0-based. */
  index: number
  /** Override the default glyph rendering entirely. */
  children?: ReactNode
}

/** Default glyph for a slot: its character, else the blinking caret, else a placeholder, else nothing. */
function defaultSlotContent(slot: OtpSlotState | undefined): ReactNode {
  if (slot === undefined) return null
  if (slot.char !== null) return slot.char
  if (slot.hasFakeCaret) {
    return <span data-rx-otp-caret="" className={CARET_CLASS} style={caretStyle} />
  }
  if (slot.placeholder !== null) return <span style={placeholderStyle}>{slot.placeholder}</span>
  return null
}

/**
 * One painted slot. Reads its state from context by `index`; it is `aria-hidden`
 * decoration (the real input carries the accessible value). Give it `children`
 * to take over the glyph, or let it render the character / placeholder / caret.
 */
export function OtpSlot({ index, children, style, ...rest }: OtpSlotProps) {
  const { slots, getSlotProps } = useOtpContext('OtpSlot')
  const slot = slots[index]
  const content = children ?? defaultSlotContent(slot)

  return (
    <div
      {...getSlotProps(index, rest)}
      style={{ ...slotStyle, ...(slot?.isActive ? activeStyle : {}), ...style }}
    >
      {content}
    </div>
  )
}
