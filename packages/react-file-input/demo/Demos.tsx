import { useState } from 'react'
import { Section } from '@rxova/demo-kit'
import { FileInput } from '@rxova/react-file-input'
import type { FileAttempt, FileWarning } from '@rxova/react-file-input'

/**
 * The E2E target. Every section is something the Playwright suite drives, so
 * this doubles as the manual-QA page and as the page-level accessibility scan
 * subject — several problems (duplicate ids across instances, tab order across
 * a whole form) only exist in composition and cannot be caught by a component
 * test.
 */
/** A stand-in for a file that arrived from the server, for the read-only state. */
const FIXED = new File([new Uint8Array(2048)], 'contract.pdf', {
  type: 'application/pdf',
  lastModified: 0,
})

export function FileDemos() {
  const [files, setFiles] = useState<File[]>([])
  const [rejection, setRejection] = useState<FileAttempt | null>(null)
  const [warnings, setWarnings] = useState<FileWarning[]>([])
  const [submitted, setSubmitted] = useState<string | null>(null)

  return (
    <>
      <Section id="basic" title="Basic" note="One file. Picking again replaces it.">
        <FileInput label="Attachment" name="attachment" />
      </Section>

      <Section id="multiple" title="Multiple" note="Adds to the list rather than replacing it.">
        <FileInput label="Attachments" name="attachments" multiple />
      </Section>

      <Section id="controlled" title="Controlled" note="The value is a File array.">
        <FileInput label="Controlled attachments" multiple value={files} onChange={setFiles} />
        <p data-testid="value">{files.map((file) => file.name).join('|') || 'empty'}</p>
        <button
          type="button"
          onClick={() => {
            setFiles([])
          }}
        >
          Clear
        </button>
      </Section>

      <Section
        id="rules"
        title="Rules"
        note="Text files only, at most three, at most 1 kB, no file named secret."
      >
        <FileInput
          label="Constrained attachments"
          multiple
          accept=".txt,text/plain"
          maxFiles={3}
          maxSize={1000}
          validate={(file) => (file.name.startsWith('secret') ? 'that one stays home' : true)}
          onReject={setRejection}
        />
        <p data-testid="rejection">
          {rejection ? `${rejection.reason ?? 'none'}:${rejection.file.name}` : ''}
        </p>
        <p data-testid="rejection-message">{rejection?.message ?? ''}</p>
      </Section>

      <Section id="previews" title="Previews" note="Object URLs, revoked on removal and unmount.">
        <FileInput label="Photos" multiple previews accept="image/*" />
      </Section>

      <Section id="warnings" title="Diagnostics" note="onWarn receives every rejected prop.">
        <FileInput
          label="Misconfigured on purpose"
          multiple
          maxFiles={0}
          minSize={900}
          maxSize={100}
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

      <Section id="native-form" title="Native form" note="Posts through the real file input.">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const entry = new FormData(event.currentTarget).get('resume')
            setSubmitted(entry instanceof File ? entry.name : '')
          }}
        >
          <FileInput label="Résumé" name="resume" />
          <button type="submit">Save</button>
        </form>
        <p data-testid="submitted">{submitted ?? ''}</p>
      </Section>

      <Section id="states" title="States" note="Disabled and read-only.">
        <div data-testid="state-disabled">
          <FileInput label="Disabled attachment" disabled />
        </div>
        <div data-testid="state-readonly">
          <FileInput label="Read-only attachment" readOnly defaultValue={[FIXED]} />
        </div>
      </Section>
    </>
  )
}
