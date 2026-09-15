import { describe, expect, it } from 'vitest'

import {
  importableReactPackages,
  installWithRetries,
  npmFailureReason,
  parsePublishedPackages,
  type PublishedPackage,
  waitForRegistry,
} from './post-publish-smoke'

/** A clock that only moves when the code under test sleeps, and keeps what it logs. */
function fakeClock() {
  let time = 0
  const sleeps: number[] = []
  const logged: string[] = []
  return {
    sleeps,
    logged,
    now: () => time,
    sleep: (milliseconds: number) => {
      sleeps.push(milliseconds)
      time += milliseconds
    },
    log: (message: string) => {
      logged.push(message)
    },
  }
}

const otp: PublishedPackage = { name: '@rxova/react-otp-input', version: '1.0.3' }
const file: PublishedPackage = { name: '@rxova/react-file-input', version: '1.1.0' }

/** Fails like execFileSync does: the child's stderr rides on the thrown error. */
const npmError = (stderr: string) =>
  Object.assign(new Error('Command failed: npm install'), { stderr: Buffer.from(stderr) })

describe('post-publish smoke input', () => {
  it('accepts the changesets/action output shape', () => {
    expect(
      parsePublishedPackages(
        JSON.stringify([
          { name: '@rxova/react-otp-input', version: '1.2.3' },
          { name: '@rxova/codemod', version: '0.2.0' },
        ]),
      ),
    ).toEqual([
      { name: '@rxova/react-otp-input', version: '1.2.3' },
      { name: '@rxova/codemod', version: '0.2.0' },
    ])
  })

  it('rejects empty, malformed and out-of-scope output', () => {
    expect(() => parsePublishedPackages('[]')).toThrow('no published packages')
    expect(() => parsePublishedPackages('not json')).toThrow()
    expect(() =>
      parsePublishedPackages(JSON.stringify([{ name: 'left-pad', version: '1.0.0' }])),
    ).toThrow('invalid published package')
  })

  it('imports only the React packages after installation', () => {
    const packages = parsePublishedPackages(
      JSON.stringify([
        { name: '@rxova/react-inputs', version: '1.0.0' },
        { name: '@rxova/codemod', version: '1.0.0' },
      ]),
    )
    expect(importableReactPackages(packages).map(({ name }) => name)).toEqual([
      '@rxova/react-inputs',
    ])
  })
})

describe('waiting for the registry', () => {
  it('outlasts the minutes npm can take to list a fresh version', () => {
    // The 2026-09-15 release: npm listed file-input 1.1.0 almost 3 minutes
    // after publish, well past the old 30s of install retries.
    const clock = fakeClock()
    const listedAt = { [otp.name]: 40_000, [file.name]: 170_000 }
    waitForRegistry([otp, file], {
      isPublished: ({ name }) => clock.now() >= (listedAt[name] ?? Infinity),
      ...clock,
    })
    expect(clock.now()).toBeGreaterThanOrEqual(170_000)
  })

  it('backs off from 5s to a 30s cap and polls only what is still missing', () => {
    const clock = fakeClock()
    const asked: string[] = []
    waitForRegistry([otp, file], {
      isPublished: ({ name }) => {
        asked.push(name)
        return name === otp.name || clock.now() >= 100_000
      },
      ...clock,
    })
    expect(clock.sleeps).toEqual([5_000, 10_000, 20_000, 30_000, 30_000, 30_000])
    expect(asked.filter((name) => name === otp.name)).toHaveLength(1)
  })

  it('returns without sleeping when npm already serves everything', () => {
    const clock = fakeClock()
    waitForRegistry([otp, file], { isPublished: () => true, ...clock })
    expect(clock.sleeps).toEqual([])
  })

  it('gives up at the deadline, naming what never arrived', () => {
    const clock = fakeClock()
    expect(() => {
      waitForRegistry([otp, file], {
        isPublished: ({ name }) => name === otp.name,
        ...clock,
        deadlineMs: 60_000,
      })
    }).toThrow('npm still does not serve @rxova/react-file-input@1.1.0 after 60s')
    // The last wait is clipped so the deadline is not overshot.
    expect(clock.sleeps).toEqual([5_000, 10_000, 20_000, 25_000])
  })
})

describe('installing from the registry', () => {
  it("retries a failed install and prints npm's error each time", () => {
    const clock = fakeClock()
    let calls = 0
    installWithRetries(
      () => {
        calls += 1
        if (calls === 1)
          throw npmError('npm error code ETARGET\nnpm error notarget No matching version')
      },
      { sleep: clock.sleep, log: clock.log },
    )
    expect(calls).toBe(2)
    expect(clock.logged.join('\n')).toContain('ETARGET')
  })

  it("fails with npm's error once the attempts run out", () => {
    const clock = fakeClock()
    expect(() => {
      installWithRetries(
        () => {
          throw npmError('npm error code ERESOLVE')
        },
        { attempts: 2, sleep: clock.sleep, log: clock.log },
      )
    }).toThrow(/did not install from npm:\nnpm error code ERESOLVE/)
    expect(clock.sleeps).toEqual([10_000])
  })

  it('falls back to the error message when npm printed nothing', () => {
    expect(npmFailureReason(npmError(''))).toBe('Command failed: npm install')
    expect(npmFailureReason('spawn npm ENOENT')).toBe('spawn npm ENOENT')
  })
})
