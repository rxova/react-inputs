# Considerations — `@rxova/react-password-input`

Assumptions taken without asking, and the judgement calls behind them. Everything here is up for
review; each entry says what was decided, why, and what it would cost to change.

## Naming and placement

1. **Package name `@rxova/react-password-input`, directory `packages/react-password-input`.**
   Matches the existing `react-otp-input` / `react-rating-input` pattern. Version starts at
   `0.0.0` with a `minor` changeset, so the first release is `0.1.0` — the same entry point the
   other packages had.
2. **Not added to the `@rxova/react-inputs` meta-package.** That would be a user-facing change to
   an already-published package and belongs in its own PR once the three new inputs are reviewed.

## Defaults

3. **`autoComplete` defaults to `current-password`, not `new-password`.** Sign-in forms outnumber
   sign-up forms in any app. The wrong value on a sign-up form makes managers offer the old
   password instead of generating one, so `onWarn` flags an empty or `off` value — but it cannot
   detect the sign-in/sign-up mix-up, which only the app knows.
4. **`hideOnBlur` defaults to `true`.** A revealed password left on screen after the user tabs
   away is a shoulder-surfing exposure they did not choose. Focus moving to the field's _own_
   toggle does not count as leaving.
5. **`capsLockWarning` defaults to `true`.** It is the highest-value affordance in a masked field
   and costs nothing when the modifier is off.
6. **`minScore` defaults to `null`** — the meter advises but does not gate. Gating on a
   client-side estimate is the app's policy decision, not the component's.
7. **The default rule set is one length rule.** Read from NIST SP 800-63B, which advises against
   composition rules. `commonRules` is there for products under an older compliance regime.
8. **`maxLength` is unset by default.** NIST requires accepting at least 64 characters and a
   silently truncated passphrase is a support ticket nobody can diagnose.
9. **`checkCompromisedDelay` is 400 ms.** Long enough that a fast typist does not fire a lookup
   per character, short enough to feel responsive. Guessed, not measured.

## The estimator

10. **Buckets 0–4, matching zxcvbn.** Every meter in this space uses that scale, so consumers can
    swap estimators without re-theming. A continuous percentage was rejected: it invites users to
    optimise for the pixel rather than for length.
11. **The entropy thresholds (28 / 36 / 60 / 80 bits) are judgement, not a citation.** They put
    an 8-character mixed-case-plus-digit password at 2 and a 20-character one at 4, which reads
    right. If you want them moved, they are one array in `strength.ts`.
12. **`RUN_TAIL_WEIGHT = 0.35`** — each character past the second in a repeat or sequence counts
    as about a third. Not zero (`aaaa` really is harder than `aa`), not one (or `aaaaaaaaaaaa`
    would score like a 12-character password). Tuned by eye against a ladder of examples.
13. **The built-in corpus is ~50 entries.** Deliberately a smoke alarm, not a wordlist. Anything
    larger belongs behind `checkCompromised`, where it can query a real corpus without shipping
    one. This is the single biggest honest limitation: **`Tr0ub4dor&3` scores 3**, because nothing
    on the client knows "troubadour" is a word.
14. **Non-ASCII characters count as a pool of 100.** A user reaching for non-ASCII is picking from
    their own keyboard layout, not from all of Unicode. Overstating it would let a four-emoji
    password read as "Strong".
15. **Blocklist and corpus entries are matched as literal text, never compiled to regex.** A
    consumer blocklist built from user-supplied strings would otherwise be both a ReDoS vector and
    a matching bug. Entries shorter than three characters are ignored.
16. **Both the raw-lowercased and the leet-normalized password are searched.** Normalizing alone
    misses `trustno1` and `abc123` (the leet table rewrites their own digits away); raw alone
    misses `P4ssw0rd`. This was a real bug caught by the unit suite.
