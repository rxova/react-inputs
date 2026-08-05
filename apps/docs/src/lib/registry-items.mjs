// The registry's contents, assembled from the real source files.
//
// `?raw` is the point: what ships to a consumer is byte-for-byte the file in
// src/registry/, which `astro check` typechecks against the actual published
// packages on every build. A registry that inlined its source as JSON string
// literals would be the only code in the repo nothing compiled — and it would
// rot the first time a prop was renamed, silently, in every project that had
// already copied it.

import { registryItem } from './registry.mjs'

import otpFieldTsx from '../registry/otp-field.tsx?raw'
import otpFieldCss from '../registry/otp-field.css?raw'
import ratingFieldTsx from '../registry/rating-field.tsx?raw'
import ratingFieldCss from '../registry/rating-field.css?raw'
import currencyFieldTsx from '../registry/currency-field.tsx?raw'
import currencyFieldCss from '../registry/currency-field.css?raw'

export const items = [
  registryItem({
    name: 'currency-field',
    title: 'Currency field',
    description:
      'A labelled currency input that is correct in every locale — grouping, symbol placement and decimal rules come from Intl, and the caret stays put while the value reformats.',
    dependency: '@rxova/react-intl-currency-input',
    tsx: currencyFieldTsx,
    css: currencyFieldCss,
  }),
  registryItem({
    name: 'otp-field',
    title: 'OTP field',
    description:
      'A labelled one-time-code field. One real input behind the slots, so paste, SMS autofill, IME and password managers keep working.',
    dependency: '@rxova/react-otp-input',
    tsx: otpFieldTsx,
    css: otpFieldCss,
  }),
  registryItem({
    name: 'rating-field',
    title: 'Rating field',
    description:
      'A labelled rating field at any precision. Interactive it is a real radiogroup; read-only it is an image with a label.',
    dependency: '@rxova/react-rating-input',
    tsx: ratingFieldTsx,
    css: ratingFieldCss,
  }),
]

export const itemsByName = new Map(items.map((item) => [item.name, item]))
