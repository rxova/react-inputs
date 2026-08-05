'use client'

// Meta-package: re-exports every rxova input component so consumers can
// `npm i @rxova/react-inputs` and import the whole suite from one entry point.
export * from '@rxova/react-intl-currency-input'
export * from '@rxova/react-rating-input'
export * from '@rxova/react-otp-input'
export * from '@rxova/react-phone-input'
export * from '@rxova/react-password-input'

/*
 * The remaining four export by name rather than with a star, because exactly six
 * of their *pure helpers* collide across packages:
 *
 *   date + time  ->  toISO, fromISO, compareISO, withinRange
 *   tags + file  ->  attempt, attemptAll
 *
 * Those names are correct in their own package and meaningless once merged into
 * one namespace — `toISO` would have to mean both a date and a time. A star
 * export makes them ambiguous (silently absent at runtime under ESM, an error
 * under some bundlers), so those six stay where they are: import them from
 * `@rxova/react-date-input` and friends directly.
 *
 * Everything else comes through, including every type. The list below used to be
 * hand-picked, which made it wrong in a way nothing reported: `onPartsChange` is
 * typed `(parts: DateParts) => void` and was re-exported, while `DateParts`
 * itself was not — so a consumer of this package could see the prop and had no
 * way to name its argument. `meta-package.test.ts` now fails on any export that
 * is not either re-exported here or one of the six collisions.
 */
export {
  DateInput,
  useDateInput,
  MAX_YEAR,
  MIN_YEAR,
  datePieces,
  daysInMonth,
  isLeapYear,
  monthNames,
  segmentOrder,
} from '@rxova/react-date-input'
export type {
  DateInputProps,
  DateParts,
  DatePiece,
  DatePlaceholders,
  DateSegment,
  DateSegmentLabels,
  DateSegmentState,
  DateWarning,
  DateWarningCode,
  UseDateInputOptions,
  UseDateInputResult,
} from '@rxova/react-date-input'

export {
  TimeInput,
  useTimeInput,
  AM,
  PM,
  dayPeriodNames,
  fromDisplayHour,
  timePieces,
  toDayPeriod,
  toDisplayHour,
  usesHour12,
} from '@rxova/react-time-input'
export type {
  TimeInputProps,
  TimeParts,
  TimePiece,
  TimePlaceholders,
  TimeSegment,
  TimeSegmentLabels,
  TimeSegmentState,
  TimeWarning,
  TimeWarningCode,
  UseTimeInputOptions,
  UseTimeInputResult,
} from '@rxova/react-time-input'

export {
  TagsInput,
  useTagsInput,
  comparable,
  contains,
  sanitize,
  splitPasted,
} from '@rxova/react-tags-input'
export type {
  TagAttempt,
  TagRejection,
  TagRules,
  TagState,
  TagsInputProps,
  TagsWarning,
  TagsWarningCode,
  UseTagsInputOptions,
  UseTagsInputResult,
} from '@rxova/react-tags-input'

export {
  FileInput,
  useFileInput,
  describeRejection,
  extensionOf,
  fileKey,
  formatBytes,
  isPreviewable,
  matchesAccept,
} from '@rxova/react-file-input'
export type {
  FileAttempt,
  FileEntry,
  FileEntryState,
  FileInputProps,
  FileRejection,
  FileRules,
  FileWarning,
  FileWarningCode,
  UseFileInputOptions,
  UseFileInputResult,
} from '@rxova/react-file-input'
