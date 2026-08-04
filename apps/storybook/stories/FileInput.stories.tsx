import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { FileInput, formatBytes } from '@rxova/react-file-input'

const meta = {
  title: 'Components/File input',
  component: FileInput,
  args: {
    label: 'Attachments',
    multiple: false,
    dedupe: true,
    previews: false,
    disabled: false,
    readOnly: false,
    invalid: false,
    required: false,
    onChange: fn(),
    onAdd: fn(),
    onRemove: fn(),
    onReject: fn(),
  },
  argTypes: {
    accept: {
      control: 'select',
      options: [undefined, 'image/*', 'image/png,image/jpeg', '.pdf,.docx', 'text/csv'],
    },
    maxSize: { control: { type: 'number', min: 1024, step: 1024 } },
    minSize: { control: { type: 'number', min: 0, step: 1024 } },
    maxFiles: { control: { type: 'number', min: 1, max: 20, step: 1 } },
    value: { control: false },
    // Functions and nodes have no useful control representation.
    validate: { control: false },
    renderFile: { control: false },
    removeLabel: { control: false },
    announce: { control: false },
    onWarn: { control: false },
    style: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="story">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FileInput>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Every prop is live in the Controls panel; the spies log to Actions. The field
 * is a picker and a drop zone at once — click it, or drag a file onto it.
 */
export const Playground: Story = {}

/** `multiple` with a cap, the usual attachment field. */
export const MultipleWithCap: Story = {
  args: { multiple: true, maxFiles: 3, label: 'Up to 3 attachments' },
}

/** `accept` is passed through to the native input, exactly as it takes it. */
export const RestrictedTypes: Story = {
  args: {
    accept: 'image/png,image/jpeg',
    multiple: true,
    label: 'Images only',
    hint: 'PNG or JPEG, dropped or picked',
  },
}

/**
 * Size bounds are checked before the file reaches the list, and a refusal comes
 * through `onReject` with a machine-readable reason.
 */
export const SizeBounds: Story = {
  render: function SizeBounds(args) {
    const [rejected, setRejected] = useState<string | null>(null)
    return (
      <>
        <FileInput
          {...args}
          multiple
          maxSize={512 * 1024}
          label="Nothing over 512 kB"
          onReject={(attempt) => {
            setRejected(attempt.message ?? `${attempt.file.name}: ${attempt.reason ?? 'refused'}`)
          }}
          aria-describedby="file-reject-help"
        />
        <p id="file-reject-help" className={rejected ? 'error' : undefined}>
          {rejected ?? 'Drop something larger than 512 kB to see a refusal'}
        </p>
      </>
    )
  },
}

/**
 * `previews` creates object URLs for image files and revokes them on removal
 * and unmount. Off by default: a URL that is never revoked is a memory leak, so
 * the caller opts into the lifecycle deliberately.
 */
export const WithImagePreviews: Story = {
  args: {
    previews: true,
    multiple: true,
    accept: 'image/*',
    label: 'Images with previews',
  },
}

/** `validate` has the final say and can return a string explaining the refusal. */
export const WithValidation: Story = {
  args: {
    multiple: true,
    label: 'No spaces in the filename',
    validate: (file: File) => !file.name.includes(' ') || `"${file.name}" must not contain spaces`,
  },
}

/** `renderFile` draws one file row — the chrome and remove button stay. */
export const CustomFileRow: Story = {
  args: {
    multiple: true,
    renderFile: ({ file, size, index }) => (
      <span>
        {index + 1}. <strong>{file.name}</strong> — {size}
      </span>
    ),
  },
}

/** Controlled: the consumer owns the array and can edit it from outside. */
export const Controlled: Story = {
  render: function Controlled(args) {
    const [files, setFiles] = useState<File[]>([])
    const total = files.reduce((sum, f) => sum + f.size, 0)
    return (
      <>
        <FileInput {...args} multiple value={files} onChange={setFiles} />
        <button
          type="button"
          onClick={() => {
            setFiles([])
          }}
          disabled={files.length === 0}
        >
          Clear all
        </button>
        <output>
          {files.length} file(s), {formatBytes(total)} total
        </output>
      </>
    )
  },
}

/** `invalid` sets `aria-invalid` and `data-invalid`; the ring is a consumer token. */
export const Invalid: Story = {
  render: (args) => (
    <>
      <FileInput {...args} invalid aria-describedby="file-invalid-help" />
      <p id="file-invalid-help" className="error">
        An attachment is required
      </p>
    </>
  ),
}

/** Disabled: exposed to assistive tech, not editable. */
export const Disabled: Story = {
  args: { disabled: true },
}

/** Read-only: the selection is shown, but changes are refused. */
export const ReadOnly: Story = {
  args: { readOnly: true },
}

/**
 * With `name` set the underlying `<input type="file">` posts through native
 * form submission. Submit to see what lands in `FormData`.
 */
export const InAForm: Story = {
  render: function InAForm(args) {
    const [submitted, setSubmitted] = useState<string | null>(null)
    return (
      <form
        className="story"
        onSubmit={(e) => {
          e.preventDefault()
          const names = new FormData(e.currentTarget)
            .getAll('attachment')
            .map((entry) => (entry instanceof File ? entry.name : entry))
          setSubmitted(JSON.stringify(names))
        }}
      >
        <FileInput {...args} name="attachment" multiple />
        <button type="submit">Submit</button>
        <output>{submitted ?? 'not submitted'}</output>
      </form>
    )
  },
}
