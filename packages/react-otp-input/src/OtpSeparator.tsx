import type { CSSProperties, HTMLAttributes } from 'react'

const separatorStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  color: 'var(--rx-otp-separator-color, #a1a1aa)',
  userSelect: 'none',
}

/** Inert decoration between groups (a dash, dot, or any node). `aria-hidden`: the value lives in the input. */
export function OtpSeparator({ children = '-', style, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-rx-otp-separator=""
      aria-hidden="true"
      style={{ ...separatorStyle, ...style }}
      {...rest}
    >
      {children}
    </span>
  )
}
