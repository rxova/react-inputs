import { describe, expect, it } from 'vitest'

import { runVerify, steps, type StepResult, type VerifyStep } from './verify'

/**
 * Importing this module only works because verify guards its `process.exit`
 * behind an entrypoint check — without it, merely importing the gate would run
 * the whole gate and then kill the test process.
 *
 * The runner is injected, so these tests assert the ordering and short-circuit
 * behaviour without shelling out to pnpm or Turbo.
 */

const ok = (): StepResult => ({ status: 0 })

const record = (results: Record<string, number> = {}) => {
  const seen: string[] = []
  const run = (step: VerifyStep): StepResult => {
    seen.push(step.name)
    return { status: results[step.name] ?? 0 }
  }
  return { seen, run }
}

const noop = (): void => undefined
const silent = { log: noop, error: noop }

describe('verify gate', () => {
  it('declares at least one step', () => {
    expect(steps.length).toBeGreaterThan(0)
  })

  it('gives every step exactly one of `script` or `turbo`', () => {
    for (const step of steps) {
      // Destructured so the narrowing below is real rather than inferred from a
      // boolean the compiler cannot connect back to the property.
      const { script, turbo } = step
      expect(
        (script !== undefined) !== (turbo !== undefined),
        `${step.name} must declare script xor turbo`,
      ).toBe(true)
      if (turbo !== undefined) expect(turbo.length).toBeGreaterThan(0)
    }
  })

  it('gives every step a unique name', () => {
    const names = steps.map((step) => step.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('runs every step, in declared order, and returns 0', () => {
    const { seen, run } = record()

    expect(runVerify({ ...silent, runScript: run })).toBe(0)
    expect(seen).toEqual(steps.map((step) => step.name))
  })

  it('stops at the first failure and returns its status', () => {
    // The second step when there is one, else the first: proves the runner
    // stops mid-list rather than merely failing on the very first entry.
    const failing = steps[Math.min(1, steps.length - 1)]?.name ?? ''
    const { seen, run } = record({ [failing]: 3 })

    expect(runVerify({ ...silent, runScript: run })).toBe(3)
    // Nothing after the failure ran.
    expect(seen[seen.length - 1]).toBe(failing)
    expect(seen).toHaveLength(steps.findIndex((step) => step.name === failing) + 1)
  })

  it('names the failing step on stderr', () => {
    const failing = steps[0]?.name ?? ''
    const messages: string[] = []
    const { run } = record({ [failing]: 1 })

    runVerify({
      log: noop,
      error: (message: unknown) => messages.push(String(message)),
      runScript: run,
    })

    expect(messages.join('\n')).toContain(failing)
  })

  it('treats a null status as a failure rather than a pass', () => {
    // spawnSync reports status: null when the child is killed by a signal.
    const run = (): StepResult => ({ status: null })

    expect(runVerify({ ...silent, runScript: run })).not.toBe(0)
  })

  it('audits dependencies before anything expensive', () => {
    // The audit is cheap and the most likely thing to newly fail, so it leads.
    expect(steps[0]?.script).toBe('audit:check')
  })

  // The packaged llms.txt files are read by nobody in this repo, so a step that
  // silently fell out of the gate would go unnoticed until a published tarball
  // documented an API that no longer exists.
  it('checks the packaged llms.txt files', () => {
    expect(steps.some((step) => step.script === 'check:llms')).toBe(true)
  })

  it('blocks a release without current manual assistive-technology evidence', () => {
    expect(steps.some((step) => step.script === 'check:a11y-manual')).toBe(true)
  })

  it('keeps e2e out of the gate', () => {
    const ids = steps
      .flatMap((step) => (step.turbo !== undefined ? [...step.turbo] : [step.script]))
      .filter((id): id is string => id !== undefined)
    expect(ids.some((id) => id.includes('e2e'))).toBe(false)
  })

  it('passes a trivially empty run', () => {
    expect(runVerify({ ...silent, runScript: ok })).toBe(0)
  })
})
