import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

import { checkReadmeLinks, collectLinks, formatFailures } from './check-readme-links.mjs'

/**
 * Fixture trees, not the real repo: the checker's whole job is to disagree with
 * a dist that is missing something, and the real dist is (by construction) never
 * missing anything once the build passes. Every case here builds the smallest
 * repo/dist pair that exercises one rule.
 *
 * The rules under test are the ones that were load-bearing when this was
 * written: the route→file mapping (directory index, flat .html, redirect stub),
 * what counts as a link worth checking, and anchor resolution. Getting any of
 * them subtly wrong makes the checker pass vacuously, which is worse than not
 * having it — a green build that checked nothing is what let the original 404s
 * ship.
 */

const scriptPath = resolve(dirname(fileURLToPath(import.meta.url)), './check-readme-links.mjs')

const tempRoots = []

afterAll(async () => {
  await Promise.all(tempRoots.map((path) => rm(path, { recursive: true, force: true })))
})

const writeFiles = async (root, files) => {
  for (const [relativePath, content] of Object.entries(files)) {
    const target = join(root, relativePath)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content, 'utf8')
  }
}

/** A repo/dist pair under a throwaway directory. */
const fixture = async ({ repo = {}, dist = {} } = {}) => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'check-readme-links-'))
  tempRoots.push(tempRoot)

  const repoRoot = join(tempRoot, 'repo')
  const distDir = join(tempRoot, 'dist')
  await mkdir(repoRoot, { recursive: true })
  await mkdir(distDir, { recursive: true })
  await writeFiles(repoRoot, repo)
  await writeFiles(distDir, dist)

  return { repoRoot, dist: distDir }
}

const page = (body = '') => `<!doctype html><html><body>${body}</body></html>`

/** What Astro emits for a `redirects` entry — see core/routing/3xx.js. */
const redirectStub = (to) =>
  `<!doctype html><title>Redirecting to: ${to}</title>` +
  `<meta http-equiv="refresh" content="0;url=${to}">`

const link = (path) => `See [the docs](https://rxova.dev/packages/react-inputs${path}).`

const run = (repoRoot, dist) => {
  try {
    const stdout = execFileSync(process.execPath, [scriptPath, repoRoot, dist], {
      stdio: 'pipe',
      encoding: 'utf8',
    })
    return { code: 0, output: stdout }
  } catch (error) {
    const output = [error.stdout, error.stderr].filter(Boolean).join('\n')
    return { code: error.status ?? 1, output }
  }
}

describe('collectLinks', () => {
  it('finds links in markdown and in package.json homepage fields', async () => {
    const { repoRoot } = await fixture({
      repo: {
        'README.md': link('/overview/'),
        'packages/otp/package.json': JSON.stringify({
          homepage: 'https://rxova.dev/packages/react-inputs/components/otp/introduction/',
        }),
      },
    })

    expect(
      collectLinks(repoRoot)
        .map((found) => found.url)
        .sort(),
    ).toEqual([
      'https://rxova.dev/packages/react-inputs/components/otp/introduction/',
      'https://rxova.dev/packages/react-inputs/overview/',
    ])
  })

  it('reports the file each link came from, relative to the repo root', async () => {
    const { repoRoot } = await fixture({ repo: { 'packages/otp/README.md': link('/overview/') } })

    expect(collectLinks(repoRoot)).toEqual([
      {
        file: join('packages', 'otp', 'README.md'),
        url: 'https://rxova.dev/packages/react-inputs/overview/',
      },
    ])
  })

  it('strips the sentence punctuation a link runs into', async () => {
    const { repoRoot } = await fixture({
      repo: {
        'README.md': [
          'A sentence ending in https://rxova.dev/packages/react-inputs/overview/.',
          'A list item, https://rxova.dev/packages/react-inputs/usage/, mid-clause.',
        ].join('\n'),
      },
    })

    expect(
      collectLinks(repoRoot)
        .map((found) => found.url)
        .sort(),
    ).toEqual([
      'https://rxova.dev/packages/react-inputs/overview/',
      'https://rxova.dev/packages/react-inputs/usage/',
    ])
  })

  it('ignores CHANGELOGs, whose URLs were correct when that version shipped', async () => {
    const { repoRoot } = await fixture({
      repo: { 'packages/otp/CHANGELOG.md': link('/otp/'), 'README.md': link('/overview/') },
    })

    expect(collectLinks(repoRoot).map((found) => found.url)).toEqual([
      'https://rxova.dev/packages/react-inputs/overview/',
    ])
  })

  it('ignores generated and vendored trees', async () => {
    const { repoRoot } = await fixture({
      repo: {
        'node_modules/dep/README.md': link('/gone/'),
        'apps/docs/dist/index.html': link('/gone/'),
        '.git/COMMIT_EDITMSG': link('/gone/'),
        'coverage/report.md': link('/gone/'),
        'README.md': link('/overview/'),
      },
    })

    expect(collectLinks(repoRoot).map((found) => found.url)).toEqual([
      'https://rxova.dev/packages/react-inputs/overview/',
    ])
  })

  // llms.txt ships in every package tarball and links to this site, so a moved
  // route breaks it the same way it breaks a README — and its readers are less
  // likely than a human to work around a 404.
  it('finds links in a package llms.txt', async () => {
    const { repoRoot } = await fixture({
      repo: { 'packages/otp/llms.txt': link('/components/otp/usage/') },
    })

    expect(collectLinks(repoRoot).map((found) => found.url)).toEqual([
      'https://rxova.dev/packages/react-inputs/components/otp/usage/',
    ])
  })

  it('ignores files that are neither markdown, package.json nor llms.txt', async () => {
    const { repoRoot } = await fixture({
      repo: { 'src/index.ts': `const url = '${link('/gone/')}'`, 'notes.txt': link('/gone/') },
    })

    expect(collectLinks(repoRoot)).toEqual([])
  })
})

