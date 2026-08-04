import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { TagsInput } from '@rxova/react-tags-input'

const meta = {
  title: 'Components/Tags input',
  component: TagsInput,
  args: {
    label: 'Tags',
    placeholder: 'Add a tag',
    trim: true,
    allowDuplicates: false,
    caseSensitive: false,
    splitPaste: true,
    addOnBlur: true,
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
    delimiters: { control: 'check', options: ['Enter', ',', ' ', 'Tab', ';'] },
    max: { control: { type: 'number', min: 1, max: 20, step: 1 } },
    minLength: { control: { type: 'number', min: 1, max: 20, step: 1 } },
    maxLength: { control: { type: 'number', min: 1, max: 40, step: 1 } },
    value: { control: false },
    // Functions and nodes have no useful control representation.
    transform: { control: false },
    validate: { control: false },
    renderTag: { control: false },
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
} satisfies Meta<typeof TagsInput>

export default meta
type Story = StoryObj<typeof meta>

/** Every prop is live in the Controls panel; the spies log to Actions. */
export const Playground: Story = {
  args: { defaultValue: ['react', 'typescript'] },
}

/**
 * `delimiters` decides what commits the current text. `'Tab'` is accepted but
 * changes what Tab means for keyboard users, so it stays opt-in.
 */
export const CustomDelimiters: Story = {
  args: {
    defaultValue: ['alpha'],
    delimiters: ['Enter', ',', ' '],
    placeholder: 'Space or comma commits',
  },
}

/**
 * Paste splits on the delimiters — and on newlines regardless. Paste
 * "red, green\nblue" to add three tags at once.
 */
export const PasteSplitting: Story = {
  args: { placeholder: 'Paste "red, green\\nblue"' },
}

/** A cap on the list. Once `max` is reached the entry box refuses anything more. */
export const Capped: Story = {
  args: { max: 3, defaultValue: ['one', 'two'], label: 'Up to 3 tags' },
}

/**
 * `validate` has the final say and can return a string explaining the refusal.
 * The text stays in the box so the user can fix it rather than retype it.
 */
export const WithValidation: Story = {
  render: function WithValidation(args) {
    const [rejected, setRejected] = useState<string | null>(null)
    return (
      <>
        <TagsInput
          {...args}
          label="Lowercase letters only"
          transform={(raw: string) => raw.toLowerCase()}
          validate={(tag: string) => /^[a-z]+$/.test(tag) || `"${tag}" must be letters only`}
          onReject={(attempt) => {
            setRejected(attempt.message ?? attempt.reason ?? null)
          }}
          aria-describedby="tags-reject-help"
        />
        <p id="tags-reject-help" className={rejected ? 'error' : undefined}>
          {rejected ?? 'Try adding "hello", then "hello!"'}
        </p>
      </>
    )
  },
}

/** Duplicates are refused by default; `caseSensitive` decides what counts as one. */
export const AllowingDuplicates: Story = {
  args: { allowDuplicates: true, defaultValue: ['react', 'react'] },
}

/** `renderTag` draws the tag's contents — the chrome and remove button stay. */
export const CustomTagRendering: Story = {
  args: {
    defaultValue: ['design', 'engineering', 'ops'],
    renderTag: ({ tag, focused }) => (
      <span style={{ fontWeight: focused ? 700 : 400 }}>#{tag}</span>
    ),
  },
}

/** Controlled: the consumer owns the array and can edit it from outside. */
export const Controlled: Story = {
  render: function Controlled(args) {
    const [tags, setTags] = useState<string[]>(['react'])
    return (
      <>
        <TagsInput {...args} value={tags} onChange={setTags} />
        <button
          type="button"
          onClick={() => {
            setTags([])
          }}
          disabled={tags.length === 0}
        >
          Clear all
        </button>
        <output>
          {tags.length} tag(s): {JSON.stringify(tags)}
        </output>
      </>
    )
  },
}

/** `invalid` sets `aria-invalid` and `data-invalid`; the ring is a consumer token. */
export const Invalid: Story = {
  render: (args) => (
    <>
      <TagsInput {...args} invalid aria-describedby="tags-invalid-help" />
      <p id="tags-invalid-help" className="error">
        Add at least one tag
      </p>
    </>
  ),
}

/** Disabled: exposed to assistive tech, not editable. */
export const Disabled: Story = {
  args: { disabled: true, defaultValue: ['react', 'typescript'] },
}

/** Read-only: the tags are shown and focusable, but not editable. */
export const ReadOnly: Story = {
  args: { readOnly: true, defaultValue: ['react', 'typescript'] },
}

/**
 * With `name` set the component emits one hidden input per tag, so a native
 * `<form>` posts an array. Submit to see the `FormData` payload.
 */
export const InAForm: Story = {
  render: function InAForm(args) {
    const [submitted, setSubmitted] = useState<string | null>(null)
    return (
      <form
        className="story"
        onSubmit={(e) => {
          e.preventDefault()
          setSubmitted(JSON.stringify(new FormData(e.currentTarget).getAll('tags')))
        }}
      >
        <TagsInput {...args} name="tags" defaultValue={['react']} />
        <button type="submit">Submit</button>
        <output>{submitted ?? 'not submitted'}</output>
      </form>
    )
  },
}
