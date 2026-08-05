import type { CSSProperties, HTMLAttributes } from 'react'

const groupStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--rx-otp-gap, 0.5rem)',
}

/** A styling wrapper around a run of slots — the visual `123 · 456` grouping. Inert otherwise. */
export function OtpGroup({ style, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div data-rx-otp-group="" style={{ ...groupStyle, ...style }} {...rest} />
}
