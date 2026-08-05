import { forwardRef } from 'react'
import type { CSSProperties } from 'react'
import { useFileInput } from './useFileInput'
import type { FileEntryState, FileInputProps } from './types'

// Only layout-critical declarations are inlined. Everything visual is a CSS
// custom property or a `data-*` hook, so there is no stylesheet to import.
const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--rx-file-gap, 0.5rem)',
  font: 'inherit',
}

const zoneStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--rx-file-zone-gap, 0.5rem)',
  padding: 'var(--rx-file-zone-padding, 1rem)',
  border: 'var(--rx-file-zone-border, 1px dashed currentColor)',
  borderRadius: 'var(--rx-file-zone-radius, 0.375rem)',
  font: 'inherit',
  color: 'inherit',
  background: 'var(--rx-file-zone-background, transparent)',
  cursor: 'pointer',
  textAlign: 'center',
}

const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--rx-file-list-gap, 0.25rem)',
  margin: 0,
  padding: 0,
  listStyle: 'none',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--rx-file-row-gap, 0.5rem)',
}

const previewStyle: CSSProperties = {
  width: 'var(--rx-file-preview-size, 2.5rem)',
  height: 'var(--rx-file-preview-size, 2.5rem)',
  objectFit: 'cover',
  borderRadius: 'var(--rx-file-preview-radius, 0.25rem)',
  flexShrink: 0,
}

const removeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  // 24px of hit area at the default font size. Below this the button fails
  // WCAG 2.5.8 Target Size (Minimum) on touch.
  minWidth: 'var(--rx-file-remove-size, 1.5rem)',
  minHeight: 'var(--rx-file-remove-size, 1.5rem)',
  marginInlineStart: 'auto',
  padding: 0,
  font: 'inherit',
  lineHeight: 1,
  background: 'none',
  border: 0,
  color: 'inherit',
  cursor: 'pointer',
}

/**
 * The real `<input type="file">`, kept in the DOM but out of sight.
 *
 * Not `display: none` and not `hidden`: both remove it from the accessibility
 * tree and, in some browsers, stop `.click()` from opening the picker. This
 * hides it visually while leaving it a real, present form control — which is
 * what carries `name`, `accept` and `required` into a native submit.
 */
const hiddenInputStyle: CSSProperties = {
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

const visuallyHidden = hiddenInputStyle

/**
 * `forwardRef` rather than reading `props.ref`.
 *
 * React 19 passes `ref` as an ordinary prop, so `props.ref` works there — but
 * React 18 strips it before props are built, so the ref would silently never
 * populate. We declare `react >= 18` as a peer, so the version that needs
 * forwardRef is the one that decides. The ref lands on the `<input type="file">`
 * so `setFocus()` and focus-first-error patterns reach a real form control.
 *
 * The `@__PURE__` annotation is load-bearing: `forwardRef(...)` is a top-level
 * call, and without it bundlers must assume side effects and cannot drop this
 * component from a build that only imports `useFileInput`.
 */
export const FileInput = /* @__PURE__ */ forwardRef<HTMLInputElement, FileInputProps>(
  function FileInput(props, ref) {
    const {
      label,
      hint,
      removeLabel,
      renderFile,
      className,
      style,
      name,
      required,
      accept,
      disabled = false,
      readOnly = false,
      invalid,
      previews = false,
      'aria-describedby': describedBy,
    } = props

    const field = useFileInput(props)
    const {
      entries,
      files,
      dragging,
      full,
      announcement,
      multiple,
      ids,
      inputRef,
      zoneRef,
      removeRefs,
      open,
      removeAt,
      sizeOf,
      handleInputChange,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      handleBlur,
      handleFocus,
    } = field

    const defaultHint = multiple
      ? 'Choose files or drop them here'
      : 'Choose a file or drop it here'

    return (
      <div
        className={className}
        style={{ ...rootStyle, ...style }}
        data-rx-file-root=""
        data-dragging={dragging ? '' : undefined}
        data-full={full ? '' : undefined}
        data-count={files.length}
        data-disabled={disabled ? '' : undefined}
        data-readonly={readOnly ? '' : undefined}
        data-invalid={invalid ? '' : undefined}
        onBlur={handleBlur}
        onFocus={handleFocus}
      >
        {label !== undefined ? <label htmlFor={ids.input}>{label}</label> : null}

        {/*
          The real control. Hidden visually but present, focusable and named, so
          it carries `name`, `accept` and `required` into a native submit and so
          `<label for>` points at something that exists.
        */}
        <input
          ref={(node) => {
            inputRef.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
          }}
          id={ids.input}
          data-rx-file-input=""
          type="file"
          name={name}
          accept={accept}
          multiple={multiple}
          required={required && files.length === 0}
          disabled={disabled || readOnly}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          style={hiddenInputStyle}
          onChange={handleInputChange}
        />

        {/*
          A real <button>, not a div with a click handler. That gives Enter,
          Space, focus and the button role for free — a drop zone that only
          works with a pointer excludes every keyboard user, and drag-and-drop
          has no keyboard equivalent at all, so the click path *is* the
          accessible path.
        */}
        <button
          id={ids.zone}
          ref={(node) => {
            zoneRef.current = node
          }}
          type="button"
          // WebKit leaves buttons out of the tab order unless Full Keyboard
          // Access is on; without this the drop zone is unreachable in Safari.
          tabIndex={0}
          data-rx-file-zone=""
          data-dragging={dragging ? '' : undefined}
          disabled={disabled || readOnly}
          style={zoneStyle}
          onClick={open}
          onDragEnter={handleDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {hint ?? defaultHint}
        </button>

        {entries.length === 0 ? null : (
          // A real list, so a screen reader announces "list, 3 items" before
          // reading the files.
          <ul id={ids.list} data-rx-file-list="" style={listStyle}>
            {entries.map((entry, index) => {
              const state: FileEntryState = {
                ...entry,
                index,
                size: sizeOf(entry.file),
                disabled,
                readOnly,
              }
              return (
                <li key={entry.key} data-rx-file-file={index} style={rowStyle}>
                  {renderFile ? (
                    renderFile(state)
                  ) : (
                    <>
                      {previews && entry.preview !== undefined ? (
                        // Decorative: the file's name is right beside it, so a
                        // description here would be read twice.
                        <img
                          src={entry.preview}
                          alt=""
                          data-rx-file-preview=""
                          style={previewStyle}
                        />
                      ) : null}
                      <span data-rx-file-name="">{entry.file.name}</span>
                      <span data-rx-file-size="">{state.size}</span>
                    </>
                  )}
                  {readOnly ? null : (
                    <button
                      type="button"
                      ref={(node) => {
                        removeRefs.current[index] = node
                      }}
                      tabIndex={0}
                      data-rx-file-remove=""
                      // Names the file, not just the action: a list of buttons
                      // all called "Remove" is unusable in a screen reader's
                      // element list, where they appear without their row.
                      aria-label={
                        removeLabel ? removeLabel(entry.file) : `Remove ${entry.file.name}`
                      }
                      disabled={disabled}
                      style={removeStyle}
                      onClick={() => {
                        removeAt(index)
                      }}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {/*
          Announces additions and removals, and nothing else.

          React only touches this text node when the string actually changes, so
          assistive technology hears one sentence per action rather than one per
          file in a twenty-file drop.
        */}
        <span
          id={ids.announcement}
          aria-live="polite"
          data-rx-file-announcement=""
          style={visuallyHidden}
        >
          {announcement}
        </span>
      </div>
    )
  },
)
