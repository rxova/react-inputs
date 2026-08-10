'use client'

export { DurationInput } from './DurationInput'
export { DEFAULT_UNITS, useDurationInput } from './useDurationInput'
export type { UseDurationInputOptions, UseDurationInputResult } from './useDurationInput'
/*
 * The pure helpers are named for durations rather than reusing the suite's
 * `toISO` / `fromISO` / `compareISO` / `withinRange`.
 *
 * Those four already collide between the date and time packages, which is why
 * `@rxova/react-inputs` cannot re-export them. Adding a third set would make a
 * fixable problem permanent; these names are unambiguous in one namespace, so
 * the meta-package can export them like everything else.
 */
export {
  UNIT_ORDER,
  UNIT_SECONDS,
  compareDurations,
  durationToSeconds,
  fromISODuration,
  parseISODuration,
  secondsToDuration,
  toISODuration,
  toSeconds,
  withinDurationRange,
} from './duration'
export type { DurationParseResult, DurationParts, DurationUnit } from './duration'
export { durationPieces, unitName, unitSuffix } from './segments'
export type { DurationPiece } from './segments'
export type {
  DurationInputProps,
  DurationPlaceholders,
  DurationSegmentState,
  DurationUnitLabels,
  DurationWarning,
  DurationWarningCode,
} from './types'
