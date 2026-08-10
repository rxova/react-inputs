'use client'

export { MeasurementInput } from './MeasurementInput'
export { DEFAULT_MEASUREMENT_UNITS, useMeasurementInput } from './useMeasurementInput'
export type { UseMeasurementInputOptions, UseMeasurementInputResult } from './useMeasurementInput'
/*
 * The pure helpers are named so they survive being merged into one namespace by
 * `@rxova/react-inputs`.
 *
 * That is not a hypothetical: `toISO` / `fromISO` / `compareISO` / `withinRange`
 * already collide between the date and time packages, and the meta-package has
 * to export those four by hand and leave them out. So `DEFAULT_MEASUREMENT_UNITS`
 * rather than `DEFAULT_UNITS`, and `compareMeasurements` rather than `compare` —
 * unambiguous in one namespace, at the cost of a few characters here.
 *
 * `unitSuffix` and `unitName` are deliberately *not* exported for the same
 * reason: every segmented field in the suite would want those names. A custom
 * renderer gets the suffixes from `measurementPieces` and the accessible names
 * from the hook's `nameFor`.
 */
export {
  MEASUREMENT_UNITS,
  compareMeasurements,
  convert,
  dimensionOf,
  formatMeasurement,
  fromMeasurement,
  isCarryPair,
  isMeasurementUnit,
  parseMeasurement,
  ratioBetween,
  toBaseUnit,
  toMeasurement,
  withinMeasurementRange,
} from './units'
export type { Dimension, MeasurementParseResult, MeasurementParts, MeasurementUnit } from './units'
export { measurementPieces } from './segments'
export type { MeasurementPiece } from './segments'
export type {
  MeasurementInputProps,
  MeasurementPlaceholders,
  MeasurementSegmentState,
  MeasurementUnitLabels,
  MeasurementWarning,
  MeasurementWarningCode,
} from './types'
