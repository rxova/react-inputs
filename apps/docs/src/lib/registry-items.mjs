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
import passwordFieldTsx from '../registry/password-field.tsx?raw'
import passwordFieldCss from '../registry/password-field.css?raw'
import phoneFieldTsx from '../registry/phone-field.tsx?raw'
import phoneFieldCss from '../registry/phone-field.css?raw'
import dateFieldTsx from '../registry/date-field.tsx?raw'
import dateFieldCss from '../registry/date-field.css?raw'
import timeFieldTsx from '../registry/time-field.tsx?raw'
import timeFieldCss from '../registry/time-field.css?raw'
import tagsFieldTsx from '../registry/tags-field.tsx?raw'
import tagsFieldCss from '../registry/tags-field.css?raw'
import fileFieldTsx from '../registry/file-field.tsx?raw'
import fileFieldCss from '../registry/file-field.css?raw'

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
    name: 'date-field',
    title: 'Date field',
    description:
      'A labelled date field: segmented, locale-ordered, keyboard-first, with no calendar popup. The value is a YYYY-MM-DD string, never a Date.',
    dependency: '@rxova/react-date-input',
    tsx: dateFieldTsx,
    css: dateFieldCss,
  }),
  registryItem({
    name: 'file-field',
    title: 'File field',
    description:
      'A labelled file field with a drop zone, accept and size rules, deduplication, and preview URLs it revokes itself. It never uploads anything.',
    dependency: '@rxova/react-file-input',
    tsx: fileFieldTsx,
    css: fileFieldCss,
  }),
  registryItem({
    name: 'password-field',
    title: 'Password field',
    description:
      'A labelled password field with a reveal toggle that keeps the caret, a Caps Lock warning, a requirements checklist and a 1 kB strength meter.',
    dependency: '@rxova/react-password-input',
    tsx: passwordFieldTsx,
    css: passwordFieldCss,
  }),
  registryItem({
    name: 'phone-field',
    title: 'Phone field',
    description:
      'A labelled international phone field. Country names from Intl, flags from Unicode, and E.164 in and out — never the formatted display text.',
    dependency: '@rxova/react-phone-input',
    tsx: phoneFieldTsx,
    css: phoneFieldCss,
  }),
  registryItem({
    name: 'tags-field',
    title: 'Tags field',
    description:
      'A labelled tags field with delimiters, paste splitting and a real roving tab order — focus never lands on the body after a removal.',
    dependency: '@rxova/react-tags-input',
    tsx: tagsFieldTsx,
    css: tagsFieldCss,
  }),
  registryItem({
    name: 'time-field',
    title: 'Time field',
    description:
      'A labelled time field: segmented, 12- or 24-hour by locale, with no clock popup. The value is always canonical 24-hour HH:mm.',
    dependency: '@rxova/react-time-input',
    tsx: timeFieldTsx,
    css: timeFieldCss,
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
