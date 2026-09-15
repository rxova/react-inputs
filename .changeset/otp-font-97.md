---
'@rxova/react-otp-input': patch
---

`--rx-otp-font` now reaches the visible slots and separators

It was read only by the transparent input laid over the row, so the digits a person sees stayed in
the page's font (#97). Slots and `<OtpSeparator>` now take their face from `--rx-otp-font`. Unset,
they still inherit the page's font, as documented, so a field that never set the property looks the
same. The input keeps its monospace fallback, which the spatial caret layout depends on.
