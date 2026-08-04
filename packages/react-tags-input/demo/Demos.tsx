import { useState } from 'react'
import { Section } from '@rxova/demo-kit'
import { TagsInput } from '@rxova/react-tags-input'
import type { TagAttempt, TagsWarning } from '@rxova/react-tags-input'

/**
 * The E2E target. Every section is something the Playwright suite drives, so
 * this doubles as the manual-QA page and as the page-level accessibility scan
 * subject — several problems (duplicate ids across instances, tab order across
 * a whole form) only exist in composition and cannot be caught by a component
 * test.
 */
export function TagsDemos() {
  const [tags, setTags] = useState<string[]>(['react'])
  const [rejection, setRejection] = useState<TagAttempt | null>(null)
  const [warnings, setWarnings] = useState<TagsWarning[]>([])
  const [submitted, setSubmitted] = useState<string[] | null>(null)

  return (
    <>
      <Section id="basic" title="Basic" note="Enter or a comma commits. Paste splits.">
        <TagsInput label="Topics" name="topics" placeholder="Add a topic" />
      </Section>

      <Section id="controlled" title="Controlled" note="The value is a string array.">
        <TagsInput label="Controlled topics" value={tags} onChange={setTags} />
        <p data-testid="value">{tags.join('|') || 'empty'}</p>
        <button
          type="button"
          onClick={() => {
            setTags(['vue', 'svelte'])
          }}
        >
          Replace
        </button>
        <button
          type="button"
          onClick={() => {
            setTags([])
          }}
        >
          Clear
        </button>
      </Section>

      <Section
        id="rules"
        title="Rules"
        note="Lowercased, at most three, between two and twelve characters, no x-words."
      >
        <TagsInput
          label="Constrained topics"
          max={3}
          minLength={2}
          maxLength={12}
          transform={(raw) => raw.toLowerCase()}
          validate={(tag) => (tag.startsWith('x') ? 'no x-words here' : true)}
          onReject={setRejection}
        />
        <p data-testid="rejection">
          {rejection ? `${rejection.reason ?? 'none'}:${rejection.tag}` : ''}
        </p>
        <p data-testid="rejection-message">{rejection?.message ?? ''}</p>
      </Section>

      <Section id="warnings" title="Diagnostics" note="onWarn receives every rejected prop.">
        <TagsInput
          label="Misconfigured on purpose"
          max={0}
          onWarn={(warning) => {
            setWarnings((previous) =>
              previous.some((w) => w.code === warning.code) ? previous : [...previous, warning],
            )
          }}
        />
        <ul data-testid="warning-codes">
          {warnings.map((warning) => (
            <li key={warning.code}>{warning.code}</li>
          ))}
        </ul>
      </Section>

      <Section id="native-form" title="Native form" note="Posts one hidden input per tag.">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setSubmitted(new FormData(event.currentTarget).getAll('skills').map(String))
          }}
        >
          <TagsInput label="Skills" name="skills" defaultValue={['react', 'a11y']} />
          <button type="submit">Save</button>
        </form>
        <p data-testid="submitted">{submitted === null ? '' : submitted.join('|')}</p>
      </Section>

      <Section id="states" title="States" note="Disabled and read-only.">
        <p data-testid="state-disabled">
          <TagsInput label="Disabled topics" disabled defaultValue={['react']} />
        </p>
        <p data-testid="state-readonly">
          <TagsInput
            label="Read-only topics"
            readOnly
            value={['react', 'vue']}
            onChange={() => undefined}
          />
        </p>
      </Section>
    </>
  )
}
