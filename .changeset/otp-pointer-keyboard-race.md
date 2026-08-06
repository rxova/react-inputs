---
'@rxova/react-otp-input': patch
---

Keep rapid keyboard input in order when it starts immediately after a pointer click. Deferred
spatial caret placement is now cancelled as soon as keyboard, paste, autofill or composition input
begins, so a busy browser cannot move the caret midway through a code.