17. **Length is counted in codepoints, never `.length`.** Four emoji are four characters, not
    eight. Note the asymmetry: the native `maxlength` attribute counts UTF-16 code units because
    that is what the platform does, so an emoji-heavy password hits a `maxLength` sooner than it
    hits `minLength`. Left as-is rather than reimplementing truncation in JavaScript.

## Behaviour

18. **The reveal toggle prevents its own `mousedown` default.** Keeps focus in the input on a
    pointer click. Tab still focuses the button, so keyboard users lose nothing.
19. **The caret is captured on `mousedown` and restored twice — once in a layout effect, once on
    the next animation frame.** This is the least obvious code in the package and it is empirical:
    every engine collapses the input's selection during the mousedown default action, and React
    re-syncs the controlled input's value _after_ the click finishes dispatching, clobbering a
    single restore. Tracing a real click shows the range correct in a microtask and gone by the
    next frame. Dropping the first restore leaves a visible one-frame jump; dropping the second
    leaves the caret at 0.
20. **The reveal button carries an explicit `tabindex="0"`.** Safari leaves buttons out of the tab
    order unless the OS "Full Keyboard Access" setting is on, which would make the toggle
    unreachable by keyboard on a default macOS install. Caught by the WebKit E2E run.
21. **A failed breach lookup reports `null` (unknown), never `false`.** Saying "not compromised"
    because the network was down is a lie in the direction that gets people hurt.
22. **The breach check is skipped while the field is `disabled`.** A disabled field is not being
    edited, so handing its contents to an outbound callback is exposure nobody asked for.
23. **A known-compromised password blocks `onValidityChange`.** Assumed to be what a caller wants;
    if not, ignore `valid` and read `compromised` yourself.
24. **Read-only fields still reveal.** "You may not change this" is not "you may not look at it".
25. **`onValidityChange` fires on transitions only.** Firing per render would make the obvious
    `onValidityChange={setValid}` wiring an infinite loop.
26. **`onRevealChange` fires only on an actual change.** An earlier version reported `false` on
    every blur; a controlled parent saw one no-op update per focus loss.

## Accessibility judgement calls

27. **`role="meter"`, not `progressbar`.** A meter is a static measurement within a known range;
    a progressbar is a task advancing to completion. `aria-valuetext` carries the caption because
    the bare number reads as "2" with no unit.
28. **One polite live region, announcing the bucket and the rule tally.** Making the checklist
    itself live would announce four rows on every keystroke. Because the caption is bucketed,
    React only rewrites the text when the bucket changes — so the announcement is free of the
    usual per-keystroke spam.
29. **Caps Lock is `role="status"`, not `role="alert"`.** Worth saying; not worth interrupting.
30. **Met/unmet state is in the text, not only the marker.** WCAG 1.4.1. The visible marker is
    `aria-hidden` so it is not read as "check mark" before the label.

## Testing

31. **Caps Lock is tested with a synthesised modifier.** No browser automation protocol can turn
    the real Caps Lock on — Playwright's `{CapsLock}` sends the keycode without changing the
    OS-level modifier, so `getModifierState` keeps returning false. The test dispatches a genuine
    `KeyboardEvent` through React's real event system with only the modifier bit faked, which is
    the only way to reach the branch at all. The E2E suite therefore does not cover Caps Lock.
32. **Two branches are excluded from coverage with `v8 ignore`**, both DOM-typing artefacts:
    `selectionStart`/`selectionEnd` are `number | null` only for input types this component never
    renders, and the layout effect's null-ref guard cannot fire without an unmount that would
    cancel the effect. Excluded rather than "covered" by a test that would have to lie about the
    element type.
33. **The E2E suite asserts that the diagnostics path is _absent_** from the production demo
    bundle, which is the only place that claim can be checked for real.

## Known limitations

34. **No wordlist** — see 13.
35. **No confirm-password pairing, no generator.** Out of scope.
36. **A controlled `value` is serialised into SSR markup**, like any controlled input. Do not
    server-render a password field with a non-empty value.
37. **The estimator is not a security control.** It is a nudge. The README says so in the same
    words.