describe('checkReadmeLinks', () => {
  it('passes when every link resolves', async () => {
    const { repoRoot, dist } = await fixture({
      repo: { 'README.md': link('/components/otp/introduction/') },
      dist: { 'components/otp/introduction/index.html': page() },
    })

    expect(checkReadmeLinks({ repoRoot, dist })).toEqual([])
  })

  it('fails when the site emits no page or redirect for the route', async () => {
    const { repoRoot, dist } = await fixture({
      repo: { 'README.md': link('/components/otp/') },
      dist: { 'components/otp/introduction/index.html': page() },
    })

    expect(checkReadmeLinks({ repoRoot, dist })).toEqual([
      {
        file: 'README.md',
        url: 'https://rxova.dev/packages/react-inputs/components/otp/',
        reason: 'no page or redirect at /components/otp/',
      },
    ])
  })

  // A URL with an extension names a file, not a route. Without the extension
  // branch in resolveRoute these would be looked for at `<url>/index.html` and
  // reported missing — so every link to the surfaces this site publishes for
  // agents would fail the build.
  it('resolves a raw-markdown twin as the file it is', async () => {
    const { repoRoot, dist } = await fixture({
      repo: { 'README.md': link('/components/otp/usage.md') },
      dist: { 'components/otp/usage.md': '# Usage\n' },
    })

    expect(checkReadmeLinks({ repoRoot, dist })).toEqual([])
  })

  it('resolves llms.txt as the file it is', async () => {
    const { repoRoot, dist } = await fixture({
      repo: { 'README.md': link('/llms.txt') },
      dist: { 'llms.txt': '# rxova\n' },
    })

    expect(checkReadmeLinks({ repoRoot, dist })).toEqual([])
  })

  it('still fails a file link that the build did not emit', async () => {
    const { repoRoot, dist } = await fixture({
      repo: { 'README.md': link('/components/otp/usage.md') },
      dist: { 'components/otp/usage/index.html': page() },
    })

    expect(checkReadmeLinks({ repoRoot, dist })).toEqual([
      {
        file: 'README.md',
        url: 'https://rxova.dev/packages/react-inputs/components/otp/usage.md',
        reason: 'no page or redirect at /components/otp/usage.md',
      },
    ])
  })

  it('accepts a redirect stub as an answer for the route', async () => {
    const { repoRoot, dist } = await fixture({
      repo: { 'README.md': link('/components/otp/') },
      dist: {
        'components/otp/index.html': redirectStub(
          '/packages/react-inputs/components/otp/introduction/',
        ),
      },
    })

    expect(checkReadmeLinks({ repoRoot, dist })).toEqual([])
  })

  it('resolves the site root', async () => {
    const { repoRoot, dist } = await fixture({
      repo: { 'README.md': link('/') },
      dist: { 'index.html': page() },
    })

    expect(checkReadmeLinks({ repoRoot, dist })).toEqual([])
  })

  it('falls back to a flat <route>.html', async () => {
    const { repoRoot, dist } = await fixture({
      repo: { 'README.md': link('/overview') },
      dist: { 'overview.html': page() },
    })

    expect(checkReadmeLinks({ repoRoot, dist })).toEqual([])
  })

  it('treats a route with and without its trailing slash as the same page', async () => {
    const { repoRoot, dist } = await fixture({
      repo: { 'README.md': `${link('/overview')} ${link('/overview/')}` },
      dist: { 'overview/index.html': page() },
    })

    expect(checkReadmeLinks({ repoRoot, dist })).toEqual([])
  })

  it('ignores a sibling project that merely shares the URL prefix', async () => {
    const { repoRoot, dist } = await fixture({
      repo: { 'README.md': 'https://rxova.dev/packages/react-inputs-suite/overview/' },
    })

    expect(checkReadmeLinks({ repoRoot, dist })).toEqual([])
  })

  it('collects a failure per broken link, naming each source file', async () => {
    const { repoRoot, dist } = await fixture({
      repo: { 'README.md': link('/gone/'), 'packages/otp/README.md': link('/also-gone/') },
    })

    expect(
      checkReadmeLinks({ repoRoot, dist })
        .map((failure) => failure.file)
        .sort(),
    ).toEqual(['README.md', join('packages', 'otp', 'README.md')])
  })

  describe('anchors', () => {
    it('passes when the target page has the id', async () => {
      const { repoRoot, dist } = await fixture({
        repo: { 'README.md': link('/components/otp/about/#form-libraries') },
        dist: { 'components/otp/about/index.html': page('<h2 id="form-libraries">Form</h2>') },
      })

      expect(checkReadmeLinks({ repoRoot, dist })).toEqual([])
    })

    it('fails when the page exists but the section does not', async () => {
      const { repoRoot, dist } = await fixture({
        repo: { 'README.md': link('/components/otp/about/#styling') },
        dist: { 'components/otp/about/index.html': page('<h2 id="form-libraries">Form</h2>') },
      })

      expect(checkReadmeLinks({ repoRoot, dist })).toEqual([
        {
          file: 'README.md',
          url: 'https://rxova.dev/packages/react-inputs/components/otp/about/#styling',
          reason: '/components/otp/about/ exists but has no #styling',
        },
      ])
    })

    it('does not resolve anchors through a redirect stub, which has no content', async () => {
      const { repoRoot, dist } = await fixture({
        repo: { 'README.md': link('/guides/styling/#anything') },
        dist: { 'guides/styling/index.html': redirectStub('/packages/react-inputs/overview/') },
      })

      expect(checkReadmeLinks({ repoRoot, dist })).toEqual([])
    })
  })
})

describe('formatFailures', () => {
  it('names the file, the URL and the reason, and says how to fix it', () => {
    const message = formatFailures([
      {
        file: 'README.md',
        url: `https://rxova.dev/packages/react-inputs/gone/`,
        reason: 'no page',
      },
    ])

    expect(message).toContain('README.md')
    expect(message).toContain('https://rxova.dev/packages/react-inputs/gone/')
    expect(message).toContain('no page')
    expect(message).toContain('astro.config.mjs')
  })
})

describe('the CLI the docs build runs', () => {
  it('exits 0 and says so when every link resolves', async () => {
    const { repoRoot, dist } = await fixture({
      repo: { 'README.md': link('/overview/') },
      dist: { 'overview/index.html': page() },
    })

    const { code, output } = run(repoRoot, dist)

    expect(code).toBe(0)
    expect(output).toContain('every https://rxova.dev/packages/react-inputs link')
  })

  it('exits 1 and reports the broken link', async () => {
    const { repoRoot, dist } = await fixture({ repo: { 'README.md': link('/gone/') } })

    const { code, output } = run(repoRoot, dist)

    expect(code).toBe(1)
    expect(output).toContain('1 broken')
    expect(output).toContain('no page or redirect at /gone/')
  })
})
