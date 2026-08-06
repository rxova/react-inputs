import { describe, expect, it } from 'vitest'

import { registryItems } from './registry-items.mjs'

const component = {
  slug: 'otp',
  label: 'OTP',
  name: '@rxova/react-otp-input',
  description: 'One-time-code input.',
}

const sources = () =>
  new Map([
    ['otp-field.tsx', 'export function OtpField() {}'],
    ['otp-field.css', '.rx-field {}'],
  ])

describe('registryItems', () => {
  it('derives an item from a component and its paired sources', () => {
    const [item] = registryItems([component], sources())

    expect(item).toMatchObject({
      name: 'otp-field',
      title: 'OTP field',
      description: 'One-time-code input.',
      dependencies: ['@rxova/react-otp-input'],
    })
    expect(item.files).toHaveLength(2)
  })

  it('fails when either half of a registry item is absent', () => {
    expect(() => registryItems([component], new Map([['otp-field.tsx', 'export {}']]))).toThrow(
      'otp-field.css',
    )
  })

  it('fails on an orphan instead of publishing an undiscoverable item', () => {
    const withOrphan = sources()
    withOrphan.set('ghost-field.tsx', 'export {}')
    expect(() => registryItems([component], withOrphan)).toThrow('ghost-field.tsx')
  })
})
