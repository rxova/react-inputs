import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { gitDiff } from './git-diff'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** A repo where `main` moved on after `feature` branched off it. */
function repo() {
  const cwd = mkdtempSync(join(tmpdir(), 'rxova-diff-'))
  roots.push(cwd)
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' })
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'test')
  writeFileSync(join(cwd, 'gone.md'), 'x')
  git('add', '.')
  git('commit', '-qm', 'base')
  git('checkout', '-qb', 'feature')
  writeFileSync(join(cwd, 'added.ts'), 'x')
  git('rm', '-q', 'gone.md')
  git('add', '.')
  git('commit', '-qm', 'feature')
  git('checkout', '-q', 'main')
  writeFileSync(join(cwd, 'main-only.ts'), 'x')
  git('add', '.')
  git('commit', '-qm', 'main moves on')
  return cwd
}

describe('gitDiff', () => {
  it('diffs base...head, so changes made on the base meanwhile are left out', () => {
    expect(gitDiff('main', 'feature', { cwd: repo() }).sort()).toEqual(['added.ts', 'gone.md'])
  })

  it('lists both ends of a rename', () => {
    // gone.md and added.ts hold the same bytes, so git would pair them as a rename.
    expect(gitDiff('main', 'feature', { cwd: repo() })).toContain('gone.md')
  })

  it('leaves out deleted paths with `existing`', () => {
    expect(gitDiff('main', 'feature', { cwd: repo(), existing: true })).toEqual(['added.ts'])
  })

  it('refuses a revision git would read as an option', () => {
    expect(() => gitDiff('--output=x', 'feature')).toThrow(/dash/)
  })
})
