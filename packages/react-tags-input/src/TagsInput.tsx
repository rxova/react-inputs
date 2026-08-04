import { forwardRef } from 'react'
import type { CSSProperties } from 'react'
import { useTagsInput } from './useTagsInput'
import type { TagsInputProps, TagState } from './types'

// Only layout-critical declarations are inlined. Everything visual is a CSS
// custom property or a `data-*` hook, so there is no stylesheet to import.
const rootStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 'var(--rtg-gap, 0.25rem)',
  font: 'inherit',
}

const listStyle: CSSProperties = {
  display: 'contents',
  margin: 0,
  padding: 0,
  listStyle: 'none',
}

const tagStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--rtg-tag-gap, 0.25rem)',
  padding: 'var(--rtg-tag-padding, 0.125rem 0.375rem)',
  borderRadius: 'var(--rtg-tag-radius, 0.25rem)',
  background: 'var(--rtg-tag-background, rgba(0 0 0 / 0.08))',
  maxWidth: '100%',
}

const removeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  // 24px of hit area at the default font size. Below this the button fails
  // WCAG 2.5.8 Target Size (Minimum) on touch.
  minWidth: 'var(--rtg-remove-size, 1.5rem)',
  minHeight: 'var(--rtg-remove-size, 1.5rem)',
  padding: 0,
  font: 'inherit',
  lineHeight: 1,
  background: 'none',
  border: 0,
  color: 'inherit',
  cursor: 'pointer',
}

const inputStyle: CSSProperties = {
  font: 'inherit',
  flex: '1 1 6rem',
  minWidth: '4rem',
  border: 0,
  outline: 'none',
  background: 'transparent',
}

/**
 * Off-screen but still in the accessibility tree. `display: none` and
 * `visibility: hidden` would remove it from that tree too, which is the one
 * thing this element exists to stay in.
 */
const visuallyHidden: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
}

/**
 * `forwardRef` rather than reading `props.ref`.
 *
 * React 19 passes `ref` as an ordinary prop, so `props.ref` works there — but
 * React 18 strips it before props are built, so the ref would silently never
 * populate. We declare `react >= 18` as a peer, so the version that needs
 * forwardRef is the one that decides. The ref lands on the entry `<input>`, not
 * the wrapper: `setFocus()` in React Hook Form and focus-first-error patterns
 * both expect a focusable form control.
 *
 * The `@__PURE__` annotation is load-bearing: `forwardRef(...)` is a top-level
 * call, and without it bundlers must assume side effects and cannot drop this
 * component from a build that only imports `useTagsInput`.
 */
export const TagsInput = /* @__PURE__ */ forwardRef<HTMLInputElement, TagsInputProps>(
  function TagsInput(props, ref) {
    const {
      label,
      removeLabel,
      renderTag,
      placeholder,
      className,
      style,
      name,
      required,
      disabled = false,
      readOnly = false,
      invalid,
      'aria-describedby': describedBy,
    } = props

    const field = useTagsInput(props)
    const {
      tags,
      text,
      activeIndex,
      focusedIndex,
      announcement,
      full,
      ids,
      inputRef,
      tagRefs,
      setText,
      setFocusedIndex,
      removeAt,
      handleInputKeyDown,
      handleTagKeyDown,
      handlePaste,
      handleBlur,
      handleFocus,
    } = field

    return (
      <div
        className={className}
        style={{ ...rootStyle, ...style }}
        data-rtg-root=""
        data-disabled={disabled ? '' : undefined}
        data-readonly={readOnly ? '' : undefined}
        data-invalid={invalid ? '' : undefined}
        data-full={full ? '' : undefined}
        data-count={tags.length}
        onBlur={handleBlur}
        onFocus={handleFocus}
      >
        {label !== undefined ? <label htmlFor={ids.input}>{label}</label> : null}

        {/*
          A real list, so a screen reader announces "list, 3 items" and the user
          knows how many tags there are before hearing them. `display: contents`
          keeps that semantic without the list becoming a layout box of its own.
        */}
        <ul id={ids.list} data-rtg-list="" style={listStyle}>
          {tags.map((tag, index) => {
            const state: TagState = {
              tag,
              index,
              focused: focusedIndex === index,
              disabled,
              readOnly,
            }
            return (
              <li key={`${tag}-${String(index)}`} data-rtg-tag={index} style={tagStyle}>
                <span data-rtg-tag-label="">{renderTag ? renderTag(state) : tag}</span>
                {readOnly ? null : (
                  <button
                    ref={(node) => {
                      tagRefs.current[index] = node
                    }}
                    type="button"
                    data-rtg-remove=""
                    data-focused={focusedIndex === index ? '' : undefined}
                    // Roving tabindex: the list is one tab stop, not one per
                    // tag. Twenty tags would otherwise cost a keyboard user
                    // twenty presses to get past the field.
                    tabIndex={index === activeIndex ? 0 : -1}
                    // Names the tag, not just the action: a list of buttons all
                    // called "Remove" is unusable in a screen reader's element
                    // list, where they appear without their surrounding text.
                    aria-label={removeLabel ? removeLabel(tag) : `Remove ${tag}`}
                    disabled={disabled}
                    style={removeStyle}
                    onClick={() => {
                      removeAt(index)
                    }}
                    onKeyDown={(event) => {
                      handleTagKeyDown(event, index)
                    }}
                    onFocus={() => {
                      setFocusedIndex(index)
                    }}
                    onBlur={() => {
                      setFocusedIndex(null)
                    }}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        <input
          ref={(node) => {
            inputRef.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
          }}
          id={ids.input}
          data-rtg-input=""
          type="text"
          value={text}
          placeholder={placeholder}
          required={required && tags.length === 0}
          disabled={disabled}
          readOnly={readOnly}
          // A tag field is a text box, not a combobox: there is no popup and
          // nothing to expand. Claiming `role="combobox"` without one is a
          // promise to assistive technology that this component cannot keep.
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          style={inputStyle}
          onChange={(event) => {
            setText(event.target.value)
          }}
          onKeyDown={handleInputKeyDown}
          onPaste={handlePaste}
        />

        {name === undefined
          ? null
          : // One hidden input per tag, all under the same name, so a native form
            // posts a real array rather than a delimiter-joined string somebody
            // downstream has to guess how to split.
            tags.map((tag, index) => (
              <input
                key={`${name}-${String(index)}`}
                type="hidden"
                data-rtg-value=""
                name={name}
                value={tag}
              />
            ))}

        {/*
          Announces additions and removals, and nothing else.

          React only touches this text node when the string actually changes, so
          assistive technology hears "Added react. 3 tags." once rather than on
          every keystroke that led there. Rejections are deliberately silent by
          default — the refused text stays visibly in the box, and announcing
          every duplicate keystroke would talk over the user as they type.
        */}
        <span
          id={ids.announcement}
          aria-live="polite"
          data-rtg-announcement=""
          style={visuallyHidden}
        >
          {announcement}
        </span>
      </div>
    )
  },
)
