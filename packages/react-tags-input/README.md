<h1 align="center">@rxova/react-tags-input</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@rxova/react-tags-input"><img src="https://img.shields.io/npm/v/@rxova/react-tags-input?color=cb3837&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://github.com/rxova/react-inputs/actions/workflows/ci.yml"><img src="https://github.com/rxova/react-inputs/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/brotli-%E2%89%A4%204%20kB-f5a623" alt="Brotli size at most 4 kB" />
  <img src="https://img.shields.io/badge/coverage%20threshold-95%25-brightgreen" alt="Coverage threshold: 95% per file" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict mode" />
  <img src="https://img.shields.io/badge/dependencies-0-44cc11" alt="Zero runtime dependencies" />
  <img src="https://img.shields.io/badge/React-%E2%89%A518-61dafb?logo=react&logoColor=white" alt="React 18 or newer" />
  <a href="https://github.com/rxova/react-inputs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

**A tag input where the keyboard actually works.** Headless, zero-dependency, 3.6 kB.

```bash
npm install @rxova/react-tags-input
```

- **Focus never lands on `<body>`** after you remove a tag — it goes to the next one, or the
  previous, or the entry box.
- **One tab stop for the whole list**, not one per tag, with Arrow/Home/End inside it.
- **Two-step Backspace**: the first press selects the last tag, the second removes it. You see what
  you are about to delete.
- **Every remove button is named after its tag** — `Remove react`, not `Remove`.
- **Additions and removals are announced** politely, with a pasted batch announced once.
- **Zero runtime dependencies**, no stylesheet to import.

This is not the smallest option in the category — `react-tagsinput` is 3.1 kB against this
package's 3.6 kB, and that is worth saying plainly. The argument here is the six
accessibility failures above, each of which is present in the most-downloaded alternatives and
each of which has a test in this repo.

## Basic use

```tsx
import { useState } from 'react'
import { TagsInput } from '@rxova/react-tags-input'

function Topics() {
  const [tags, setTags] = useState<string[]>([])
  return <TagsInput label="Topics" value={tags} onChange={setTags} placeholder="Add a topic" />
}
```

The value is a `string[]`. Enter and `,` commit by default, and pasting `react, vue, svelte` adds
three tags.

## Keyboard

| Key                   | Where           | Effect                                                        |
| --------------------- | --------------- | ------------------------------------------------------------- |
| `Enter`, `,`          | entry box       | Commit the current text                                       |
| `Backspace`           | empty entry box | Select the last tag (a second press removes it)               |
| `←`                   | empty entry box | Move into the tag list                                        |
| `Backspace`, `Delete` | a tag           | Remove it                                                     |
| `←` / `→`             | a tag           | Move between tags; right past the last lands in the entry box |
| `Home`                | a tag           | Jump to the first tag                                         |
| `End`                 | a tag           | Jump to the entry box                                         |
| any character         | a tag           | Move to the entry box, keeping the keystroke                  |
| `Tab`                 | anywhere        | Leave the field — one stop for the list, one for the box      |

## Rules

```tsx
import { TagsInput, type TagAttempt } from '@rxova/react-tags-input'

function Constrained() {
  return (
    <TagsInput
      label="Topics"
      max={5}
      minLength={2}
      maxLength={20}
      transform={(raw) => raw.toLowerCase()}
      validate={(tag, existing) =>
        existing.length > 0 && tag === 'other' ? 'pick something specific' : true
      }
      onReject={(attempt: TagAttempt) => {
        console.log(attempt.reason, attempt.message)
      }}
    />
  )
}
```

`transform` runs first, so lowercasing there makes `React` a duplicate of `react`. `validate`
returns `true`, `false`, or a string that explains the refusal. Both are contained — a throwing
`transform` behaves as if absent, a throwing `validate` refuses the tag, and neither takes the form
down.

Rejection reasons: `empty`, `duplicate`, `max-reached`, `too-short`, `too-long`, `invalid`.

**A refused entry stays in the entry box.** Clearing it would make the user retype from memory a
value they can no longer see.

Deduplication is case-insensitive by default (`allowDuplicates`, `caseSensitive` to change it), and
lengths count codepoints, so two emoji are two characters.

## Forms

With a `name`, the component emits **one hidden input per tag**, so a native form posts a real
array:

```tsx
import { TagsInput } from '@rxova/react-tags-input'

function Form() {
  return (
    <form action="/profile" method="post">
      <TagsInput label="Skills" name="skills" defaultValue={['react', 'a11y']} />
      <button type="submit">Save</button>
    </form>
  )
}
```

`formData.getAll('skills')` gives `['react', 'a11y']` — not a joined string somebody downstream has
to guess how to split. `required` applies to the entry box only while the list is empty.

## Styling

There is no stylesheet to import.

