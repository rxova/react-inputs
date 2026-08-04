# Considerations — `@rxova/react-tags-input`

Assumptions taken without asking, and the judgement calls behind them. Everything here is up for
review; each entry says what was decided and why.

## Naming and placement

1. **Package `@rxova/react-tags-input`, directory `packages/react-tags-input`.** Matches the
   existing pattern. Starts at `0.0.0` with a `minor` changeset, so the first release is `0.1.0`.
2. **Not added to the `@rxova/react-inputs` meta-package.** That is a user-facing change to an
   already-published package and belongs in its own PR.
3. **The size argument is explicitly not the pitch here.** `react-tagsinput` is 3.1 kB against this
   package's 3.6 kB, and that is stated in those words rather than finding a unit that
   flatters us. The case is accessibility and testing.

## The accessible shape

4. **A text box beside a real `<ul>`, not a combobox.** Several incumbents claim
   `role="combobox"`, which promises assistive technology a popup listbox. There is no popup here,
   so claiming it would be a lie. A `<ul>` also means a screen reader announces "list, 3 items"
   before reading them.
5. **Roving tabindex over the remove buttons.** One tab stop for the whole list, however many tags.
   The alternative — every button in the tab order — costs a keyboard user one press per tag, and
   twenty tags is a realistic list.
6. **Arrowing right past the last tag lands in the entry box**, rather than wrapping to the first.
   Wrapping would make the list a loop a user cannot arrow out of.
7. **Focus after a removal goes to the next tag, then the previous, then the entry box.** Leaving
   it on a removed button drops focus to `<body>`, which is the failure this component exists to
   avoid. An adversarial test sweeps every position because it only shows at the ends.
8. **Two-step Backspace from an empty box.** The first press focuses the last tag; the second
   removes it. A one-step delete destroys data the user cannot see they are about to lose. This
   differs from most incumbents and is the change most likely to surprise someone migrating.
9. **Remove buttons are named `Remove ${tag}`.** In a screen reader's element list, buttons appear
   without their surrounding text, so a dozen called "Remove" are indistinguishable.
10. **A printable keystroke while a tag has focus moves to the entry box**, keeping the user's
    intent rather than swallowing the character.
11. **Read-only hides the remove buttons entirely** rather than disabling them. A visible but inert
    control is a worse affordance than no control.
12. **Announcements are polite and only for add and remove.** A rejection is not announced by
    default: the refused text stays visibly in the box, and announcing every duplicate keystroke
    would talk over the user as they type. `announce` overrides all of it, and returning `''`
    silences it.
13. **A batch paste is announced once.** Reading each of forty pasted tags in turn is not
    information.

## Entry rules

14. **Default delimiters are `Enter` and `,`.** `Tab` is supported but opt-in, because it changes
    what Tab means in a form. Even when opted in, Tab on an _empty_ box does not commit — that
    would trap focus in the field.
15. **An empty `delimiters` array falls back to `Enter`** and warns. With nothing to commit on, the
    field looks broken.
16. **Paste splits on the delimiters and on newlines regardless.** A paste from a spreadsheet
    column arrives newline-separated whatever the field was configured for.
17. **A single-value paste is left to the browser**, so the text simply lands in the box.
18. **Empty fragments in a paste are dropped, not rejected.** `a,,b` is one careless keystroke, not
    two mistakes.
19. **A refused entry stays in the box.** Clearing it would make the user retype from memory a
    value they can no longer see. This is why the adversarial tests clear the box between
    attempts — typing straight on would append to the refusal.
20. **`addOnBlur` defaults to `true`.** Half-typed text that vanishes on blur is the most common
    complaint about tag fields.
21. **Deduplication is case-insensitive by default**, using `toLocaleLowerCase` — a tag list is
    exactly where someone would notice "İstanbul" folding wrongly.
22. **Lengths count codepoints.** Two emoji are two characters, not four.
23. **`transform` runs before every other rule**, so lowercasing in `transform` makes `React` a
    duplicate of `react`.
24. **`transform` and `validate` are contained.** A throwing `transform` degrades to no transform;
    a throwing `validate` refuses the tag. Neither takes the form down.
25. **The cheap rules run before `validate`**, so consumer code never sees an empty entry.

## Props and value

26. **The value is `string[]`.** Objects with ids and colours are a `renderTag` concern on top of a
    string key, not a change to the value type.
27. **A controlled `value` is sanitised on every render rather than copied into state.** Copying
    would let the two drift, and the field would keep showing a tag the parent no longer believes
    in.
28. **Non-string entries are dropped, never stringified.** A tag reading "undefined" is a worse
    failure than a missing one, and the warning says exactly that.
29. **A `max` below 1 is ignored and warned.** A field that can hold no tags is not a field.
30. **An impossible length range is dropped whole**, not by halves — leaving one bound enforced and
    the other silently ignored would be harder to debug than ignoring both.
31. **One hidden input per tag**, all under the same `name`, so a native form posts an array.
    `required` applies to the entry box only while the list is empty.

## Testing

32. **The paste E2E skips itself in Firefox, visibly.** Firefox ignores `clipboardData` passed to
    the `ClipboardEvent` constructor, so a synthesised paste arrives empty and the assertion would
    be testing the harness. The test detects that and skips with a message rather than passing
    quietly; the path is still covered in the other two engines and in the browser suite.
33. **Emoji tags are filled, not typed.** The CDP keyboard channel mangles astral characters into
    replacement chars.
34. **One branch is excluded from coverage with `v8 ignore`**: an array index typed as
    possibly-undefined after its length was already checked.
35. **The E2E suite asserts the diagnostics path is _absent_** from the production demo bundle.

## Known limitations

36. **No suggestions, no drag-to-reorder, no rich tags** — out of scope.
37. **`onChange` fires with the whole new array**, so a parent doing an expensive derivation on
    every tag change will do it per tag. `onAdd`/`onRemove` carry the delta if that matters.
38. **Multi-character delimiters are ignored.** Splitting on `::` would need a real parser, and a
    tag field should not invite one.
39. **The entry box is not a combobox even if you add your own suggestion list.** If you build one,
    you own the `aria-*` wiring for it — this component will not claim semantics it does not
    implement.
