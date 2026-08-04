import { describe, expect, it } from 'vitest'
import {
  attempt,
  attemptAll,
  describeRejection,
  extensionOf,
  fileKey,
  formatBytes,
  isPreviewable,
  matchesAccept,
} from '../files'

/**
 * Pure rules over a file's *metadata*, so these run in the node project — `File`
 * exists there, and nothing here touches the DOM. That is also what lets a
 * consumer re-run exactly these rules on the server against whatever was
 * uploaded; the client-side check stops a mistake, it does not secure anything.
 */
function makeFile(name: string, options: { type?: string; size?: number; at?: number } = {}) {
  const { type = '', size = 10, at = 1_700_000_000_000 } = options
  const file = new File([new Uint8Array(size)], name, { type, lastModified: at })
  return file
}

describe('extensionOf', () => {
  it('returns the lowercase extension with its dot', () => {
    expect(extensionOf('photo.PNG')).toBe('.png')
    expect(extensionOf('archive.tar.gz')).toBe('.gz')
  })

  it('returns nothing for a file with no extension', () => {
    expect(extensionOf('README')).toBe('')
  })

  it('treats a leading dot as a hidden file, not an extension', () => {
    // `.gitignore` has no extension; treating it as one would make it match
    // `accept=".gitignore"` and nothing else, which is not what anyone means.
    expect(extensionOf('.gitignore')).toBe('')
  })
})

describe('matchesAccept', () => {
  it('accepts everything when no accept is given', () => {
    expect(matchesAccept(makeFile('a.exe'), undefined)).toBe(true)
    expect(matchesAccept(makeFile('a.exe'), '')).toBe(true)
    expect(matchesAccept(makeFile('a.exe'), '   ')).toBe(true)
  })

  it('matches an extension pattern case-insensitively', () => {
    expect(matchesAccept(makeFile('photo.PNG'), '.png')).toBe(true)
    expect(matchesAccept(makeFile('photo.jpg'), '.png')).toBe(false)
  })

  it('matches a full MIME type', () => {
    expect(matchesAccept(makeFile('a', { type: 'image/png' }), 'image/png')).toBe(true)
    expect(matchesAccept(makeFile('a', { type: 'image/jpeg' }), 'image/png')).toBe(false)
  })

  it('matches a group wildcard', () => {
    expect(matchesAccept(makeFile('a', { type: 'image/webp' }), 'image/*')).toBe(true)
    expect(matchesAccept(makeFile('a', { type: 'video/mp4' }), 'image/*')).toBe(false)
  })

  it('accepts any pattern in a comma-separated list', () => {
    const accept = '.pdf,image/*'
    expect(matchesAccept(makeFile('a.pdf'), accept)).toBe(true)
    expect(matchesAccept(makeFile('b', { type: 'image/png' }), accept)).toBe(true)
    expect(matchesAccept(makeFile('c.txt', { type: 'text/plain' }), accept)).toBe(false)
  })

  it('falls back to the extension when the browser reports no type', () => {
    // Browsers report `''` for anything the OS has no association for, and
    // refusing those would reject files the native picker itself offered.
    expect(matchesAccept(makeFile('notes.md', { type: '' }), '.md')).toBe(true)
    expect(matchesAccept(makeFile('notes.md', { type: '' }), 'text/markdown')).toBe(false)
    expect(matchesAccept(makeFile('notes.md', { type: '' }), 'text/*')).toBe(false)
  })

  it('ignores stray whitespace and empty entries in the list', () => {
    expect(matchesAccept(makeFile('a.pdf'), ' .pdf , ')).toBe(true)
    expect(matchesAccept(makeFile('a.pdf'), ',,')).toBe(true)
  })
})

describe('formatBytes', () => {
  it('uses decimal units, as every file browser does', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(999)).toBe('999 B')
    expect(formatBytes(1000)).toBe('1 kB')
    expect(formatBytes(1_500_000)).toBe('1.5 MB')
    expect(formatBytes(2_000_000_000)).toBe('2 GB')
  })

  it('drops the decimal past a hundred, where it is noise', () => {
    expect(formatBytes(123_400)).toBe('123 kB')
  })

  it('never reports a negative or non-finite size', () => {
    expect(formatBytes(-1)).toBe('0 B')
    expect(formatBytes(Number.NaN)).toBe('0 B')
  })
})

describe('fileKey', () => {
  it('identifies a file by name, size and timestamp', () => {
    // The browser gives no stable id, and hashing the contents would mean
    // reading every byte of a 2 GB video to answer a question nobody asked.
    const a = makeFile('photo.png', { size: 10, at: 1 })
    const b = makeFile('photo.png', { size: 10, at: 1 })
    expect(fileKey(a)).toBe(fileKey(b))
  })

  it('distinguishes files that differ in any of the three', () => {
    const base = makeFile('a.png', { size: 10, at: 1 })
    expect(fileKey(base)).not.toBe(fileKey(makeFile('b.png', { size: 10, at: 1 })))
    expect(fileKey(base)).not.toBe(fileKey(makeFile('a.png', { size: 11, at: 1 })))
    expect(fileKey(base)).not.toBe(fileKey(makeFile('a.png', { size: 10, at: 2 })))
  })
})