| Property                   | Default              | Applies to                          |
| -------------------------- | -------------------- | ----------------------------------- |
| `--rx-tags-gap`            | `0.25rem`            | Between tags and the entry box      |
| `--rx-tags-tag-gap`        | `0.25rem`            | Between a tag's text and its button |
| `--rx-tags-tag-padding`    | `0.125rem 0.375rem`  | Inside a tag                        |
| `--rx-tags-tag-radius`     | `0.25rem`            | Tag corners                         |
| `--rx-tags-tag-background` | `rgba(0 0 0 / 0.08)` | Tag background                      |
| `--rx-tags-remove-size`    | `1.5rem`             | Remove button hit area              |

Do not shrink `--rx-tags-remove-size` below `1.5rem`: at the default font size that is the 24×24 CSS
pixels WCAG 2.5.8 Target Size (Minimum) requires.

The entry box keeps the browser's own focus ring. To ring the whole field instead, draw one from
`[data-rx-tags-root]:focus-within` and suppress the inner one — but suppress it only once the
replacement is in place, or the field's only text tab stop becomes invisible to a keyboard user.

### `data-*` attributes

These are **public API**, covered by semver.

| Attribute                                          | On            | Meaning                          |
| -------------------------------------------------- | ------------- | -------------------------------- |
| `data-rx-tags-root`                                | wrapper       | Always present                   |
| `data-count`                                       | wrapper       | Number of tags                   |
| `data-full`                                        | wrapper       | `max` reached                    |
| `data-invalid` / `data-disabled` / `data-readonly` | wrapper       | Mirrors the props                |
| `data-rx-tags-list`                                | `<ul>`        | The tag list                     |
| `data-rx-tags-tag`                                 | `<li>`        | The tag's index                  |
| `data-rx-tags-label`                               | `<span>`      | The tag's rendered contents      |
| `data-rx-tags-remove`                              | `<button>`    | The remove button                |
| `data-focused`                                     | remove button | This tag has focus               |
| `data-rx-tags-input`                               | `<input>`     | The entry box                    |
| `data-rx-tags-value`                               | hidden input  | One per tag, for form submission |
| `data-rx-tags-announcement`                        | live region   | Off-screen, `aria-live="polite"` |

## Headless

`useTagsInput` gives you the whole state machine with no markup — including the roving tab order
and the focus bookkeeping after a removal, which are the parts worth not rewriting.

```tsx
import { useTagsInput } from '@rxova/react-tags-input'

function CustomTags() {
  const field = useTagsInput({ max: 5 })

  return (
    <div onBlur={field.handleBlur}>
      <ul>
        {field.tags.map((tag, index) => (
          <li key={tag}>
            {tag}
            <button
              ref={(node) => {
                field.tagRefs.current[index] = node
              }}
              type="button"
              tabIndex={index === field.activeIndex ? 0 : -1}
              aria-label={`Remove ${tag}`}
              onClick={() => {
                field.removeAt(index)
              }}
              onKeyDown={(event) => {
                field.handleTagKeyDown(event, index)
              }}
              onFocus={() => {
                field.setFocusedIndex(index)
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <input
        ref={(node) => {
          field.inputRef.current = node
        }}
        value={field.text}
        onChange={(event) => {
          field.setText(event.target.value)
        }}
        onKeyDown={field.handleInputKeyDown}
        onPaste={field.handlePaste}
      />
      <span aria-live="polite">{field.announcement}</span>
    </div>
  )
}
```

The rule helpers are exported too — `attempt`, `attemptAll`, `sanitize`, `splitPasted`, `contains`
— all pure, so you can re-run exactly the same rules on the server against whatever the field
submitted.

## Diagnostics

`onWarn` receives `{ code, prop, received, message }` whenever a prop is rejected or coerced.
Codes: `value-not-array`, `value-had-non-strings`, `value-had-duplicates`, `value-over-max`,
`max-invalid`, `length-range-invalid`, `no-delimiters`.

With no handler these go to `console.warn`. **The entire path is stripped from production builds** —
it sits behind a `process.env.NODE_ENV !== 'production'` branch, so there is no runtime cost and no
console noise in production. The E2E suite asserts this against a real production bundle.

## Accessibility

- A labelled text box beside a real `<ul>`, so a screen reader announces "list, 3 items".
- **Not a combobox.** No `role="combobox"`, no `aria-expanded`, no `aria-autocomplete` — there is
  no popup, and claiming one would be a promise this component cannot keep.
- Roving tabindex: one tab stop for the list however many tags it holds.
- Focus after a removal never lands on `<body>`.
- Remove buttons are named after their tag and meet WCAG 2.5.8 target size.
- A polite live region announces additions and removals; a pasted batch is announced once.
- axe (WCAG 2.1 A/AA) runs over the component in the browser suite and over the whole demo page in
  Chromium, Firefox and WebKit — including right-to-left.

## Part of rxova

One suite, one set of conventions: [`@rxova/react-inputs`](https://www.npmjs.com/package/@rxova/react-inputs).

## License

MIT
