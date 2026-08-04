'use client'

// Meta-package: re-exports every rxova input component so consumers can
// `npm i @rxova/react-inputs` and import the whole suite from one entry point.
export * from '@rxova/react-intl-currency-input'
export * from '@rxova/react-rating-input'
export * from '@rxova/react-otp-input'
export * from '@rxova/react-phone-input'
export * from '@rxova/react-password-input'

/*
 * The remaining four export components and hooks by name rather than with a
 * star, because their *pure helpers* collide across packages:
 *
 *   date + time  ->  toISO, fromISO, compareISO, withinRange
 *   tags + file  ->  attempt, attemptAll
 *
 * Those names are correct in their own package and meaningless once merged into
 * one namespace — `toISO` would have to mean both a date and a time. A star
 * export makes them ambiguous (silently absent at runtime under ESM, an error
 * under some bundlers), so the helpers stay where they are: import them from
 * `@rxova/react-date-input` and friends directly. The widgets, which are what
 * this package exists to bundle, all come through.
 */
export { DateInput, useDateInput } from '@rxova/react-date-input'
export type {
  DateInputProps,
  DateSegment,
  DateWarning,
  DateWarningCode,
  UseDateInputOptions,
  UseDateInputResult,
} from '@rxova/react-date-input'

export { TimeInput, useTimeInput } from '@rxova/react-time-input'
export type {
  TimeInputProps,
  TimeSegment,
  TimeWarning,
  TimeWarningCode,
  UseTimeInputOptions,
  UseTimeInputResult,
} from '@rxova/react-time-input'

export { TagsInput, useTagsInput } from '@rxova/react-tags-input'
export type {
  TagAttempt,
  TagRejection,
  TagsInputProps,
  TagsWarning,
  TagsWarningCode,
  UseTagsInputOptions,
  UseTagsInputResult,
} from '@rxova/react-tags-input'

export { FileInput, useFileInput } from '@rxova/react-file-input'
export type {
  FileAttempt,
  FileEntry,
  FileEntryState,
  FileInputProps,
  FileRejection,
  FileWarning,
  FileWarningCode,
  UseFileInputOptions,
  UseFileInputResult,
} from '@rxova/react-file-input'