describe('attempt', () => {
  it('accepts a plain new file', () => {
    expect(attempt([], makeFile('a.png')).accepted).toBe(true)
  })

  it('refuses a type the accept string does not allow', () => {
    expect(attempt([], makeFile('a.exe'), { accept: '.png' }).reason).toBe('type')
  })

  it('enforces both size bounds', () => {
    expect(attempt([], makeFile('a', { size: 100 }), { maxSize: 50 }).reason).toBe('too-large')
    // A 0-byte file is what a failed copy leaves behind, which is why a minimum
    // is worth having at all.
    expect(attempt([], makeFile('a', { size: 0 }), { minSize: 1 }).reason).toBe('too-small')
  })

  it('refuses a duplicate, and can be told not to', () => {
    const file = makeFile('a.png')
    expect(attempt([file], makeFile('a.png'), {}).reason).toBe('duplicate')
    expect(attempt([file], makeFile('a.png'), { dedupe: false }).accepted).toBe(true)
  })

  it('refuses once the list is full', () => {
    expect(attempt([makeFile('a')], makeFile('b'), { maxFiles: 1 }).reason).toBe('max-files')
  })

  it('checks the count before anything else, so a full list fails fast', () => {
    // Otherwise a full list would report "type" for a file it was never going
    // to accept anyway, and the user would fix the wrong thing.
    const result = attempt([makeFile('a')], makeFile('b.exe'), { maxFiles: 1, accept: '.png' })
    expect(result.reason).toBe('max-files')
  })

  it('gives validate the final say, with an optional reason', () => {
    expect(attempt([], makeFile('a'), { validate: () => true }).accepted).toBe(true)
    const explained = attempt([], makeFile('a'), { validate: () => 'not this one' })
    expect(explained.reason).toBe('invalid')
    expect(explained.message).toBe('not this one')
  })

  it('refuses rather than crashing when validate throws', () => {
    expect(
      attempt([], makeFile('a'), {
        validate: () => {
          throw new Error('boom')
        },
      }).reason,
    ).toBe('invalid')
  })

  it('never mutates the list it was given', () => {
    const existing = [makeFile('a')]
    attempt(existing, makeFile('b'))
    expect(existing).toHaveLength(1)
  })
})

describe('attemptAll', () => {
  it('checks each candidate against the list as it grows', () => {
    const a = makeFile('a.png')
    const { files, results } = attemptAll([], [a, makeFile('a.png'), makeFile('b.png')])
    expect(files).toHaveLength(2)
    expect(results.map((result) => result.accepted)).toEqual([true, false, true])
    expect(results[1]?.reason).toBe('duplicate')
  })

  it('stops accepting at max but keeps reporting', () => {
    const { files, results } = attemptAll([], [makeFile('a'), makeFile('b'), makeFile('c')], {
      maxFiles: 2,
    })
    expect(files).toHaveLength(2)
    expect(results[2]?.reason).toBe('max-files')
  })
})

describe('describeRejection', () => {
  it('explains each reason in terms the user can act on', () => {
    const file = makeFile('big.png', { size: 5_000_000 })
    expect(
      describeRejection({ file, accepted: false, reason: 'type' }, { accept: '.pdf' }),
    ).toContain('.pdf')
    expect(
      describeRejection({ file, accepted: false, reason: 'too-large' }, { maxSize: 1_000_000 }),
    ).toContain('1 MB')
    expect(
      describeRejection({ file, accepted: false, reason: 'too-small' }, { minSize: 10 }),
    ).toContain('10 B')
    expect(describeRejection({ file, accepted: false, reason: 'duplicate' })).toContain('already')
    expect(
      describeRejection({ file, accepted: false, reason: 'max-files' }, { maxFiles: 3 }),
    ).toContain('3')
  })

  it('prefers the message validate supplied', () => {
    const file = makeFile('a.png')
    expect(
      describeRejection({ file, accepted: false, reason: 'invalid', message: 'wrong shape' }),
    ).toBe('wrong shape')
  })

  it('falls back to a generic sentence with no message', () => {
    const file = makeFile('a.png')
    expect(describeRejection({ file, accepted: false, reason: 'invalid' })).toContain('a.png')
  })

  it('names the type limit even with no accept string', () => {
    const file = makeFile('a.png')
    expect(describeRejection({ file, accepted: false, reason: 'type' })).toContain('a.png')
  })

  it('still forms a sentence when the rules that caused the rejection are absent', () => {
    // A caller may pass a rejection through without the rules object. Every
    // branch has to degrade to a readable sentence rather than print
    // `undefined` at the user.
    const file = makeFile('a.png', { size: 5000 })
    for (const reason of ['too-large', 'too-small', 'max-files'] as const) {
      const sentence = describeRejection({ file, accepted: false, reason })
      expect(sentence).not.toContain('undefined')
      expect(sentence).not.toContain('NaN')
      expect(sentence.endsWith('.')).toBe(true)
    }
  })

  it('reports a zero limit rather than omitting it', () => {
    const file = makeFile('a.png', { size: 5000 })
    expect(describeRejection({ file, accepted: false, reason: 'too-large' })).toContain('0 B')
    expect(describeRejection({ file, accepted: false, reason: 'max-files' })).toContain('0')
  })
})

describe('isPreviewable', () => {
  it('is true only for images', () => {
    expect(isPreviewable(makeFile('a', { type: 'image/png' }))).toBe(true)
    expect(isPreviewable(makeFile('a', { type: 'application/pdf' }))).toBe(false)
    expect(isPreviewable(makeFile('a', { type: '' }))).toBe(false)
  })
})
